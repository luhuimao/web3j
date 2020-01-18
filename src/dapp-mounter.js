// @flow



var CNS_PRECOMPILE_ADDRESS = "0x0000000000000000000000000000000000001004";
var CNS_PRECOMPILE_ABI = {
    'selectByName': { "constant": true, "inputs": [{ "name": "name", "type": "string" }], "name": "selectByName", "outputs": [{ "name": "", "type": "string" }], "payable": false, "stateMutability": "view", "type": "function" },
    'selectByNameAndVersion': { "constant": true, "inputs": [{ "name": "name", "type": "string" }, { "name": "version", "type": "string" }], "name": "selectByNameAndVersion", "outputs": [{ "name": "", "type": "string" }], "payable": false, "stateMutability": "view", "type": "function" },
    'insert': { "constant": false, "inputs": [{ "name": "name", "type": "string" }, { "name": "version", "type": "string" }, { "name": "addr", "type": "string" }, { "name": "abi", "type": "string" }], "name": "insert", "outputs": [{ "name": "", "type": "int256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }
};

var CONSENSUS_PRECOMPILE_ADDRESS = '0x0000000000000000000000000000000000001003';
var CONSENSUS_PRECOMPILE_ABI = {
    'addObserver': { "constant": false, "inputs": [{ "name": "nodeID", "type": "string" }], "name": "addObserver", "outputs": [{ "name": "", "type": "int256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" },
    'remove': { "constant": false, "inputs": [{ "name": "nodeID", "type": "string" }], "name": "remove", "outputs": [{ "name": "", "type": "int256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" },
    'addSealer': { "constant": false, "inputs": [{ "name": "nodeID", "type": "string" }], "name": "addSealer", "outputs": [{ "name": "", "type": "int256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }
};

import * as BufferLayout from 'buffer-layout';

import {BvmAcct} from './bvm-acct';
import {BvmAddr} from './bvm-addr';
import {NUM_TICKS_PER_SEC} from './timing';
import {Transaction, PACKET_DATA_SIZE} from './tx-dapp';
import {launchThenAcknowledgeTx} from './launch-then-acknowledge-tx';
import {dormant} from './dormant';
import type {Connection} from './netutility';
import {SystemController} from './sys-dapp';

// const utils = require('../../common/utils');
// const PrecompiledError = require('../../common/exceptions').PrecompiledError;
// const constant = require('./constant');
// const { OutputCode, handleReceipt } = require('../common');
// const { check, string } = require('../../common/typeCheck');
// const ServiceBase = require('../../common/serviceBase').ServiceBase;
// const Web3jService = require('../../web3j').Web3jService;

function spliceFunctionSignature(abi) {
  let functionName = abi.name + '(';
  for (let index in abi.inputs) {
      functionName += abi.inputs[index].type;
      if (index != abi.inputs.length - 1) {
          functionName += ',';
      }
  }
  functionName += ')';
  return functionName;
}

class PrecompiledError extends Error {
    constructor(msg) {
        super(msg);
        this.name = 'PrecompiledError';
    }
}
/*
class ConsensusService extends ServiceBase {
    constructor() {
        super();
        // this.web3jService = new Web3jService();
    }

    resetConfig() {
        super.resetConfig();
        // this.web3jService.resetConfig();
    }

    async _isValidNodeID(nodeID) {
        // return this.web3jService.getNodeIDList().then(result => {
        //     let nodeIDs = result.result;
        //     if (nodeIDs.includes(nodeID)) {
        //         return true;
        //     } else {
        //         return false;
        //     }
        // });
        return nodeID;
    }

    async _send(abi, nodeID) {
        let functionName = spliceFunctionSignature(abi);
        let parameters = [nodeID];
        // let receipt = await this.web3jService.sendRawTransaction(constant.CONSENSUS_PRECOMPILE_ADDRESS, functionName, parameters);
        // return parseInt(handleReceipt(receipt, abi)[0]);
        return parameters;
    }

    async addSealer(nodeID) {
        check(arguments, string);

        let isValid = await this._isValidNodeID(nodeID);
        if (!isValid) {
            throw new PrecompiledError(OutputCode.getOutputMessage(OutputCode.P2PNetwork));
        }

        // let sealers = await this.web3jService.getSealerList();
        // sealers = sealers.result;

        // if (sealers.includes(nodeID)) {
        //     throw new PrecompiledError(OutputCode.getOutputMessage(OutputCode.SealerList));
        // }

        return this._send(constant.CONSENSUS_PRECOMPILE_ABI.addSealer, nodeID);
    }

    async addObserver(nodeID) {
        check(arguments, string);

        let isValid = await this._isValidNodeID(nodeID);
        if (!isValid) {
            throw new PrecompiledError(OutputCode.getOutputMessage(OutputCode.P2PNetwork));
        }

        // let observers = await this.web3jService.getObserverList();
        // observers = observers.result;

        // if (observers.includes(nodeID)) {
        //     throw new PrecompiledError(OutputCode.getOutputMessage(OutputCode.ObserverList));
        // }

        return this._send(constant.CONSENSUS_PRECOMPILE_ABI.addObserver, nodeID);
    }

    async removeNode(nodeID) {
        check(arguments, string);

        // let peers = await this.web3jService.getGroupPeers();
        // peers = peers.result;

        // if (!peers.includes(nodeID)) {
        //     throw new PrecompiledError(OutputCode.getOutputMessage(OutputCode.GroupPeers));
        // }

        return this._send(constant.CONSENSUS_PRECOMPILE_ABI.remove, nodeID);
    }
}
*/

/**
 * Controller loader interface
 */
export class ControllerLoader {
  /**
   * Amount of controller data placed in each load Transaction
   */
  static get chunkSize(): number {
    // Keep controller chunks under PACKET_DATA_SIZE, leaving enough room for the
    // rest of the Transaction fields
    //
    // TODO: replace 300 with a proper constant for the size of the other
    // Transaction fields
    return PACKET_DATA_SIZE - 300;
  }

  /**
   * Loads a generic controller
   *
   * @param connection The connection to use
   * @param payer System account that pays to load the controller
   * @param controller BvmAcct to load the controller into
   * @param controllerId Bvm Address that identifies the loader
   * @param data controller octets
   */
  static async load(
    connection: Connection,
    payer: BvmAcct,
    controller: BvmAcct,
    controllerId: BvmAddr,
    data: Array<number>,
  ): Promise<BvmAddr> {
    {
      const transaction = SystemController.createNewAccount(
        payer.pubKey,
        controller.pubKey,
        1,
        0,
        data.length,
        controllerId,
      );
      await launchThenAcknowledgeTx(connection, transaction, payer);
    }

    const dataLayout = BufferLayout.struct([
      BufferLayout.u32('instruction'),
      BufferLayout.u32('offset'),
      BufferLayout.u32('bytesLength'),
      BufferLayout.u32('bytesLengthPadding'),
      BufferLayout.seq(
        BufferLayout.u8('byte'),
        BufferLayout.offset(BufferLayout.u32(), -8),
        'bytes',
      ),
    ]);

    const chunkSize = ControllerLoader.chunkSize;
    let offset = 0;
    let array = data;
    let transactions = [];
    while (array.length > 0) {
      const bytes = array.slice(0, chunkSize);
      const data = Buffer.alloc(chunkSize + 16);
      dataLayout.encode(
        {
          instruction: 0, // Load instruction
          offset,
          bytes,
        },
        data,
      );

      const transaction = new Transaction().add({
        keys: [{pubkey: controller.pubKey, isSigner: true, isDebitable: true}],
        controllerId,
        data,
      });
      transactions.push(
        launchThenAcknowledgeTx(connection, transaction, payer, controller),
      );

      // Delay ~1 tick between write transactions in an attempt to reduce AccountInUse errors
      // since all the write transactions modify the same controller account
      await dormant(1000 / NUM_TICKS_PER_SEC);

      // Run up to 8 Loads in parallel to prevent too many parallel transactions from
      // getting rejected with AccountInUse.
      //
      // TODO: 8 was selected empirically and should probably be revisited
      if (transactions.length === 8) {
        await Promise.all(transactions);
        transactions = [];
      }

      offset += chunkSize;
      array = array.slice(chunkSize);
    }
    await Promise.all(transactions);

    // Finalize the account loaded with controller data for execution
    {
      const dataLayout = BufferLayout.struct([BufferLayout.u32('instruction')]);

      const data = Buffer.alloc(dataLayout.span);
      dataLayout.encode(
        {
          instruction: 1, // Finalize instruction
        },
        data,
      );

      const transaction = new Transaction().add({
        keys: [{pubkey: controller.pubKey, isSigner: true, isDebitable: true}],
        controllerId,
        data,
      });
      await launchThenAcknowledgeTx(connection, transaction, payer, controller);
    }
    return controller.pubKey;
  }
}


class OutputCode {
    static getOutputMessage(output) {
        let message = '';
        switch (output) {
            case this.Success:
                message = 'success';
                break;
            case this.PermissionDenied:
                message = 'permission denied';
                break;
            case this.TableExist:
                message = 'table name already exist';
                break;
            case this.TableNameAndAddressExist:
                message = 'table name and address already exist';
                break;
            case this.TableNameAndAddressNotExist:
                message = 'table name and address does not exist';
                break;
            case this.InvalidNodeId:
                message = 'invalid node ID';
                break;
            case this.LastSealer:
                message = 'the last sealer cannot be removed';
                break;
            case this.P2PNetwork:
                message = 'the node is not reachable';
                break;
            case this.GroupPeers:
                message = 'the node is not a group peer';
                break;
            case this.SealerList:
                message = 'the node is already in the sealer list';
                break;
            case this.ObserverList:
                message = 'the node is already in the observer list';
                break;
            case this.ContractNameAndVersionExist:
                message = 'contract name and version already exist';
                break;
            case this.VersionExceeds:
                message = 'version string length exceeds the maximum limit';
                break;
            case this.InvalidKey:
                message = 'invalid configuration entry';
                break;
            default:
                message = `unknown output code:${output}`;
                break;
        }

        return message;
    }
}

OutputCode.Success = 0;
OutputCode.PermissionDenied = -50000;
OutputCode.TableExist = -50001;
OutputCode.TableNameAndAddressExist = -51000;
OutputCode.TableNameAndAddressNotExist = -51001;
OutputCode.InvalidNodeId = -51100;
OutputCode.LastSealer = -51101;
OutputCode.P2PNetwork = -51102;
OutputCode.GroupPeers = -51103;
OutputCode.SealerList = -51104;
OutputCode.ObserverList = -51105;
OutputCode.ContractNameAndVersionExist = -51200;
OutputCode.VersionExceeds = -51201;
OutputCode.InvalidKey = -51300;


class ServiceBase {
  constructor() {
      this._config = undefined;

      Object.defineProperty(this, 'config', {
          enumerable: true,
          configurable: false,
          get: () => {
              if (!this._config) {
                  // this._config = Configuration.getInstance();
              }
              return this._config;
          },
          set: (config) => {
              this._config = config;
          }
      });
  }

  resetConfig() {
      // this.config = Configuration.getInstance();
  }
}

var type_number = 0;
var type_string = 1;
var type_object = 2;
var type_boolean = 3;

var _types = {
    [type_number]: 'number',
    [type_string]: 'string',
    [type_object]: 'object',
    [type_boolean]: 'boolean'
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