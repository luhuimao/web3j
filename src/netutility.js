// @flow

import assert from 'assert';
import {parse as urlParse, format as urlFormat} from 'url';
import fetch from 'node-fetch';
import jayson from 'jayson/lib/client/browser';
import {struct} from 'superstruct';
import {Client as RpcWebSocketClient} from 'rpc-websockets';

import {DEFAULT_TICKS_PER_SLOT, NUM_TICKS_PER_SEC} from './timing';
import {PubKey} from './bvm-addr';
import {Transaction} from './tx-dapp';
import {dormant} from './util/dormant';
import type {Blockhash} from './tx-seal';
import type {FeeCalculator} from './gas-cost';
import type {BusAccount} from './bvm-acct';
import type {TxnSignature} from './tx-dapp';


var number_type = 0;
var string_type = 1;
var object_type = 2;
var boolean_type = 3;

var _types = {
    [number_type]: 'number',
    [string_type]: 'string',
    [object_type]: 'object',
    [boolean_type]: 'boolean'
};

function check(args, ...types) {
  if((typeof args !== typeof arguments) && !isArray(args)) {
      args = [args];
  }

  if(args.length !== types.length){
      throw new TypeError(`unmatch number of arguments, expected ${types.length} but got ${args.length}`);
  }

  for (let index in args) {
      if(typeof types[index] === 'number') {
          assert(types[index] in _types);

          if(typeof args[index] !== _types[types[index]]) {
              throw new TypeError(`invalid parameter at position ${index}, expected ${_types[types[index]]} but got ${typeof args[index]}`)
          }
      } else if(typeof types[index] === 'function') {
          if(!(args[index] instanceof types[index])) {
              let functionName = types[index].toString();
              if (functionName.startsWith('class')) {
                  functionName = functionName.substr('class '.length);
                  functionName = functionName.substr(0, functionName.indexOf('{')).trim();
              } else {
                  functionName = functionName.substr('function '.length);
                  functionName = functionName.substr(0, functionName.indexOf('(')).trim();
              }

              throw new TypeError(`invalid parameter at position ${index}, expected instance of ${functionName} but got ${typeof args[index]}`)
          }
      }
  }
}


const ConditionOp = {
    EQ: 'eq',
    NE: 'ne',
    GT: 'gt',
    GE: 'ge',
    LT: 'lt',
    LE: 'le',
    LIMIT: 'limit'
};

class Condition {
    constructor() {
        this.conditions = {};
    }

    eq(key, value) {
        check(arguments, string, string);

        this.conditions[key] = {
            [ConditionOp.EQ]: value
        };
    }

    ne(key, value) {
        check(arguments, string, string);

        this.conditions[key] = {
            [ConditionOp.NE]: value
        };
    }

    gt(key, value) {
        check(arguments, string, string);

        this.conditions[key] = {
            [ConditionOp.GT]: value
        };
    }

    ge(key, value) {
        check(arguments, string, string);

        this.conditions[key] = {
            [ConditionOp.GE]: value
        };
    }

    lt(key, value) {
        check(arguments, string, string);

        this.conditions[key] = {
            [ConditionOp.LT]: value
        };
    }

    le(key, value) {
        check(arguments, string, string);

        this.conditions[key] = {
            [ConditionOp.LE]: value
        };
    }

    limit(...args) {
        if (args.length === 1) {
            check(arguments, number);

            let count = args[0];
            this.limit(0, count);
        } else {
            check(arguments, number, number);

            let offset = args[0];
            let count = args[1];

            if (offset < 0) {
                offset = 0;
            }

            if (count < 0) {
                count = 0;
            }

            this.conditions['limit'] = {
                [ConditionOp.LIMIT]: offset + ',' + count
            };
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////

class NetworkError extends Error {
    constructor(msg) {
        super(msg);
        this.name = 'NetworkError';
    }
}

const tls = require('tls');
const fs = require('fs');
const net = require('net');
const uuidv4 = require('uuid/v4');
const events = require('events');
// const { NetworkError } = require('./exceptions').NetworkError;

let emitters = new Map();
let buffers = new Map();
let sockets = new Map();
let lastBytesRead = new Map();

/**
 * Parse response returned by node
 * @param {Buffer} response Node's response
 */
function parseResponse(response) {
    let seq = response.slice(6, 38).toString();
    let result = JSON.parse(response.slice(42).toString());
    let emitter = emitters.get(seq);
    if(!emitter) {
        // Stale message received
        return;
    }
    emitter = emitter.emitter;

    if (emitter) {
        let readOnly = Object.getOwnPropertyDescriptor(emitter, 'readOnly').value;
        if (readOnly) {
            if (result.error || result.result !== undefined ) {
                emitter.emit('gotresult', result);
            }
        } else {
            if (result.error || result.status || (result.result && result.result.status)) {
                emitter.emit('gotresult', result);
            } else {
                if (!result.result) {
                    throw new NetworkError(`unknown message receieved, seq=${seq}, data=${response.toString()}`);
                }
            }
        }
    } else {
        throw new NetworkError(`unknown owner message receieved, seq=${seq}, data=${response.toString()}`);
    }
}

/**
 * Create a new TLS socket
 * @param {String} ip IP of channel server
 * @param {Number} port Port of channel server
 * @param {Object} authentication A JSON object contains certificate file path, private key file path and CA file path
 * @return {TLSSocket} A new TLS socket
 */
function createNewSocket(ip, port, authentication) {
    let secureContextOptions = {
        key: fs.readFileSync(authentication.key),
        cert: fs.readFileSync(authentication.cert),
        ca: fs.readFileSync(authentication.ca),
        ecdhCurve: 'secp256k1',
    };

    let secureContext = tls.createSecureContext(secureContextOptions);

    let socket = new net.Socket();
    socket.connect(port, ip);

    let clientOptions = {
        rejectUnauthorized: false,
        secureContext: secureContext,
        socket: socket
    };

    let tlsSocket = tls.connect(clientOptions);

    tlsSocket.on('error', function (error) {
        throw new Error(error);
    });
    
    let socketID = `${ip}:${port}`;
    
    lastBytesRead.set(socketID, 0);

    tlsSocket.on('data', function (data) {
        let response = null;
        if (data instanceof Buffer) {
            response = data;
        }
        else {
            response = Buffer.from(data, 'ascii');
        }

        if (!buffers.has(socketID)) {
            // First time to read data from this socket
            let expectedLength = null;
            if (tlsSocket.bytesRead - lastBytesRead.get(socketID) >= 4) {
                expectedLength = response.readUIntBE(0, 4);
            }

            if (!expectedLength || tlsSocket.bytesRead < lastBytesRead.get(socketID) + expectedLength) {
                buffers.set(socketID, {
                    expectedLength: expectedLength,
                    buffer: response
                });
            } else {
                lastBytesRead.set(socketID, lastBytesRead.get(socketID) + expectedLength);
                parseResponse(response);
                buffers.delete(socketID);
            }
        } else {
            // Multiple reading
            let cache = buffers.get(socketID);
            cache.buffer = Buffer.concat([cache.buffer, response]);
            if (!cache.expectedLength && tlsSocket.bytesRead - lastBytesRead.get(socketID) >= 4) {
                cache.expectedLength = cache.buffer.readUIntBE(0, 4);
            }

            if (cache.expectedLength && tlsSocket.bytesRead - lastBytesRead.get(socketID) >= cache.expectedLength) {
                lastBytesRead.set(socketID, lastBytesRead.get(socketID) + cache.expectedLength);
                parseResponse(buffers.get(socketID).buffer);
                buffers.delete(socketID);
            }
        }
    });

    return tlsSocket;
}

/**
 * Prepare the data which will be sent to channel server
 * @param {String} data JSON string of load
 * @return {Object} UUID and packaged data
 */
function packageData(data) {
    const headerLength = 4 + 2 + 32 + 4;

    let length = Buffer.alloc(4);
    length.writeUInt32BE(headerLength + data.length);
    let type = Buffer.alloc(2);
    type.writeUInt16BE(0x12);
    let uuid = uuidv4();
    uuid = uuid.replace(/-/g, '');
    let seq = Buffer.from(uuid, 'ascii');
    let result = Buffer.alloc(4);
    result.writeInt32BE(0);
    let msg = Buffer.from(data, 'ascii');

    return {
        'uuid': uuid,
        'packagedData': Buffer.concat([length, type, seq, result, msg])
    };
}

/**
 * Clear context when a message got response or timeout
 * @param {Socket} socket The socket who sends the message
 */
function clearContext(uuid) {
    clearTimeout(emitters.get(uuid).timer);
    emitters.delete(uuid);
    buffers.delete(uuid);
}

/**
 * Return channel promise for a request
 * @param {Object} node A JSON object which contains IP and port configuration of channel server
 * @param {Object} authentication A JSON object contains certificate file path, private key file path and CA file path
 * @param {String} data JSON string of load
 * @param {Number} timeout Timeout to wait response
 * @return {Promise} a promise which will be resolved when the request is satisfied
 */
function channelPromise(node, authentication, data, timeout, readOnly = false) {
    let ip = node.ip;
    let port = node.port;

    let connectionID = `${ip}${port}`;
    if (!sockets.has(connectionID)) {
        let newSocket = createNewSocket(ip, port, authentication);
        newSocket.unref();
        sockets.set(connectionID, newSocket);
    }
    let tlsSocket = sockets.get(connectionID);

    let dataPackage = packageData(JSON.stringify(data));
    let uuid = dataPackage.uuid;

    tlsSocket.socketID = uuid;
    let packagedData = dataPackage.packagedData;
    let channelPromise = new Promise(async (resolve, reject) => {
        let eventEmitter = new events.EventEmitter();
        Object.defineProperty(eventEmitter, "readOnly", {
            value: readOnly,
            writable: false,
            configurable: false,
            enumerable: false
        });

        eventEmitter.on('gotresult', (result) => {
            clearContext(uuid);
            if (result.error) {
                reject(result);
            } else {
                resolve(result);
            }
            return; // This `return` is not necessary, but it may can avoid future trap
        });

        eventEmitter.on('timeout', () => {
            clearContext(uuid);
            reject({ 'error': 'timeout' });
            return; // This `return` is not necessary, but it may can avoid future trap
        });

        emitters.set(uuid, {
            emitter: eventEmitter,
            timer: setTimeout(() => {
                eventEmitter.emit('timeout');
            }, timeout)
        });

        tlsSocket.write(packagedData);
    });
    return channelPromise;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////


type RpcReq = (methodName: string, args: Array<any>) => any;

/**
 * Information describing a cluster node
 *
 * @typedef {Object} NodeInfo
 * @property {string} pubkey Identity public key of the node
 * @property {string} gossip Gossip network address for the node
 * @property {string} tpu TPU network address for the node (null if not available)
 * @property {string|null} rpc JSON RPC network address for the node (null if not available)
 */
type NodeInfo = {
  pubkey: string,
  gossip: string,
  tpu: string | null,
  rpc: string | null,
};

/**
 * Information describing a vote account
 *
 * @typedef {Object} VoteAccountInfo
 * @property {string} votePubkey Public key of the vote account
 * @property {string} nodePubkey Identity public key of the node voting with this account
 * @property {string} stake The stake, in difs, delegated to this vote account
 * @property {string} commission A 32-bit integer used as a fraction (commission/0xFFFFFFFF) for rewards payout
 */
type VoteAccountInfo = {
  votePubkey: string,
  nodePubkey: string,
  stake: number,
  commission: number,
};

function createRpcReq(url): RpcReq {
  const server = jayson(async (request, callback) => {
    const options = {
      method: 'POST',
      body: request,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    try {
      const res = await fetch(url, options);
      const text = await res.text();
      callback(null, text);
    } catch (err) {
      callback(err);
    }
  });

  return (method, args) => {
    return new Promise((resolve, reject) => {
      server.request(method, args, (err, response) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(response);
      });
    });
  };
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////
class ConfigurationError extends Error {
    constructor(msg) {
        super(msg);
        this.name = 'ConfigurationError';
    }
}

class TransactionError extends Error {
    constructor(msg) {
        super(msg);
        this.name = 'TransactionError';
    }
}

class PrecompiledError extends Error {
    constructor(msg) {
        super(msg);
        this.name = 'PrecompiledError';
    }
}

class CompileError extends Error {
    constructor(msg) {
        super(msg);
        this.name = 'CompileError';
    }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Expected JSON RPC response for the "fetchAccountBalance" message
 */
const FetchBalanceRpcResult = struct({
  jsonrpc: struct.literal('2.0'),
  id: 'string',
  error: 'any?',
  result: 'number?',
});

const FetchReputationRpcResult = struct({
  jsonrpc: struct.literal('2.0'),
  id: 'string',
  error: 'any?',
  result: 'number?',
});


/**
 * @private
 */
function jsonRpcResult(resultDescription: any) {
  const jsonRpcVersion = struct.literal('2.0');
  return struct.union([
    struct({
      jsonrpc: jsonRpcVersion,
      id: 'string',
      error: 'any',
    }),
    struct({
      jsonrpc: jsonRpcVersion,
      id: 'string',
      error: 'null?',
      result: resultDescription,
    }),
  ]);
}

/**
 * @private
 */
const AccountDetailResult = struct({
  executable: 'boolean',
  owner: 'array',
  difs: 'number',
  reputations: 'number',
  data: 'array',
});

/**
 * Expected JSON RPC response for the "fetchAccountDetail" message
 */
const fetchAccountDetailRpcResult = jsonRpcResult(AccountDetailResult);

/***
 * Expected JSON RPC response for the "accountNotification" message
 */
const AccountNoticeResult = struct({
  subscription: 'number',
  result: AccountDetailResult,
});

/**
 * @private
 */
const ControllerAccountDetailResult = struct(['string', AccountDetailResult]);

/***
 * Expected JSON RPC response for the "controllerNotification" message
 */
const ControllerAccountNoticeResult = struct({
  subscription: 'number',
  result: ControllerAccountDetailResult,
});

////////////////////////////////////////////////////////////////////////////////////////////////
// const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
// const assert = require('assert');
// const events = require('events');
const abi = require('ethjs-abi');

function selectNode(nodes) {
    return nodes[Math.floor(Math.random() * nodes.length)];
};


function checkContractLength(bin) {
    if (bin.length && bin.length <= 0x40000) {
        return;
    }
    throw new CompileError(`contract bin size overflow, limit=0x40000(256K), size=${bin.length}`);
}

function checkContractError(errors) {
    // Standard error types of solcjs
    var solcErrors = [
        'JSONError',
        'IOError',
        'ParserError',
        'DocstringParsingError',
        'SyntaxError',
        'DeclarationError',
        'TypeError',
        'UnimplementedFeatureError',
        'InternalCompilerError',
        'Exception',
        'CompilerError',
        'FatalError'
    ];

    if (!errors) {
        return;
    } else {
        let errorMsgs = [];
        for (let error of errors) {
            let [lineNo, level, msg] = error.split(': ');
            if (solcErrors.includes(level)) {
                errorMsgs.push(error);
            }
        }

        if(errorMsgs.length !== 0) {
            throw new CompileError(errorMsgs);
        }
        return;
    }
}

function compileWithSolcJS(contractPath, outputDir) {
    let contractName = path.basename(contractPath, '.sol');

    let contractContent = fs.readFileSync(contractPath).toString();
    let verReg = /pragma\s+solidity\s+\^(.*)\s*;/;
    let ver = verReg.exec(contractContent)[1] || null;

    let readCallback = (importContractName) => {
        let importContractPath = path.join(path.dirname(contractPath), importContractName);
        return { contents: fs.readFileSync(importContractPath).toString() };
    };
    let writeToFile = (abi, bin) => {
        checkContractLength(bin);

        if (typeof abi !== 'string') {
            abi = JSON.stringify(abi);
        }

        if (typeof bin !== 'string') {
            bin = JSON.stringify(bin);
        }

        let abiFileName = contractName + '.abi';
        let binFileName = contractName + '.bin';

        fs.writeFileSync(path.join(outputDir, abiFileName), abi);
        fs.writeFileSync(path.join(outputDir, binFileName), bin);
    };

    let solc = null;
    let output = null;
    if (ver && ver.startsWith('0.5')) {
        solc = require('./solc-0.5');
        let input = {
            language: "Solidity",
            sources: {
                [contractName]: {
                    content: contractContent
                }
            },
            settings: {
                outputSelection: {
                    '*': {
                        '*': ['abi', 'evm.bytecode']
                    }
                }
            }
        };
        output = JSON.parse(solc.compile(JSON.stringify(input), readCallback));
        checkContractError(output.errors);

        let abi = output.contracts[contractName][contractName].abi;
        let bin = output.contracts[contractName][contractName].evm.bytecode.object;
        writeToFile(abi, bin);
    } else {
        solc = require('./solc-0.4');
        let input = {
            sources: {
                [contractName]: contractContent
            }
        };

        output = solc.compile(input, 1, readCallback);
        checkContractError(output.errors);

        let abi = output.contracts[`${contractName}:${contractName}`].interface;
        let bin = output.contracts[`${contractName}:${contractName}`].bytecode;
        writeToFile(abi, bin);
    }

    return Promise.resolve();
}

function compileWithBin(outputDir, contractPath, solc) {
    let execEmitter = new events.EventEmitter();
    let execPromise = new Promise((resolve, reject) => {
        execEmitter.on('done', () => {
            resolve();
        });
        execEmitter.on('error', (stdout, stderr) => {
            console.error(chalk.red(`Compiling error: ${stdout}\n${stderr}`));
            reject();
        });
    });

    let cmd = `${solc} --overwrite --abi --bin -o ${outputDir} ${contractPath}`;
    childProcess.exec(
        cmd,
        (error, stdout, stderr) => {
            if (!error) {
                execEmitter.emit('done');
            }
            else {
                execEmitter.emit('error', stdout, stderr);
            }
        });

    return execPromise.then(result => {
        let contractName = path.basename(contractPath, '.sol');
        let bin = fs.readFileSync(path.join(outputDir, contractName + '.bin'));
        checkContractLength(bin);
        return result;
    });
}
////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Expected JSON RPC response for the "confmTxn" message
 */
const ConfmTxnRpcResult = jsonRpcResult('boolean');

/**
 * Expected JSON RPC response for the "fetchRoundLeader" message
 */
const FetchRoundLeader = jsonRpcResult('string');

/**
 * Expected JSON RPC response for the "fetchClusterNodes" message
 */
const GetClusterNodes = jsonRpcResult(
  struct.list([
    struct({
      pubkey: 'string',
      gossip: 'string',
      tpu: struct.union(['null', 'string']),
      rpc: struct.union(['null', 'string']),
    }),
  ]),
);
/**
 * @ignore
 */
const GetClusterNodes_015 = jsonRpcResult(
  struct.list([
    struct({
      id: 'string',
      gossip: 'string',
      tpu: struct.union(['null', 'string']),
      rpc: struct.union(['null', 'string']),
    }),
  ]),
);

/**
 * Expected JSON RPC response for the "getEpochVoteAccounts" message
 */
const GetEpochVoteAccounts = jsonRpcResult(
  struct.list([
    struct({
      votePubkey: 'string',
      nodePubkey: 'string',
      stake: 'number',
      commission: 'number',
    }),
  ]),
);

/**
 * Expected JSON RPC response for the "fetchSignatureState" message
 */
const FetchSignatureStateRpcResult = jsonRpcResult(
  struct.union([
    'null',
    struct.union([struct({Ok: 'null'}), struct({Err: 'object'})]),
  ]),
);

/**
 * Expected JSON RPC response for the "fetchTxnAmount" message
 */
const FetchTxnAmountRpcResult = jsonRpcResult('number');

/////////////////////////////////////////////////////////////////////////////////////////////////////
class StatusCode {
    static getStatusMessage(status) {
        let message = '';
        switch (status) {
            case this.Success:
                message = 'success';
                break;
            case this.Unknown:
                message = 'unknown';
                break;
            case this.BadRLP:
                message = 'bad RLP';
                break;
            case this.InvalidFormat:
                message = 'invalid format';
                break;
            case this.OutOfGasIntrinsic:
                message = 'out of gas intrinsic';
                break;
            case this.InvalidSignature:
                message = 'invalid signature';
                break;
            case this.InvalidNonce:
                message = 'invalid nonce';
                break;
            case this.NotEnoughCash:
                message = 'not enough cash';
                break;
            case this.OutOfGasBase:
                message = 'out of gas base';
                break;
            case this.BlockGasLimitReached:
                message = 'block gas limit reached';
                break;
            case this.BadInstruction:
                message = 'bad instruction';
                break;
            case this.BadJumpDestination:
                message = 'bad jump destination';
                break;
            case this.OutOfGas:
                message = 'out of gas';
                break;
            case this.OutOfStack:
                message = 'out of stack';
                break;
            case this.StackUnderflow:
                message = 'stack underflow';
                break;
            case this.NonceCheckFail:
                message = 'nonce check fail';
                break;
            case this.BlockLimitCheckFail:
                message = 'block limit check fail';
                break;
            case this.FilterCheckFail:
                message = 'filter check fail';
                break;
            case this.NoDeployPermission:
                message = 'no deploy permission';
                break;
            case this.NoCallPermission:
                message = 'no call permission';
                break;
            case this.NoTxPermission:
                message = 'no tx permission';
                break;
            case this.PrecompiledError:
                message = 'precompiled error';
                break;
            case this.RevertInstruction:
                message = 'revert instruction';
                break;
            case this.InvalidZeroSignatureFormat:
                message = 'invalid zero signature format';
                break;
            case this.AddressAlreadyUsed:
                message = 'address already used';
                break;
            case this.PermissionDenied:
                message = 'permission denied';
                break;
            case this.CallAddressError:
                message = 'call address error';
                break;
            default:
                message = `unknown status code:${status}`;
                break;
        }

        return message;
    }
}

StatusCode.Success = '0x0';
StatusCode.Unknown = '0x1';
StatusCode.BadRLP = '0x2';
StatusCode.InvalidFormat = '0x3';
StatusCode.OutOfGasIntrinsic = '0x4';
StatusCode.InvalidSignature = '0x5';
StatusCode.InvalidNonce = '0x6';
StatusCode.NotEnoughCash = '0x7';
StatusCode.OutOfGasBase = '0x8';
StatusCode.BlockGasLimitReached = '0x9';
StatusCode.BadInstruction = '0xa';
StatusCode.BadJumpDestination = '0xb';
StatusCode.OutOfGas = '0xc';
StatusCode.OutOfStack = '0xd';
StatusCode.StackUnderflow = '0xe';
StatusCode.NonceCheckFail = '0xf';
StatusCode.BlockLimitCheckFail = '0x10';
StatusCode.FilterCheckFail = '0x11';
StatusCode.NoDeployPermission = '0x12';
StatusCode.NoCallPermission = '0x13';
StatusCode.NoTxPermission = '0x14';
StatusCode.PrecompiledError = '0x15';
StatusCode.RevertInstruction = '0x16';
StatusCode.InvalidZeroSignatureFormat = '0x17';
StatusCode.AddressAlreadyUsed = '0x18';
StatusCode.PermissionDenied = '0x19';
StatusCode.CallAddressError = '0x1a';
/////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Expected JSON RPC response for the "getTotalSupply" message
 */
const GetTotalSupplyRpcResult = jsonRpcResult('number');

/**
 * Expected JSON RPC response for the "fetchRecentBlockhash" message
 */
const FetchRecentBlockhash = jsonRpcResult([
  'string',
  struct({
    difsPerSignature: 'number',
    maxDifsPerSignature: 'number',
    minDifsPerSignature: 'number',
    targetDifsPerSignature: 'number',
    targetSignaturesPerSlot: 'number',
  }),
]);
/**
 * @ignore
 */
const GetRecentBlockhash_015 = jsonRpcResult([
  'string',
  struct({
    difsPerSignature: 'number',
  }),
]);

/**
 * Expected JSON RPC response for the "reqDrone" message
 */
const ReqDroneRpcResult = jsonRpcResult('string');

/**
 * Expected JSON RPC response for the "reqReputation" message
 */
const ReqReputationRpcResult = jsonRpcResult('string');

/**
 * Expected JSON RPC response for the "sendTxn" message
 */
const SendTxnRpcResult = jsonRpcResult('string');

/**
 * Information describing an account
 *
 * @typedef {Object} AccountDetail
 * @property {number} difs Number of difs assigned to the account
 * @property {PubKey} owner Identifier of the controller that owns the account
 * @property {?Buffer} data Optional data assigned to the account
 * @property {boolean} executable `true` if this account's data contains a loaded controller
 */
type AccountDetail = {
  executable: boolean,
  owner: PubKey,
  difs: number,
  reputations: number,
  data: Buffer,
};

/**
 * BusAccount information identified by pubkey
 *
 * @typedef {Object} KeyedAccountDetail
 * @property {PubKey} accountId
 * @property {AccountDetail} fetchAccountDetail
 */
type KeyedAccountDetail = {
  accountId: PubKey,
  fetchAccountDetail: AccountDetail,
};

/**
 * Callback function for account change notifications
 */
export type AccountChangeCallback = (fetchAccountDetail: AccountDetail) => void;

/**
 * @private
 */
type AccountSubscriptionDetail = {
  pubKey: string, // PubKey of the account as a base 58 string
  callback: AccountChangeCallback,
  subscriptionId: null | number, // null when there's no current server subscription id
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////
const secp256k1 = require('secp256k1');
// const cryptoJSSha3 = require('crypto-js/sha3');
const keccak = require('keccak');
// const assert = require('assert');
const rlp = require('rlp');
const coder = require('web3-eth-abi');
const ethjsUtil = require('ethjs-util');
const encryptType = 0;

/**
 * Convert data to Buffer
 * @param {any} data data to be transformed to buffer
 * @return {Buffer} transformation result
 */
function toBuffer(data) {
    if (!Buffer.isBuffer(data)) {
        if (Array.isArray(data)) {
            data = Buffer.from(data);
        } else if (typeof data === 'string') {
            if (ethjsUtil.isHexPrefixed(data)) {
                data = Buffer.from(ethjsUtil.padToEven(ethjsUtil.stripHexPrefix(data)), 'hex');
            } else {
                data = Buffer.from(data, 'hex');
            }
        } else if (Number.isInteger(data)) {
            data = ethjsUtil.intToBuffer(data);
        } else if (data === null || data === undefined) {
            data = Buffer.allocUnsafe(0);
        } else if (data.toArray) {
            data = Buffer.from(data.toArray());
        } else {
            throw new Error('invalid type');
        }
    }
    return data;
}

/**
 * Calculate hash of data
 * @param {any} data data
 * @param {int} bits length of hash
 * @return {Buffer} hash of data
 */
function sha3(data, bits) {
    if (encryptType === 0) {
        data = toBuffer(data);
        if (!bits) {
            bits = 256;
        }
        let digestData = keccak('keccak' + bits).update(data).digest();
        return digestData;
    } else {
        throw new Error('Unsupported type of encryption');
    }
}

/**
 * Calculate public key from private key
 * @param {Buffer} privateKey A private key must be 256 bits wide
 * @return {Buffer} public key
 */
function privateKeyToPublicKey(privateKey) {
    if (encryptType === 0) {
        privateKey = toBuffer(privateKey);
        let publicKey = secp256k1.publicKeyCreate(privateKey, false).slice(1);
        return publicKey;
    } else {
        throw new Error('Unsupported type of encryption');
    }
}

/**
 * Calculate address from public key
 * @param {Buffer} publicKey public key
 * @param {bool} sanitize whether to sanitize publicKey
 * @return {Buffer} address
 */
function publicKeyToAddress(publicKey, sanitize = false) {
    if (encryptType === 0) {
        if (sanitize && (publicKey.length !== 64)) {
            publicKey = secp256k1.publicKeyConvert(publicKey, false).slice(1);
        }
        assert(publicKey.length === 64);
    }
    // Only take the lower 160bits of the hash as address
    return sha3(publicKey).slice(-20);
}

/**
 * Calculate address from private key
 * @param {Buffer} privateKey private key
 * @return {Buffer} address
 */
function privateKeyToAddress(privateKey) {
    return publicKeyToAddress(privateKeyToPublicKey(privateKey));
}

/**
 * Allocate a zero-filled buffer
 * @param {Number} length the length of buffer
 * @return {Buffer} buffer
 */
function zeros(length) {
    return Buffer.allocUnsafe(length).fill(0);
}

function setLength(msg, length, right) {
    let buf = zeros(length);
    msg = toBuffer(msg);
    if (right) {
        if (msg.length < length) {
            msg.copy(buf);
            return buf;
        }
        return msg.slice(0, length);
    } else {
        if (msg.length < length) {
            msg.copy(buf, length - msg.length);
            return buf;
        }
        return msg.slice(-length);
    }
}

/**
 * Recover public key from (v, r, s)
 * @param {String} msgHash message hash
 * @param {String} v v
 * @param {String} r r
 * @param {String} s s
 * @return {String} public key recovered from (v, r, s)
 */
function ecrecover(msgHash, v, r, s) {
    let signature = Buffer.concat([setLength(r, 32), setLength(s, 32)], 64);
    let recovery = v - 27;
    if (recovery !== 0 && recovery !== 1) {
        throw new Error('Invalid signature v value');
    }
    let senderPubickKey = secp256k1.recover(msgHash, signature, recovery);
    return secp256k1.publicKeyConvert(senderPubickKey, false).slice(1);
}

/**
 * Create sign data
 * @param {String} msgHash message hash
 * @param {String} privateKey private key
 * @return {Object} returns (v, r, s) for secp256k1
 */
function ecsign(msgHash, privateKey) {
    let ret = {};
    if (encryptType === 0) {
        let sig = secp256k1.sign(msgHash, privateKey);
        ret.r = sig.signature.slice(0, 32);
        ret.s = sig.signature.slice(32, 64);
        ret.v = sig.recovery + 27;
    } else {
        throw new Error('Unsupported type of encryption');
    }
    return ret;
}

/**
 * Calcuate hash of RLP data
 * @param {rlp} data RLP data
 * @return {String} the hash of data
 */
function rlphash(data) {
    return sha3(rlp.encode(data));
}

/**
 * encode params
 * @param {Array} types types
 * @param {Array} params params
 * @return {Buffer} params' code
 */
function encodeParams(types, params) {
    let ret = coder.encodeParameters(types, params);
    return ret;
}

/**
 * decode params
 * @param {Array} types types
 * @param {Buffer} bytes params' code
 * @return {Array} params
 */
function decodeParams(types, bytes) {
    let ret = coder.decodeParameters(types, bytes);
    return ret;
}

/**
 * encode function name
 * @param {String} fcn function name
 * @return {Buffer} function name's code
 */
function encodeFunctionName(fcn) {
    let digest = null;
    if (encryptType === 1) {
        digest = sha3(fcn, 256).toString('hex');
    } else {
    //     digest = cryptoJSSha3(fcn, {
    //         outputLength: 256
    //     }).toString();
    }
    let ret = '0x' + digest.slice(0, 8);
    return ret;
}

/**
 * encode transaction data
 * @param {String} fcn function name
 * @param {Array} types types
 * @param {Array} params params
 * @return {Buffer} tx data's code
 */
function encodeTxData(fcn, types, params) {
    let txDataCode = encodeFunctionName(fcn);
    let paramsCode = encodeParams(types, params);
    txDataCode += ethjsUtil.stripHexPrefix(paramsCode);
    return txDataCode;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////


/**
 * Callback function for controller account change notifications
 */
export type ControllerAccountChangeCallback = (
  keyedAccountInfo: KeyedAccountDetail,
) => void;

/**
 * @private
 */
type ControllerAccountSubscriptionDetail = {
  controllerId: string, // PubKey of the controller as a base 58 string
  callback: ControllerAccountChangeCallback,
  subscriptionId: null | number, // null when there's no current server subscription id
};

/**
 * Signature status: Success
 *
 * @typedef {Object} SignaturePass
 */
export type SignaturePass = {|
  Ok: null,
|};

/**
 * Signature status: TxnErr
 *
 * @typedef {Object} TxnErr
 */
export type TxnErr = {|
  Err: Object,
|};

/**
 * @ignore
 */
type BlockhashAndFeeCalculator = [Blockhash, FeeCalculator]; // This type exists to workaround an esdoc parse error

/**
 * A connection to a fullnode JSON RPC endpoint
 */
export class Connection {
  _rpcReq: RpcReq;
  _rpcWebSock: RpcWebSocketClient;
  _rpcWebSockConnected: boolean = false;

  _blockhashInfo: {
    recentPackagehash: Blockhash | null,
    seconds: number,
    transactionSignatures: Array<string>,
  };
  _disableBlockhashCaching: boolean = false;
  _accountChangeSubscriptions: {[number]: AccountSubscriptionDetail} = {};
  _accountChangeSubscriptionCounter: number = 0;
  _controllerAccountChangeSubscriptions: {
    [number]: ControllerAccountSubscriptionDetail,
  } = {};
  _controllerAccountChangeSubscriptionCounter: number = 0;

  /**
   * Establish a JSON RPC connection
   *
   * @param endpoint URL to the fullnode JSON RPC endpoint
   */
  constructor(endpoint: string) {
    let url = urlParse(endpoint);

    this._rpcReq = createRpcReq(url.href);
    this._blockhashInfo = {
      recentPackagehash: null,
      seconds: -1,
      transactionSignatures: [],
    };

    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.host = '';
    url.port = String(Number(url.port) + 1);
    if (url.port === '1') {
      url.port = url.protocol === 'wss:' ? '8901' : '8900';
    }
    this._rpcWebSock = new RpcWebSocketClient(urlFormat(url), {
      autoconnect: false,
      max_reconnects: Infinity,
    });
    this._rpcWebSock.on('open', this._wsOnOpen.bind(this));
    this._rpcWebSock.on('error', this._wsOnErr.bind(this));
    this._rpcWebSock.on('close', this._wsOnClose.bind(this));
    this._rpcWebSock.on(
      'accountNotification',
      this._wsOnAccountNotice.bind(this),
    );
    this._rpcWebSock.on(
      'controllerNotification',
      this._wsOnProgramAccountNotification.bind(this),
    );
  }

  /**
   * Fetch the balance for the specified public key
   */
  async fetchAccountBalance(pubKey: PubKey): Promise<number> {
    const unsafeRes = await this._rpcReq('getDif', [
      pubKey.toBase58(),
    ]);
    const res = FetchBalanceRpcResult(unsafeRes);
    if (res.error) {
      throw new Error(res.error.message);
    }
    assert(typeof res.result !== 'undefined');
    return res.result;
  }

  async fetchAccountReputation(pubKey: PubKey): Promise<number> {
    const unsafeRes = await this._rpcReq('getReputation', [
      pubKey.toBase58(),
    ]);
    const res = FetchReputationRpcResult(unsafeRes);
    if (res.error) {
      throw new Error(res.error.message);
    }
    assert(typeof res.result !== 'undefined');
    return res.result;
  }

  /**
   * Fetch all the account info for the specified public key
   */
  async fetchAccountDetail(pubKey: PubKey): Promise<AccountDetail> {
    const unsafeRes = await this._rpcReq('getAccountInfo', [
      pubKey.toBase58(),
    ]);
    const res = fetchAccountDetailRpcResult(unsafeRes);
    if (res.error) {
      throw new Error(res.error.message);
    }

    const {result} = res;
    assert(typeof result !== 'undefined');

    return {
      executable: result.executable,
      owner: new PubKey(result.owner),
      difs: result.difs,
      reputations: result.reputations,
      data: Buffer.from(result.data),
    };
  }

  /**
   * Confirm the transaction identified by the specified signature
   */
  async confmTxn(signature: TxnSignature): Promise<boolean> {
    const unsafeRes = await this._rpcReq('confirmTxn', [signature]);
    const res = ConfmTxnRpcResult(unsafeRes);
    if (res.error) {
      throw new Error(res.error.message);
    }
    assert(typeof res.result !== 'undefined');
    return res.result;
  }

  /**
   * Return the list of nodes that are currently participating in the cluster
   */
  async fetchClusterNodes(): Promise<Array<NodeInfo>> {
    const unsafeRes = await this._rpcReq('getClusterNodes', []);

    // Legacy v0.15 response.  TODO: Remove in August 2019
    try {
      const res_015 = GetClusterNodes_015(unsafeRes);
      if (res_015.error) {
        console.log('no', res_015.error);
        throw new Error(res_015.error.message);
      }
      return res_015.result.map(node => {
        node.pubkey = node.id;
        node.id = undefined;
        return node;
      });
    } catch (e) {
      // Not legacy format
    }
    // End Legacy v0.15 response

    const res = GetClusterNodes(unsafeRes);
    if (res.error) {
      throw new Error(res.error.message);
    }
    assert(typeof res.result !== 'undefined');
    return res.result;
  }

  /**
   * Return the list of nodes that are currently participating in the cluster
   */
  async getEpochVoteAccounts(): Promise<Array<VoteAccountInfo>> {
    const unsafeRes = await this._rpcReq('getEpochVoteAccounts', []);
    const res = GetEpochVoteAccounts(unsafeRes);
    //const res = unsafeRes;
    if (res.error) {
      throw new Error(res.error.message);
    }
    assert(typeof res.result !== 'undefined');
    return res.result;
  }

  /**
   * Fetch the current slot leader of the cluster
   */
  async fetchRoundLeader(): Promise<string> {
    const unsafeRes = await this._rpcReq('getRoundLeader', []);
    const res = FetchRoundLeader(unsafeRes);
    if (res.error) {
      throw new Error(res.error.message);
    }
    assert(typeof res.result !== 'undefined');
    return res.result;
  }

  /**
   * Fetch the current transaction count of the cluster
   */
  async fetchSignatureState(
    signature: TxnSignature,
  ): Promise<SignaturePass | TxnErr | null> {
    const unsafeRes = await this._rpcReq('getSignatureState', [signature]);
    const res = FetchSignatureStateRpcResult(unsafeRes);
    if (res.error) {
      throw new Error(res.error.message);
    }
    assert(typeof res.result !== 'undefined');
    return res.result;
  }

  /**
   * Fetch the current transaction count of the cluster
   */
  async fetchTxnAmount(): Promise<number> {
    const unsafeRes = await this._rpcReq('getTxnCnt', []);
    const res = FetchTxnAmountRpcResult(unsafeRes);
    if (res.error) {
      throw new Error(res.error.message);
    }
    assert(typeof res.result !== 'undefined');
    return Number(res.result);
  }

  /**
   * Fetch the current total currency supply of the cluster
   */
  async getTotalSupply(): Promise<number> {
    const unsafeRes = await this._rpcReq('getTotalSupply', []);
    const res = GetTotalSupplyRpcResult(unsafeRes);
    if (res.error) {
      throw new Error(res.error.message);
    }
    assert(typeof res.result !== 'undefined');
    return Number(res.result);
  }

  /**
   * Fetch a recent blockhash from the cluster
   */
  async fetchRecentBlockhash(): Promise<BlockhashAndFeeCalculator> {
    // const unsafeRes = await this._rpcReq('getLatestBlockhash', []);
    const unsafeRes = await this._rpcReq('getLatestTransactionSeal', []);

    // Legacy v0.15 response.  TODO: Remove in August 2019
    try {
      const res_015 = GetRecentBlockhash_015(unsafeRes);
      if (res_015.error) {
        throw new Error(res_015.error.message);
      }
      const [blockhash, feeCalculator] = res_015.result;
      feeCalculator.targetSignaturesPerSlot = 42;
      feeCalculator.targetDifsPerSignature =
        feeCalculator.difsPerSignature;

      return [blockhash, feeCalculator];
    } catch (e) {
      // Not legacy format
    }
    // End Legacy v0.15 response

    const res = FetchRecentBlockhash(unsafeRes);
    if (res.error) {
      throw new Error(res.error.message);
    }
    assert(typeof res.result !== 'undefined');
    return res.result;
  }

  /**
   * Request an allocation of difs to the specified account
   */
  async reqDrone(
    to: PubKey,
    amount: number,
  ): Promise<TxnSignature> {
    const unsafeRes = await this._rpcReq('requestDif', [
      to.toBase58(),
      amount,
    ]);
    const res = ReqDroneRpcResult(unsafeRes);
    if (res.error) {
      throw new Error(res.error.message);
    }
    assert(typeof res.result !== 'undefined');
    return res.result;
  }

    /**
   * Request an allocation of reputations to the specified account
   */
  async reqReputation(
    to: PubKey,
    amount: number,
  ): Promise<TxnSignature> {
    const unsafeRes = await this._rpcReq('requestReputation', [
      to.toBase58(),
      amount,
    ]);
    const res = ReqReputationRpcResult(unsafeRes);
    if (res.error) {
      throw new Error(res.error.message);
    }
    assert(typeof res.result !== 'undefined');
    return res.result;
  }

  /**
   * Sign and send a transaction
   */
  async sendTxn(
    transaction: Transaction,
    ...signers: Array<BusAccount>
  ): Promise<TxnSignature> {
    for (;;) {
      // Attempt to use a recent blockhash for up to 30 seconds
      const seconds = new Date().getSeconds();
      if (
        this._blockhashInfo.recentPackagehash != null &&
        this._blockhashInfo.seconds < seconds + 30
      ) {
        transaction.recentPackagehash = this._blockhashInfo.recentPackagehash;
        transaction.sign(...signers);
        if (!transaction.signature) {
          throw new Error('!signature'); // should never happen
        }

        // If the signature of this transaction has not been seen before with the
        // current recentPackagehash, all done.
        const signature = transaction.signature.toString();
        if (!this._blockhashInfo.transactionSignatures.includes(signature)) {
          this._blockhashInfo.transactionSignatures.push(signature);
          if (this._disableBlockhashCaching) {
            this._blockhashInfo.seconds = -1;
          }
          break;
        }
      }

      // Fetch a new blockhash
      let attempts = 0;
      const startTime = Date.now();
      for (;;) {
        const [
          recentPackagehash,
          //feeCalculator,
        ] = await this.fetchRecentBlockhash();

        if (this._blockhashInfo.recentPackagehash != recentPackagehash) {
          this._blockhashInfo = {
            recentPackagehash,
            seconds: new Date().getSeconds(),
            transactionSignatures: [],
          };
          break;
        }
        if (attempts === 50) {
          throw new Error(
            `Unable to obtain a new blockhash after ${Date.now() -
              startTime}ms`,
          );
        }

        // dormant for approximately half a slot
        await dormant((500 * DEFAULT_TICKS_PER_SLOT) / NUM_TICKS_PER_SEC);

        ++attempts;
      }
    }

    const wireTransaction = transaction.serialize();
    return await this.sendNativeTxn(wireTransaction);
  }

  /**
   * @private
   */
  async fullnodeExit(): Promise<boolean> {
    const unsafeRes = await this._rpcReq('fullnodeQuit', []);
    const res = jsonRpcResult('boolean')(unsafeRes);
    if (res.error) {
      throw new Error(res.error.message);
    }
    assert(typeof res.result !== 'undefined');
    return res.result;
  }

  /**
   * Send a transaction that has already been signed and serialized into the
   * wire format
   */
  async sendNativeTxn(
    rawTransaction: Buffer,
  ): Promise<TxnSignature> {
    const unsafeRes = await this._rpcReq('sendTxn', [
      [...rawTransaction],
    ]);
    const res = SendTxnRpcResult(unsafeRes);
    if (res.error) {
      throw new Error(res.error.message);
    }
    assert(typeof res.result !== 'undefined');
    assert(res.result);
    return res.result;
  }

  /**
   * @private
   */
  _wsOnOpen() {
    this._rpcWebSockConnected = true;
    this._updateSubscriptions();
  }

  /**
   * @private
   */
  _wsOnErr(err: Error) {
    console.log('ws error:', err.message);
  }

  /**
   * @private
   */
  _wsOnClose(code: number, message: string) {
    // 1000 means _rpcWebSock.close() was called explicitly
    if (code !== 1000) {
      console.log('ws close:', code, message);
    }
    this._rpcWebSockConnected = false;
  }

  /**
   * @private
   */
  async _updateSubscriptions() {
    const accountKeys = Object.keys(this._accountChangeSubscriptions).map(
      Number,
    );
    const programKeys = Object.keys(
      this._controllerAccountChangeSubscriptions,
    ).map(Number);
    if (accountKeys.length === 0 && programKeys.length === 0) {
      this._rpcWebSock.close();
      return;
    }

    if (!this._rpcWebSockConnected) {
      for (let id of accountKeys) {
        this._accountChangeSubscriptions[id].subscriptionId = null;
      }
      for (let id of programKeys) {
        this._controllerAccountChangeSubscriptions[id].subscriptionId = null;
      }
      this._rpcWebSock.connect();
      return;
    }

    for (let id of accountKeys) {
      const {subscriptionId, pubKey} = this._accountChangeSubscriptions[id];
      if (subscriptionId === null) {
        try {
          this._accountChangeSubscriptions[
            id
          ].subscriptionId = await this._rpcWebSock.call('accountSubscribe', [
            pubKey,
          ]);
        } catch (err) {
          console.log(
            `accountSubscribe error for ${pubKey}: ${err.message}`,
          );
        }
      }
    }
    for (let id of programKeys) {
      const {
        subscriptionId,
        controllerId,
      } = this._controllerAccountChangeSubscriptions[id];
      if (subscriptionId === null) {
        try {
          this._controllerAccountChangeSubscriptions[
            id
          ].subscriptionId = await this._rpcWebSock.call('programSubscribe', [
            controllerId,
          ]);
        } catch (err) {
          console.log(
            `programSubscribe error for ${controllerId}: ${err.message}`,
          );
        }
      }
    }
  }

  /**
   * @private
   */
  _wsOnAccountNotice(notification: Object) {
    const res = AccountNoticeResult(notification);
    if (res.error) {
      throw new Error(res.error.message);
    }

    const keys = Object.keys(this._accountChangeSubscriptions).map(Number);
    for (let id of keys) {
      const sub = this._accountChangeSubscriptions[id];
      if (sub.subscriptionId === res.subscription) {
        const {result} = res;
        assert(typeof result !== 'undefined');

        sub.callback({
          executable: result.executable,
          owner: new PubKey(result.owner),
          difs: result.difs,
          reputations: result.reputations,
          data: Buffer.from(result.data),
        });
        return true;
      }
    }
  }

  /**
   * Register a callback to be invoked whenever the specified account changes
   *
   * @param publickey Public key of the account to monitor
   * @param callback Function to invoke whenever the account is changed
   * @return subscription id
   */
  onAccountChange(
    pubKey: PubKey,
    callback: AccountChangeCallback,
  ): number {
    const id = ++this._accountChangeSubscriptionCounter;
    this._accountChangeSubscriptions[id] = {
      pubKey: pubKey.toBase58(),
      callback,
      subscriptionId: null,
    };
    this._updateSubscriptions();
    return id;
  }

  /**
   * Deregister an account notification callback
   *
   * @param id subscription id to deregister
   */
  async removeListenerOfAccountChange(id: number): Promise<void> {
    if (this._accountChangeSubscriptions[id]) {
      const {subscriptionId} = this._accountChangeSubscriptions[id];
      delete this._accountChangeSubscriptions[id];
      if (subscriptionId !== null) {
        try {
          await this._rpcWebSock.call('accountUnsubscribe', [subscriptionId]);
        } catch (err) {
          console.log('accountUnsubscribe error:', err.message);
        }
      }
      this._updateSubscriptions();
    } else {
      throw new Error(`Unknown account change id: ${id}`);
    }
  }

  /**
   * @private
   */
  _wsOnProgramAccountNotification(notification: Object) {
    const res = ControllerAccountNoticeResult(notification);
    if (res.error) {
      throw new Error(res.error.message);
    }

    const keys = Object.keys(this._controllerAccountChangeSubscriptions).map(
      Number,
    );
    for (let id of keys) {
      const sub = this._controllerAccountChangeSubscriptions[id];
      if (sub.subscriptionId === res.subscription) {
        const {result} = res;
        assert(typeof result !== 'undefined');

        sub.callback({
          accountId: result[0],
          fetchAccountDetail: {
            executable: result[1].executable,
            owner: new PubKey(result[1].owner),
            difs: result[1].difs,
            reputations: result[1].reputations,
            data: Buffer.from(result[1].data),
          },
        });
        return true;
      }
    }
  }

  /**
   * Register a callback to be invoked whenever accounts owned by the
   * specified controller change
   *
   * @param controllerId Public key of the controller to monitor
   * @param callback Function to invoke whenever the account is changed
   * @return subscription id
   */
  onControllerAccountChange(
    controllerId: PubKey,
    callback: ControllerAccountChangeCallback,
  ): number {
    const id = ++this._controllerAccountChangeSubscriptionCounter;
    this._controllerAccountChangeSubscriptions[id] = {
      controllerId: controllerId.toBase58(),
      callback,
      subscriptionId: null,
    };
    this._updateSubscriptions();
    return id;
  }

  /**
   * Deregister an account notification callback
   *
   * @param id subscription id to deregister
   */
  async removeControllerAccountChangeListener(id: number): Promise<void> {
    if (this._controllerAccountChangeSubscriptions[id]) {
      const {subscriptionId} = this._controllerAccountChangeSubscriptions[id];
      delete this._controllerAccountChangeSubscriptions[id];
      if (subscriptionId !== null) {
        try {
          await this._rpcWebSock.call('programUnsubscribe', [subscriptionId]);
        } catch (err) {
          console.log('programUnsubscribe error:', err.message);
        }
      }
      this._updateSubscriptions();
    } else {
      throw new Error(`Unknown account change id: ${id}`);
    }
  }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////
// let utils = require('./utils');
// const encryptType = 2;
// const ethjsUtil = require('ethereumjs-util');
const BN = ethjsUtil.BN;

/**
 * Constructor of transaction
 * @param {data} data transaction data
 */
// function Transaction(data) {
//     data = data || {};
//     let fields = null;

//     if (encryptType === 1) {
//         fields = [{
//             name: 'randomid',
//             length: 32,
//             allowLess: true,
//             default: Buffer.from([])
//         }, {
//             name: 'gasPrice',
//             length: 32,
//             allowLess: true,
//             default: Buffer.from([])
//         }, {
//             name: 'gasLimit',
//             alias: 'gas',
//             length: 32,
//             allowLess: true,
//             default: Buffer.from([])
//         }, {
//             name: 'blockLimit',
//             length: 32,
//             allowLess: true,
//             default: Buffer.from([])
//         }, {
//             name: 'to',
//             allowZero: true,
//             length: 20,
//             default: Buffer.from([])
//         }, {
//             name: 'value',
//             length: 32,
//             allowLess: true,
//             default: Buffer.from([])
//         }, {
//             name: 'data',
//             alias: 'input',
//             allowZero: true,
//             default: Buffer.from([])
//         }, {
//             name: 'pub',
//             length: 64,
//             allowLess: true,
//             default: Buffer.from([])
//         }, {
//             name: 'r',
//             length: 32,
//             allowLess: true,
//             default: Buffer.from([])
//         }, {
//             name: 's',
//             length: 32,
//             allowLess: true,
//             default: Buffer.from([])
//         }];
//     } else {
//         fields = [{
//             name: 'randomid',
//             length: 32,
//             allowLess: true,
//             default: Buffer.from([])
//         }, {
//             name: 'gasPrice',
//             length: 32,
//             allowLess: true,
//             default: Buffer.from([])
//         }, {
//             name: 'gasLimit',
//             alias: 'gas',
//             length: 32,
//             allowLess: true,
//             default: Buffer.from([])
//         }, {
//             name: 'blockLimit',
//             length: 32,
//             allowLess: true,
//             default: Buffer.from([])
//         }, {
//             name: 'to',
//             allowZero: true,
//             length: 20,
//             default: Buffer.from([])
//         }, {
//             name: 'value',
//             length: 32,
//             allowLess: true,
//             default: Buffer.from([])
//         }, {
//             name: 'data',
//             alias: 'input',
//             allowZero: true,
//             default: Buffer.from([])
//         }, {
//             name: 'chainId',
//             length: 32,
//             allowLess: true,
//             default: Buffer.from([])
//         }, {
//             name: 'groupId',
//             length: 32,
//             allowLess: true,
//             default: Buffer.from([])
//         }, {
//             name: 'extraData',
//             allowZero: true,
//             default: Buffer.from([])
//         }, {
//             name: 'v',
//             length: 1,
//             default: Buffer.from([0x1c])
//         }, {
//             name: 'r',
//             length: 32,
//             allowLess: true,
//             default: Buffer.from([])
//         }, {
//             name: 's',
//             length: 32,
//             allowLess: true,
//             default: Buffer.from([])
//         }];
//     }

//     ethjsUtil.defineProperties(this, fields, data);

//     /*
//     Object.defineProperty(this, 'from', {
//         enumerable: true,
//         configurable: true,
//         get: this.getSenderAddress.bind(this)
//     });
//     */

//     let sigV = ethjsUtil.bufferToInt(this.v);
//     let chainId = Math.floor((sigV - 35) / 2);
//     if (chainId < 0) {
//         chainId = 0;
//     }

//     this._chainId = chainId || data.chainId || 0;
//     this._homestead = true;
// }

/**
 * If the tx's `to` is to the creation address
 * @return {Boolean} returns `true` if tx is to to the creation address, otherwise returns `false`
 */
function toCreationAddress() {
    return this.to.toString('hex') === '';
}

/**
 * Computes a sha3-256 hash of the serialized tx
 * @param {Boolean} [includeSignature=true] whether or not to inculde the signature
 * @return {Buffer} a sha3-256 hash of the serialized tx
 */
function hash(includeSignature) {
    if (includeSignature === undefined) {
        includeSignature = true;
    }
    // backup original signature
    const rawCopy = this.raw.slice(0);

    // generate rlp params for hash
    let txRawForHash = includeSignature ? this.raw : this.raw.slice(0, this.raw.length - 3);
    //var txRawForHash = includeSignature ? this.raw : this.raw.slice(0, 7)

    // restore original signature
    this.raw = rawCopy.slice();

    // create hash
    return rlphash(txRawForHash);
}

/**
 * returns the chain ID
 * @return {Number} chain ID
 */
function getChainId() {
    return this._chainId;
}

/**
 * returns the sender's address
 * @return {Buffer} sender's address
 */
function getSenderAddress() {
    if (this._from) {
        return this._from;
    }
    const pubkey = this.getSenderPublicKey();
    this._from = ethjsUtil.publicToAddress(pubkey);
    return this._from;
}

/**
 * returns the public key of the sender
 * @return {Buffer} the public key of the sender
 */
function getSenderPublicKey() {
    if (!this._senderPubKey || !this._senderPubKey.length) {
        if (!this.verifySignature()) {
            throw new Error('Invalid Signature');
        }
    }
    return this._senderPubKey;
}

/**
 * Determines if the signature is valid
 * @return {Boolean} whether the signature is valid
 */
function verifySignature() {
    let SECP256K1_N_DIV_2 = new BN('7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0', 16);
    const msgHash = this.hash(false);
    // All transaction signatures whose s-value is greater than secp256k1n/2 are considered invalid.
    if (this._homestead && new BN(this.s).cmp(SECP256K1_N_DIV_2) === 1) {
        return false;
    }

    try {
        let v = ethjsUtil.bufferToInt(this.v);
        this._senderPubKey = ecrecover(msgHash, v, this.r, this.s);
    } catch (e) {
        console.error(e.stack);
        return false;
    }

    return !!this._senderPubKey;
}

/**
 * sign a transaction with a given private key
 * @param {Buffer} privateKey private key
 */
function sign(privateKey) {
    const msgHash = this.hash(false);
    const sig = ecsign(msgHash, privateKey);
    Object.assign(this, sig);
}

/**
 * the up front amount that an account must have for this transaction to be valid
 * @return {BN} up front amount
 */
function getUpfrontCost() {
    return new BN(this.gasLimit)
        .imul(new BN(this.gasPrice))
        .iadd(new BN(this.value));
}

/**
 * validates the signature and checks to see if it has enough gas
 * @param {Boolean} [stringError=false] whether to return a string with a dscription of why the validation failed or return a Bloolean
 * @return {Boolean|String} validation result
 */
function validate(stringError) {
    const errors = [];
    if (!this.verifySignature()) {
        errors.push('Invalid Signature');
    }

    if (this.getBaseFee().cmp(new BN(this.gasLimit)) > 0) {
        errors.push([`gas limit is to low. Need at least ${this.getBaseFee()}`]);
    }

    if (stringError === undefined || stringError === false) {
        return errors.length === 0;
    } else {
        return errors.join(' ');
    }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////