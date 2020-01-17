'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var _regeneratorRuntime = _interopDefault(require('@babel/runtime/regenerator'));
var _asyncToGenerator = _interopDefault(require('@babel/runtime/helpers/asyncToGenerator'));
var _defineProperty = _interopDefault(require('@babel/runtime/helpers/defineProperty'));
var _classCallCheck = _interopDefault(require('@babel/runtime/helpers/classCallCheck'));
var _createClass = _interopDefault(require('@babel/runtime/helpers/createClass'));
var nacl = _interopDefault(require('tweetnacl'));
var BN$1 = _interopDefault(require('bn.js'));
var bs58 = _interopDefault(require('bs58'));
require('fs');
require('path');
var _typeof = _interopDefault(require('@babel/runtime/helpers/typeof'));
var _possibleConstructorReturn = _interopDefault(require('@babel/runtime/helpers/possibleConstructorReturn'));
var _getPrototypeOf = _interopDefault(require('@babel/runtime/helpers/getPrototypeOf'));
var _inherits = _interopDefault(require('@babel/runtime/helpers/inherits'));
var _wrapNativeSuper = _interopDefault(require('@babel/runtime/helpers/wrapNativeSuper'));
var BufferLayout = require('buffer-layout');
var _toConsumableArray = _interopDefault(require('@babel/runtime/helpers/toConsumableArray'));
var assert$3 = _interopDefault(require('assert'));
var underscore = _interopDefault(require('underscore'));
var _slicedToArray = _interopDefault(require('@babel/runtime/helpers/slicedToArray'));
var url = require('url');
var fetch = _interopDefault(require('node-fetch'));
var jayson = _interopDefault(require('jayson/lib/client/browser'));
var superstruct = require('superstruct');
var rpcWebsockets = require('rpc-websockets');
var _get = _interopDefault(require('@babel/runtime/helpers/get'));

var request = require("request");

var AbiCoder = require('web3-eth-abi'); // const abiCoder = new AbiCoder.AbiCoder();


var Web3 = require('web3');

var Promise$1 = require("bluebird");

var truffle_Contract = require('truffle-contract');

var assert = require('assert'); // const tracer = require('./EVM2Code');


var fs = require('fs');

var locks = require('locks'); // mutex


var mutex = locks.createMutex();

var async = require('async');

var httpRpcAddr = "http://localhost:8546";
var Provider = new Web3.providers.HttpProvider(httpRpcAddr);
var web3 = new Web3(new Web3.providers.HttpProvider(httpRpcAddr));
var g_account_list = web3.eth.accounts;
var g_from_account = g_account_list[0]; /// unlock initial user, which is also miner account

function setCharAt(str, index, chr) {
  if (index > str.length - 1) return str;
  return str.substr(0, index) + chr + str.substr(index + 1);
}

function transform(id) {
  var newStr = id;

  if (typeof id === 'string') {
    for (var i = 0; i < newStr.length; i++) {
      // console.log(newStr.charAt(i));
      if (newStr.charAt(i) === '0') {
        newStr = setCharAt(newStr, i, 'X2');
      } else if (newStr.charAt(i) === 'O') {
        newStr = setCharAt(newStr, i, 'X1');
      } else if (newStr.charAt(i) === 'I') {
        newStr = setCharAt(newStr, i, 'X3');
      } else if (newStr.charAt(i) === 'l') {
        newStr = setCharAt(newStr, i, 'X4');
      }
    }
  } else {
    throw new Error("can't transform a not string type value");
  }

  return newStr;
}

function reverse(id) {
  var originalStr = id;

  if (typeof id === 'string') {
    for (var i = 0; i < originalStr.length; i++) {
      if (originalStr.includes("X2")) {
        originalStr = originalStr.replace(/X2/g, "0");
      } else if (originalStr.includes("X1")) {
        originalStr = originalStr.replace(/X1/g, "O");
      } else if (originalStr.includes("X3")) {
        originalStr = originalStr.replace(/X3/g, "I");
      } else if (originalStr.includes("X4")) {
        originalStr = originalStr.replace(/X4/g, "l");
      }
    }
  } else {
    throw new Error("can't transform a not string type value");
  }

  return originalStr;
}
/**
 * A bvm address
 */


var BvmAddr =
/*#__PURE__*/
function () {
  /**
   * Create a new BvmAddr object
   */
  function BvmAddr(value) {
    _classCallCheck(this, BvmAddr);

    _defineProperty(this, "_bn", void 0);

    if (typeof value === 'string') {
      // hexadecimal number
      if (value.startsWith('0x')) {
        this._bn = new BN$1(value.substring(2), 16);
      } else {
        // assume base 58 encoding by default
        var newstr = transform(value);
        this._bn = new BN$1(bs58.decode(newstr));
      }
    } else {
      this._bn = new BN$1(value);
    }

    if (this._bn.byteLength() > 32) {
      throw new Error("Invalid bvm address input");
    }
  }
  /**
   * Checks if the provided object is a BvmAddr
   */


  _createClass(BvmAddr, [{
    key: "checkIfEquals",

    /**
     * Checks if two bvm addresses are equal
     */
    value: function checkIfEquals(bvmaddr) {
      return this._bn.eq(bvmaddr._bn);
    }
    /**
     * Return the base-58 representation of the bvm address
     */

  }, {
    key: "converseToBase58",
    value: function converseToBase58() {
      return bs58.encode(this.converseToBuffer());
    }
    /**
     * Return the Buffer representation of the bvm address
     */

  }, {
    key: "converseToBuffer",
    value: function converseToBuffer() {
      var bign = this._bn.toArrayLike(Buffer);

      if (bign.length === 32) {
        return bign;
      }

      var zeroPad = Buffer.alloc(32);
      bign.copy(zeroPad, 32 - bign.length);
      return zeroPad;
    }
    /**
     * Returns a string representation of the bvm address
     */

  }, {
    key: "converseToString",
    value: function converseToString() {
      return reverse(this.converseToBase58()); // return this.converseToBase58();
    }
  }], [{
    key: "isBvmAddr",
    value: function isBvmAddr(o) {
      return o instanceof BvmAddr;
    }
  }]);

  return BvmAddr;
}(); // web3 abstractions

/**
 * An account key pair (public and secret keys).
 */


var BvmAcct =
/*#__PURE__*/
function () {
  /**
   * Create a new BvmAcct object
   *
   * If the privateKey parameter is not provided a new key pair is randomly
   * created for the account
   *
   * @param privateKey Secret key for the account
   */
  function BvmAcct() {
    var privateKey = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

    _classCallCheck(this, BvmAcct);

    _defineProperty(this, "_keypair", void 0);

    if (privateKey) {
      this._keypair = nacl.sign.keyPair.fromSecretKey(privateKey);
    } else {
      this._keypair = nacl.sign.keyPair();
    }
  }
  /**
   * The public key for this account
   */


  _createClass(BvmAcct, [{
    key: "pubKey",
    get: function get() {
      return new BvmAddr(this._keypair.publicKey);
    }
    /**
     * The **unencrypted** secret key for this account
     */

  }, {
    key: "privateKey",
    get: function get() {
      return this._keypair.secretKey;
    }
  }]);

  return BvmAcct;
}(); // static getRawTransaction(cursor) {

/// conver scientific number to string
/**
 * @ignore
 */


var NUM_TICKS_PER_SEC = 10; // tracer abstractions at instruction level
/**
 * @ignore
 */

var DEFAULT_TICKS_PER_SLOT = 8; /// the maximum length of seed_callSequence

/**
 * Layout for a bvm address
 */

var pubKey = function pubKey() {
  var property = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'pubKey';
  return BufferLayout.blob(32, property);
}; /// the mutation operation for uint neighbor
/**
 * Layout for a 64bit unsigned value
 */

var uint64 = function uint64() {
  var property = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'uint64';
  return BufferLayout.blob(8, property);
};
/**
 * Layout for a Rust String type
 */

var rustString = function rustString() {
  var property = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'string';
  var rsl = BufferLayout.struct([BufferLayout.u32('length'), BufferLayout.u32('lengthPadding'), BufferLayout.blob(BufferLayout.offset(BufferLayout.u32(), -8), 'chars')], property);

  var _decode = rsl.decode.bind(rsl);

  var _encode = rsl.encode.bind(rsl);

  rsl.decode = function (buffer, offset) {
    var data = _decode(buffer, offset);

    return data.chars.toString('utf8');
  };

  rsl.encode = function (str, buffer, offset) {
    var data = {
      chars: Buffer.from(str, 'utf8')
    };
    return _encode(data, buffer, offset);
  };

  return rsl;
};

// var util = require('util');
// var _ = require('underscore');
// var clc = require('cli-color');
// var moment = require('moment');
// import  RpcClient from './rpc-client' ;
// var logger = require('bunyan').createLogger({
//     name: 'RpcClient',
//     level: 'trace'
// });
// function inspect(obj) {
//     return obj ? util.inspect(obj, {
//         depth: null
//     }) : '';
// }
// function printResult(error, result) {
//     console.log(clc.red(inspect(error)));
//     console.log(clc.cyan(inspect(result)));
// }
// function printJsonResult(error, result) {
//     console.log(clc.red(inspect(error)));
//     var output = result;
//     try {
//         output = JSON.parse(result);
//     } catch (err) {
//         // use default
//     }
//     console.log(clc.cyan(inspect(output)));
// }
// var context = 'OR CPRS GUI CHART';
// var configuration = {
//     context: 'HMP UI CONTEXT',
//     host: 'IP        ',
//     port: 2222,
//     accessCode: 'REDACTED',
//     verifyCode: 'REDACTED',
//     localIP: 'IP      ',
//     localAddress: 'localhost'
// };
Object.defineProperty(exports, "__esModule", {
  value: true
});

var buffer_1 = require("buffer");

var BufferUtil =
/*#__PURE__*/
function () {
  function BufferUtil() {
    _classCallCheck(this, BufferUtil);
  }

  _createClass(BufferUtil, null, [{
    key: "fromHex",
    value: function fromHex(source) {
      var data = source.match(/.{1,2}/g).map(function (x) {
        return parseInt(x, 16);
      });
      return new Uint8Array(data);
    }
  }, {
    key: "fromBase64",
    value: function fromBase64(source) {
      return Uint8Array.from(buffer_1.Buffer.from(source, 'base64'));
    }
  }, {
    key: "fromString",
    value: function fromString(source) {
      var buffer = new ArrayBuffer(source.length);
      var view = new DataView(buffer);

      for (var i = 0; i < source.length; i++) {
        view.setUint8(i, source.charCodeAt(i));
      }

      return new Uint8Array(buffer);
    }
  }, {
    key: "toString",
    value: function toString(source) {
      var data = [];
      source.forEach(function (x) {
        data.push(String.fromCharCode(x));
      });
      return data.join('');
    }
  }, {
    key: "toHex",
    value: function toHex(sources) {
      var data = [];
      sources.forEach(function (x) {
        data.push(x.toString(16).padStart(2, '0'));
      });
      return data.join('');
    }
  }, {
    key: "toBase64",
    value: function toBase64(sources) {
      return buffer_1.Buffer.from(sources).toString('base64');
    }
  }, {
    key: "concat",
    value: function concat(a, b) {
      var c = new Uint8Array(a.length + b.length);
      c.set(a);
      c.set(b, a.length);
      return c;
    }
  }]);

  return BufferUtil;
}();

exports.BufferUtil = BufferUtil;
/*
decode an array of number and return it's length.
 */

function getDecodedArrayLength(bytes) {
  var len_to_return = 0;
  var size = 0;

  for (;;) {
    var elem_of_array = bytes.shift();
    len_to_return |= (elem_of_array & 0x7f) << size * 7;
    size += 1;

    if ((elem_of_array & 0x80) === 0) {
      break;
    }
  }

  return len_to_return;
}
/*
encode an array of number. 
*/

function encodeArrayWithInteger(bytes, len) {
  var new_len = len;

  for (;;) {
    var new_elem = new_len & 0x7f;
    new_len >>= 7;

    if (new_len == 0) {
      bytes.push(new_elem);
      break;
    } else {
      new_elem |= 0x80;
      bytes.push(new_elem);
    }
  }
} // Object.defineProperty(exports, "__esModule", { value: true });

exports.CollectionUtil = {
  binarySearch: function binarySearch(sortedArray, item) {
    var lowIdx = 0;
    var highIdx = sortedArray.length - 1;

    while (lowIdx <= highIdx) {
      var midIdx = Math.floor((lowIdx + highIdx) / 2);

      if (sortedArray[midIdx] === item) {
        return midIdx;
      } else if (sortedArray[midIdx] < item) {
        lowIdx = midIdx + 1;
      } else {
        highIdx = midIdx - 1;
      }
    }

    return null;
  }
};
exports["default"] = exports.CollectionUtil;

/**
 * Maximum over-the-wire size of a Transaction
 *
 * 1280 is IPv6 minimum MTU
 * 40 bytes is the size of the IPv6 header
 * 8 bytes is the size of the fragment header
 */
var PACKET_DATA_SIZE = 1280 - 40 - 8;
/**
 * List of TxOperation object fields that may be initialized at construction
 *
 * @typedef {Object} TxInstructionControlFields
 * @property {?Array<BvmAddr>} keys
 * @property {?BvmAddr} controllerId
 * @property {?Buffer} data
 */

/**
 * Transaction Instruction class
 */
var TxOperation =
/**
 * Public keys to include in this transaction
 * Boolean represents whether this pubkey needs to sign the transaction
 */

/**
 * Controller Id to execute
 */

/**
 * Controller input
 */
function TxOperation(opts) {
  _classCallCheck(this, TxOperation);

  _defineProperty(this, "keys", []);

  _defineProperty(this, "controllerId", void 0);

  _defineProperty(this, "data", Buffer.alloc(0));

  opts && Object.assign(this, opts);
}; /////////////////////////////////////////////////////////////////////////////////////////

/**
 * Transaction class
 */
var Transaction =
/*#__PURE__*/
function () {
  _createClass(Transaction, [{
    key: "signature",

    /**
     * Signatures for the transaction.  Typically created by invoking the
     * `sign()` method
     */

    /**
     * The first (payer) Transaction signature
     */
    get: function get() {
      if (this.signatures.length > 0) {
        return this.signatures[0].signature;
      }

      return null;
    }
    /**
     * The operations to atomically execute
     */

  }]);

  /**
   * Construct an empty Transaction
   */
  function Transaction(opts) {
    _classCallCheck(this, Transaction);

    _defineProperty(this, "signatures", []);

    _defineProperty(this, "operations", []);

    _defineProperty(this, "recentPackagehash", void 0);

    opts && Object.assign(this, opts);
  }
  /**
   * Add one or more operations to this Transaction
   */


  _createClass(Transaction, [{
    key: "add",
    value: function add() {
      var _this = this;

      for (var _len = arguments.length, items = new Array(_len), _key = 0; _key < _len; _key++) {
        items[_key] = arguments[_key];
      }

      if (items.length === 0) {
        throw new Error('No operations');
      }

      items.forEach(function (item) {
        if (item instanceof Transaction) {
          _this.operations = _this.operations.concat(item.operations);
        } else if (item instanceof TxOperation) {
          _this.operations.push(item);
        } else {
          _this.operations.push(new TxOperation(item));
        }
      });
      return this;
    }
    /**
     * @private
     */

  }, {
    key: "_fetchSignData",
    value: function _fetchSignData() {
      var recentPackagehash = this.recentPackagehash;

      if (!recentPackagehash) {
        throw new Error('Transaction recentPackagehash required');
      }

      if (this.operations.length < 1) {
        throw new Error('No operations provided');
      }

      var keys = this.signatures.map(function (_ref) {
        var pubKey = _ref.pubKey;
        return pubKey.converseToString();
      });
      var numRequiredSignatures = 0;
      var numCreditOnlySignedAccounts = 0;
      var numCreditOnlyUnsignedAccounts = 0;
      var programIds = [];
      this.operations.forEach(function (instruction) {
        instruction.keys.forEach(function (keySignerPair) {
          var keyStr = keySignerPair.pubkey.converseToString();

          if (!keys.includes(keyStr)) {
            if (keySignerPair.isSigner) {
              numRequiredSignatures += 1;

              if (!keySignerPair.isDebitable) {
                numCreditOnlySignedAccounts += 1;
              }
            } else {
              if (!keySignerPair.isDebitable) {
                numCreditOnlyUnsignedAccounts += 1;
              }
            }

            keys.push(keyStr);
          }
        });
        var controllerId = instruction.controllerId.converseToString();

        if (!programIds.includes(controllerId)) {
          programIds.push(controllerId);
        }
      });
      programIds.forEach(function (controllerId) {
        if (!keys.includes(controllerId)) {
          keys.push(controllerId);
          numCreditOnlyUnsignedAccounts += 1;
        }
      });

      if (numRequiredSignatures > this.signatures.length) {
        throw new Error("Insufficent signatures: expected ".concat(numRequiredSignatures, " but got ").concat(this.signatures.length));
      }

      var keyCount = [];
      encodeArrayWithInteger(keyCount, keys.length);
      var operations = this.operations.map(function (instruction) {
        var data = instruction.data,
            controllerId = instruction.controllerId;
        var keyIndicesCount = [];
        encodeArrayWithInteger(keyIndicesCount, instruction.keys.length);
        var dataCount = [];
        encodeArrayWithInteger(dataCount, instruction.data.length);
        return {
          programIdIndex: keys.indexOf(controllerId.converseToString()),
          keyIndicesCount: Buffer.from(keyIndicesCount),
          keyIndices: Buffer.from(instruction.keys.map(function (keyObj) {
            return keys.indexOf(keyObj.pubkey.converseToString());
          })),
          dataLength: Buffer.from(dataCount),
          data: data
        };
      });
      operations.forEach(function (instruction) {
        assert$3(instruction.programIdIndex >= 0);
        instruction.keyIndices.forEach(function (keyIndex) {
          return assert$3(keyIndex >= 0);
        });
      });
      var instructionCount = [];
      encodeArrayWithInteger(instructionCount, operations.length);
      var instructionBuffer = Buffer.alloc(PACKET_DATA_SIZE);
      Buffer.from(instructionCount).copy(instructionBuffer);
      var instructionBufferLength = instructionCount.length;
      operations.forEach(function (instruction) {
        var instructionLayout = BufferLayout.struct([BufferLayout.u8('programIdIndex'), BufferLayout.blob(instruction.keyIndicesCount.length, 'keyIndicesCount'), BufferLayout.seq(BufferLayout.u8('keyIndex'), instruction.keyIndices.length, 'keyIndices'), BufferLayout.blob(instruction.dataLength.length, 'dataLength'), BufferLayout.seq(BufferLayout.u8('userdatum'), instruction.data.length, 'data')]);
        var length = instructionLayout.encode(instruction, instructionBuffer, instructionBufferLength);
        instructionBufferLength += length;
      });
      instructionBuffer = instructionBuffer.slice(0, instructionBufferLength);
      var signDataLayout = BufferLayout.struct([BufferLayout.blob(1, 'numRequiredSignatures'), BufferLayout.blob(1, 'numCreditOnlySignedAccounts'), BufferLayout.blob(1, 'numCreditOnlyUnsignedAccounts'), BufferLayout.blob(keyCount.length, 'keyCount'), BufferLayout.seq(pubKey('key'), keys.length, 'keys'), pubKey('recentPackagehash')]);
      var transaction = {
        numRequiredSignatures: Buffer.from([this.signatures.length]),
        numCreditOnlySignedAccounts: Buffer.from([numCreditOnlySignedAccounts]),
        numCreditOnlyUnsignedAccounts: Buffer.from([numCreditOnlyUnsignedAccounts]),
        keyCount: Buffer.from(keyCount),
        keys: keys.map(function (key) {
          return new BvmAddr(key).converseToBuffer();
        }),
        recentPackagehash: Buffer.from(bs58.decode(recentPackagehash))
      };
      var signData = Buffer.alloc(2048);
      var length = signDataLayout.encode(transaction, signData);
      instructionBuffer.copy(signData, length);
      signData = signData.slice(0, length + instructionBuffer.length);
      return signData;
    }
    /**
     * Sign the Transaction with the specified accounts.  Multiple signatures may
     * be applied to a Transaction. The first signature is considered "primary"
     * and is used when testing for Transaction confirmation.
     *
     * Transaction fields should not be modified after the first call to `sign`,
     * as doing so may invalidate the signature and cause the Transaction to be
     * rejected.
     *
     * The Transaction must be assigned a valid `recentPackagehash` before invoking this method
     */

  }, {
    key: "sign",
    value: function sign() {
      this.signPartial.apply(this, arguments);
    }
    /**
     * Partially sign a Transaction with the specified accounts.  The `BvmAcct`
     * inputs will be used to sign the Transaction immediately, while any
     * `BvmAddr` inputs will be referenced in the signed Transaction but need to
     * be filled in later by calling `addSigner()` with the matching `BvmAcct`.
     *
     * All the caveats from the `sign` method apply to `signPartial`
     */

  }, {
    key: "signPartial",
    value: function signPartial() {
      for (var _len2 = arguments.length, partialSigners = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        partialSigners[_key2] = arguments[_key2];
      }

      if (partialSigners.length === 0) {
        throw new Error('No signers');
      }

      var signatures = partialSigners.map(function (accountOrPublicKey) {
        var pubKey = accountOrPublicKey instanceof BvmAcct ? accountOrPublicKey.pubKey : accountOrPublicKey;
        return {
          signature: null,
          pubKey: pubKey
        };
      });
      this.signatures = signatures;

      var signData = this._fetchSignData();

      partialSigners.forEach(function (accountOrPublicKey, index) {
        if (accountOrPublicKey instanceof BvmAddr) {
          return;
        }

        var signature = nacl.sign.detached(signData, accountOrPublicKey.privateKey);
        assert$3(signature.length === 64);
        signatures[index].signature = Buffer.from(signature);
      });
    }
    /**
     * Fill in a signature for a partially signed Transaction.  The `signer` must
     * be the corresponding `BvmAcct` for a `BvmAddr` that was previously provided to
     * `signPartial`
     */

  }, {
    key: "addSigner",
    value: function addSigner(signer) {
      var index = this.signatures.findIndex(function (sigpair) {
        return signer.pubKey.checkIfEquals(sigpair.pubKey);
      });

      if (index < 0) {
        throw new Error("Unknown signer: ".concat(signer.pubKey.converseToString()));
      }

      var signData = this._fetchSignData();

      var signature = nacl.sign.detached(signData, signer.privateKey);
      assert$3(signature.length === 64);
      this.signatures[index].signature = Buffer.from(signature);
    }
    /**
     * Serialize the Transaction in the wire format.
     *
     * The Transaction must have a valid `signature` before invoking this method
     */

  }, {
    key: "serialize",
    value: function serialize() {
      var signatures = this.signatures;

      if (!signatures) {
        throw new Error('Transaction has not been signed');
      }

      var signData = this._fetchSignData();

      var signatureCount = [];
      encodeArrayWithInteger(signatureCount, signatures.length);
      var transactionLength = signatureCount.length + signatures.length * 64 + signData.length;
      var wireTransaction = Buffer.alloc(transactionLength);
      assert$3(signatures.length < 256);
      Buffer.from(signatureCount).copy(wireTransaction, 0);
      signatures.forEach(function (_ref2, index) {
        var signature = _ref2.signature;
        assert$3(signature !== null, "null signature");
        assert$3(signature.length === 64, "signature has invalid length");
        Buffer.from(signature).copy(wireTransaction, signatureCount.length + index * 64);
      });
      signData.copy(wireTransaction, signatureCount.length + signatures.length * 64);
      assert$3(wireTransaction.length <= PACKET_DATA_SIZE, "Transaction too large: ".concat(wireTransaction.length, " > ").concat(PACKET_DATA_SIZE));
      return wireTransaction;
    }
    /**
     * Deprecated method
     * @private
     */

  }, {
    key: "keys",
    get: function get() {
      assert$3(this.operations.length === 1);
      return this.operations[0].keys.map(function (keyObj) {
        return keyObj.pubkey;
      });
    }
    /**
     * Deprecated method
     * @private
     */

  }, {
    key: "controllerId",
    get: function get() {
      assert$3(this.operations.length === 1);
      return this.operations[0].controllerId;
    }
    /**
     * Deprecated method
     * @private
     */

  }, {
    key: "data",
    get: function get() {
      assert$3(this.operations.length === 1);
      return this.operations[0].data;
    }
    /**
     * Parse a wire transaction into a Transaction object.
     */

  }], [{
    key: "from",
    value: function from(buffer) {
      var PUBKEY_LENGTH = 32;
      var SIGNATURE_LENGTH = 64;

      function isCreditDebit(i, numRequiredSignatures, numCreditOnlySignedAccounts, numCreditOnlyUnsignedAccounts, numKeys) {
        return i < numRequiredSignatures - numCreditOnlySignedAccounts || i >= numRequiredSignatures && i < numKeys - numCreditOnlyUnsignedAccounts;
      }

      var transaction = new Transaction(); // Slice up wire data

      var byteArray = _toConsumableArray(buffer);

      var signatureCount = getDecodedArrayLength(byteArray);
      var signatures = [];

      for (var i = 0; i < signatureCount; i++) {
        var signature = byteArray.slice(0, SIGNATURE_LENGTH);
        byteArray = byteArray.slice(SIGNATURE_LENGTH);
        signatures.push(signature);
      }

      var numRequiredSignatures = byteArray.shift(); // byteArray = byteArray.slice(1); // Skip numRequiredSignatures byte

      var numCreditOnlySignedAccounts = byteArray.shift(); // byteArray = byteArray.slice(1); // Skip numCreditOnlySignedAccounts byte

      var numCreditOnlyUnsignedAccounts = byteArray.shift(); // byteArray = byteArray.slice(1); // Skip numCreditOnlyUnsignedAccounts byte

      var accountCount = getDecodedArrayLength(byteArray);
      var accounts = [];

      for (var _i = 0; _i < accountCount; _i++) {
        var account = byteArray.slice(0, PUBKEY_LENGTH);
        byteArray = byteArray.slice(PUBKEY_LENGTH);
        accounts.push(account);
      }

      var recentPackagehash = byteArray.slice(0, PUBKEY_LENGTH);
      byteArray = byteArray.slice(PUBKEY_LENGTH);
      var instructionCount = getDecodedArrayLength(byteArray);
      var operations = [];

      for (var _i2 = 0; _i2 < instructionCount; _i2++) {
        var instruction = {};
        instruction.programIndex = byteArray.shift();
        var accountIndexCount = getDecodedArrayLength(byteArray);
        instruction.accountIndex = byteArray.slice(0, accountIndexCount);
        byteArray = byteArray.slice(accountIndexCount);
        var dataLength = getDecodedArrayLength(byteArray);
        instruction.data = byteArray.slice(0, dataLength);
        byteArray = byteArray.slice(dataLength);
        operations.push(instruction);
      } // Populate Transaction object


      transaction.recentPackagehash = new BvmAddr(recentPackagehash).converseToBase58();

      for (var _i3 = 0; _i3 < signatureCount; _i3++) {
        var sigPubkeyPair = {
          signature: Buffer.from(signatures[_i3]),
          pubKey: new BvmAddr(accounts[_i3])
        };
        transaction.signatures.push(sigPubkeyPair);
      }

      for (var _i4 = 0; _i4 < instructionCount; _i4++) {
        var instructionData = {
          keys: [],
          controllerId: new BvmAddr(accounts[operations[_i4].programIndex]),
          data: Buffer.from(operations[_i4].data)
        };

        var _loop = function _loop(j) {
          var pubkey = new BvmAddr(accounts[operations[_i4].accountIndex[j]]);
          instructionData.keys.push({
            pubkey: pubkey,
            isSigner: transaction.signatures.some(function (keyObj) {
              return keyObj.pubKey.converseToString() === pubkey.converseToString();
            }),
            isDebitable: isCreditDebit(j, numRequiredSignatures, numCreditOnlySignedAccounts, numCreditOnlyUnsignedAccounts, accounts.length)
          });
        };

        for (var j = 0; j < operations[_i4].accountIndex.length; j++) {
          _loop(j);
        }

        var _instruction = new TxOperation(instructionData);

        transaction.operations.push(_instruction);
      }

      return transaction;
    }
  }]);

  return Transaction;
}(); //////////////////////////////////////////////////////////////////////////////////////////

// Don't use this constructor, use the type factory functions:
//    list(), literal(), reference(), encrypted()


function RpcParameter(value, type, attributes) {
  if (!(this instanceof RpcParameter)) {
    return new RpcParameter(value, type, attributes);
  }

  this.value = value;
  this.type = type;
  this.attributes = {};

  if (!underscore.isUndefined(attributes) && !underscore.isNull(attributes)) {
    this.attributes = attributes;
  }
}

RpcParameter.list = function (param) {
  return new RpcParameter(param, 'list');
};

RpcParameter.literal = function (param) {
  return new RpcParameter(param, 'literal');
};

RpcParameter.encrypted = function (param, assocIndex, idIndex) {
  return new RpcParameter(param, 'encrypted', {
    assocIndex: assocIndex,
    idIndex: idIndex
  });
};

RpcParameter.reference = function (param) {
  return new RpcParameter(param, 'reference');
};

RpcParameter.isRpcParameter = function (param) {
  return !underscore.isUndefined(param) && !underscore.isNull(param) && param instanceof RpcParameter;
};

var RpcParameter_1 = RpcParameter;

var rpcParameter = {
	RpcParameter: RpcParameter_1
};

var RpcParameter$1 = rpcParameter.RpcParameter;

function RpcCall(rpcName, params) {
  if (!(this instanceof RpcCall)) {
    return new RpcCall(rpcName, params);
  }

  this.rpcName = rpcName;
  this.params = params || [];
}
/*
Variadic:
create(rpcName)
create(rpcName, processor)
create(rpcName, params...)
create(rpcName, [params...])
create(rpcCall)
Additionally, this function takes the form of a single
array argument with the array containing some combination
of the parameters described above in the variadic forms.
*/


RpcCall.create = function create(rpcName, params) {
  if (arguments.length === 0 || !underscore.isArray(arguments[0])) {
    return create(underscore.toArray(arguments));
  }

  var args = arguments[0];

  if (args.length < 1 || underscore.isEmpty(args[0])) {
    return;
  }

  if (RpcCall.isRpcCall(args[0])) {
    return args[0];
  }

  rpcName = args[0];

  if (args.length < 2) {
    return new RpcCall(rpcName);
  }

  params = processParamList(underscore.rest(args));
  return new RpcCall(rpcName, params);
};

RpcCall.isRpcCall = function isRpcCall(param) {
  return !underscore.isEmpty(param) && param instanceof RpcCall;
};

function flattenAndRemoveNullishValues(paramList) {
  if (underscore.isUndefined(paramList) || underscore.isNull(paramList)) {
    return [];
  }

  if (!underscore.isArray(paramList)) {
    return [paramList];
  }

  return underscore.filter(underscore.flatten(paramList), function (value) {
    return !underscore.isUndefined(value) && !underscore.isNull(value);
  });
}

function processParamList(paramList) {
  if (underscore.isUndefined(paramList) || underscore.isNull(paramList)) {
    return [];
  }

  var convertedParams = flattenAndRemoveNullishValues(paramList);
  return underscore.map(convertedParams, function (param) {
    if (RpcParameter$1.isRpcParameter(param)) {
      return param;
    }

    var stringParam = param;

    if (underscore.isNumber(param)) {
      stringParam = String(param);
    }

    if (underscore.isString(stringParam)) {
      return RpcParameter$1.literal(stringParam);
    }

    return RpcParameter$1.list(param);
  });
}

var RpcCall_1 = RpcCall;
RpcCall._flattenAndRemoveNullishValues = flattenAndRemoveNullishValues;
RpcCall._processParamList = processParamList;

/*
dormant XX million sec
 */
function dormant(ms) {
  return new Promise(function (resolve) {
    return setTimeout(resolve, ms);
  });
}

var _types2;

var number_type = 0;
var string_type = 1;
var object_type = 2;
var boolean_type = 3;

var _types = (_types2 = {}, _defineProperty(_types2, number_type, 'number'), _defineProperty(_types2, string_type, 'string'), _defineProperty(_types2, object_type, 'object'), _defineProperty(_types2, boolean_type, 'boolean'), _types2);


var NetworkError =
/*#__PURE__*/
function (_Error) {
  _inherits(NetworkError, _Error);

  function NetworkError(msg) {
    var _this;

    _classCallCheck(this, NetworkError);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(NetworkError).call(this, msg));
    _this.name = 'NetworkError';
    return _this;
  }

  return NetworkError;
}(_wrapNativeSuper(Error));

var tls = require('tls');

var fs$1 = require('fs');

var net = require('net');

var uuidv4 = require('uuid/v4');

var events = require('events'); // const { NetworkError } = require('./exceptions').NetworkError;


function createRpcReq(url) {
  var server = jayson(
  /*#__PURE__*/
  function () {
    var _ref2 = _asyncToGenerator(
    /*#__PURE__*/
    _regeneratorRuntime.mark(function _callee2(request, callback) {
      var options, res, text;
      return _regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              options = {
                method: 'POST',
                body: request,
                headers: {
                  'Content-Type': 'application/json'
                }
              };
              _context2.prev = 1;
              _context2.next = 4;
              return fetch(url, options);

            case 4:
              res = _context2.sent;
              _context2.next = 7;
              return res.text();

            case 7:
              text = _context2.sent;
              callback(null, text);
              _context2.next = 14;
              break;

            case 11:
              _context2.prev = 11;
              _context2.t0 = _context2["catch"](1);
              callback(_context2.t0);

            case 14:
            case "end":
              return _context2.stop();
          }
        }
      }, _callee2, null, [[1, 11]]);
    }));

    return function (_x3, _x4) {
      return _ref2.apply(this, arguments);
    };
  }());
  return function (method, args) {
    return new Promise(function (resolve, reject) {
      server.request(method, args, function (err, response) {
        if (err) {
          reject(err);
          return;
        }

        resolve(response);
      });
    });
  };
} /////////////////////////////////////////////////////////////////////////////////////////////////////////


var ConfigurationError =
/*#__PURE__*/
function (_Error2) {
  _inherits(ConfigurationError, _Error2);

  function ConfigurationError(msg) {
    var _this2;

    _classCallCheck(this, ConfigurationError);

    _this2 = _possibleConstructorReturn(this, _getPrototypeOf(ConfigurationError).call(this, msg));
    _this2.name = 'ConfigurationError';
    return _this2;
  }

  return ConfigurationError;
}(_wrapNativeSuper(Error));

var TransactionError =
/*#__PURE__*/
function (_Error3) {
  _inherits(TransactionError, _Error3);

  function TransactionError(msg) {
    var _this3;

    _classCallCheck(this, TransactionError);

    _this3 = _possibleConstructorReturn(this, _getPrototypeOf(TransactionError).call(this, msg));
    _this3.name = 'TransactionError';
    return _this3;
  }

  return TransactionError;
}(_wrapNativeSuper(Error));

var PrecompiledError =
/*#__PURE__*/
function (_Error4) {
  _inherits(PrecompiledError, _Error4);

  function PrecompiledError(msg) {
    var _this4;

    _classCallCheck(this, PrecompiledError);

    _this4 = _possibleConstructorReturn(this, _getPrototypeOf(PrecompiledError).call(this, msg));
    _this4.name = 'PrecompiledError';
    return _this4;
  }

  return PrecompiledError;
}(_wrapNativeSuper(Error));

var CompileError =
/*#__PURE__*/
function (_Error5) {
  _inherits(CompileError, _Error5);

  function CompileError(msg) {
    var _this5;

    _classCallCheck(this, CompileError);

    _this5 = _possibleConstructorReturn(this, _getPrototypeOf(CompileError).call(this, msg));
    _this5.name = 'CompileError';
    return _this5;
  }

  return CompileError;
}(_wrapNativeSuper(Error)); /////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Expected JSON RPC response for the "fetchAccountBalance" message
 */


var FetchBalanceRpcResult = superstruct.struct({
  jsonrpc: superstruct.struct.literal('2.0'),
  id: 'string',
  error: 'any?',
  result: 'number?'
});
var FetchReputationRpcResult = superstruct.struct({
  jsonrpc: superstruct.struct.literal('2.0'),
  id: 'string',
  error: 'any?',
  result: 'number?'
});
/**
 * @private
 */

function jsonRpcResult(resultDescription) {
  var jsonRpcVersion = superstruct.struct.literal('2.0');
  return superstruct.struct.union([superstruct.struct({
    jsonrpc: jsonRpcVersion,
    id: 'string',
    error: 'any'
  }), superstruct.struct({
    jsonrpc: jsonRpcVersion,
    id: 'string',
    error: 'null?',
    result: resultDescription
  })]);
}
/**
 * @private
 */


var AccountDetailResult = superstruct.struct({
  executable: 'boolean',
  owner: 'array',
  difs: 'number',
  reputations: 'number',
  data: 'array'
});
/**
 * Expected JSON RPC response for the "fetchAccountDetail" message
 */

var fetchAccountDetailRpcResult = jsonRpcResult(AccountDetailResult);
/***
 * Expected JSON RPC response for the "accountNotification" message
 */

var AccountNoticeResult = superstruct.struct({
  subscription: 'number',
  result: AccountDetailResult
});
/**
 * @private
 */

var ControllerAccountDetailResult = superstruct.struct(['string', AccountDetailResult]);
/***
 * Expected JSON RPC response for the "controllerNotification" message
 */

var ControllerAccountNoticeResult = superstruct.struct({
  subscription: 'number',
  result: ControllerAccountDetailResult
}); ////////////////////////////////////////////////////////////////////////////////////////////////
// const fs = require('fs');

var path = require('path');

var childProcess = require('child_process'); // const assert = require('assert');
// const events = require('events');


var abi = require('ethjs-abi');

/**
 * Expected JSON RPC response for the "confmTxn" message
 */


var ConfmTxnRpcResult = jsonRpcResult('boolean');
/**
 * Expected JSON RPC response for the "fetchRoundLeader" message
 */

var FetchRoundLeader = jsonRpcResult('string');
/**
 * Expected JSON RPC response for the "fetchClusterNodes" message
 */

var GetClusterNodes = jsonRpcResult(superstruct.struct.list([superstruct.struct({
  pubkey: 'string',
  gossip: 'string',
  tpu: superstruct.struct.union(['null', 'string']),
  rpc: superstruct.struct.union(['null', 'string'])
})]));
/**
 * @ignore
 */

var GetClusterNodes_015 = jsonRpcResult(superstruct.struct.list([superstruct.struct({
  id: 'string',
  gossip: 'string',
  tpu: superstruct.struct.union(['null', 'string']),
  rpc: superstruct.struct.union(['null', 'string'])
})]));
/**
 * Expected JSON RPC response for the "getEpochVoteAccounts" message
 */

var GetEpochVoteAccounts = jsonRpcResult(superstruct.struct.list([superstruct.struct({
  votePubkey: 'string',
  nodePubkey: 'string',
  stake: 'number',
  commission: 'number'
})]));
/**
 * Expected JSON RPC response for the "fetchSignatureState" message
 */

var FetchSignatureStateRpcResult = jsonRpcResult(superstruct.struct.union(['null', superstruct.struct.union([superstruct.struct({
  Ok: 'null'
}), superstruct.struct({
  Err: 'object'
})])]));
/**
 * Expected JSON RPC response for the "fetchTxnAmount" message
 */

var FetchTxnAmountRpcResult = jsonRpcResult('number'); /////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Expected JSON RPC response for the "getTotalSupply" message
 */

var GetTotalSupplyRpcResult = jsonRpcResult('number');
/**
 * Expected JSON RPC response for the "fetchRecentBlockhash" message
 */

var FetchRecentBlockhash = jsonRpcResult(['string', superstruct.struct({
  difsPerSignature: 'number',
  maxDifsPerSignature: 'number',
  minDifsPerSignature: 'number',
  targetDifsPerSignature: 'number',
  targetSignaturesPerSlot: 'number'
})]);
/**
 * @ignore
 */

var GetRecentBlockhash_015 = jsonRpcResult(['string', superstruct.struct({
  difsPerSignature: 'number'
})]);
/**
 * Expected JSON RPC response for the "reqDrone" message
 */

var ReqDroneRpcResult = jsonRpcResult('string');
/**
 * Expected JSON RPC response for the "reqReputation" message
 */

var ReqReputationRpcResult = jsonRpcResult('string');
/**
 * Expected JSON RPC response for the "sendTxn" message
 */

var SendTxnRpcResult = jsonRpcResult('string');
/**
 * Information describing an account
 *
 * @typedef {Object} AccountDetail
 * @property {number} difs Number of difs assigned to the account
 * @property {BvmAddr} owner Identifier of the controller that owns the account
 * @property {?Buffer} data Optional data assigned to the account
 * @property {boolean} executable `true` if this account's data contains a loaded controller
 */

////////////////////////////////////////////////////////////////////////////////////////////////////////////
var secp256k1 = require('secp256k1'); // const cryptoJSSha3 = require('crypto-js/sha3');


var keccak = require('keccak'); // const assert = require('assert');


var rlp = require('rlp');

var coder = require('web3-eth-abi');

var ethjsUtil = require('ethjs-util');

/**
 * Callback function for controller account change notifications
 */


// This type exists to workaround an esdoc parse error

/**
 * A connection to a fullnode JSON RPC endpoint
 */
var Connection =
/*#__PURE__*/
function () {
  /**
   * Establish a JSON RPC connection
   *
   * @param endpoint URL to the fullnode JSON RPC endpoint
   */
  function Connection(endpoint) {
    _classCallCheck(this, Connection);

    _defineProperty(this, "_rpcReq", void 0);

    _defineProperty(this, "_rpcWebSock", void 0);

    _defineProperty(this, "_rpcWebSockConnected", false);

    _defineProperty(this, "_blockhashInfo", void 0);

    _defineProperty(this, "_disableBlockhashCaching", false);

    _defineProperty(this, "_accountChangeSubscriptions", {});

    _defineProperty(this, "_accountChangeSubscriptionCounter", 0);

    _defineProperty(this, "_controllerAccountChangeSubscriptions", {});

    _defineProperty(this, "_controllerAccountChangeSubscriptionCounter", 0);

    var url$1 = url.parse(endpoint);
    this._rpcReq = createRpcReq(url$1.href);
    this._blockhashInfo = {
      recentPackagehash: null,
      seconds: -1,
      transactionSignatures: []
    };
    url$1.protocol = url$1.protocol === 'https:' ? 'wss:' : 'ws:';
    url$1.host = '';
    url$1.port = String(Number(url$1.port) + 1);

    if (url$1.port === '1') {
      url$1.port = url$1.protocol === 'wss:' ? '8901' : '8900';
    }

    this._rpcWebSock = new rpcWebsockets.Client(url.format(url$1), {
      autoconnect: false,
      max_reconnects: Infinity
    });

    this._rpcWebSock.on('open', this._wsOnOpen.bind(this));

    this._rpcWebSock.on('error', this._wsOnErr.bind(this));

    this._rpcWebSock.on('close', this._wsOnClose.bind(this));

    this._rpcWebSock.on('accountNotification', this._wsOnAccountNotice.bind(this));

    this._rpcWebSock.on('controllerNotification', this._wsOnProgramAccountNotification.bind(this));
  }
  /**
   * Fetch the balance for the specified public key
   */


  _createClass(Connection, [{
    key: "fetchAccountBalance",
    value: function () {
      var _fetchAccountBalance = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee3(pubKey) {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return this._rpcReq('getDif', [pubKey.converseToBase58()]);

              case 2:
                unsafeRes = _context3.sent;
                res = FetchBalanceRpcResult(unsafeRes);

                if (!res.error) {
                  _context3.next = 6;
                  break;
                }

                throw new Error(res.error.message);

              case 6:
                assert$3(typeof res.result !== 'undefined');
                return _context3.abrupt("return", res.result);

              case 8:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function fetchAccountBalance(_x5) {
        return _fetchAccountBalance.apply(this, arguments);
      }

      return fetchAccountBalance;
    }()
  }, {
    key: "fetchAccountReputation",
    value: function () {
      var _fetchAccountReputation = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee4(pubKey) {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _context4.next = 2;
                return this._rpcReq('getReputation', [pubKey.converseToBase58()]);

              case 2:
                unsafeRes = _context4.sent;
                res = FetchReputationRpcResult(unsafeRes);

                if (!res.error) {
                  _context4.next = 6;
                  break;
                }

                throw new Error(res.error.message);

              case 6:
                assert$3(typeof res.result !== 'undefined');
                return _context4.abrupt("return", res.result);

              case 8:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function fetchAccountReputation(_x6) {
        return _fetchAccountReputation.apply(this, arguments);
      }

      return fetchAccountReputation;
    }()
    /**
     * Fetch all the account info for the specified public key
     */

  }, {
    key: "fetchAccountDetail",
    value: function () {
      var _fetchAccountDetail = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee5(pubKey) {
        var unsafeRes, res, result;
        return _regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return this._rpcReq('getAccountInfo', [pubKey.converseToBase58()]);

              case 2:
                unsafeRes = _context5.sent;
                res = fetchAccountDetailRpcResult(unsafeRes);

                if (!res.error) {
                  _context5.next = 6;
                  break;
                }

                throw new Error(res.error.message);

              case 6:
                result = res.result;
                assert$3(typeof result !== 'undefined');
                return _context5.abrupt("return", {
                  executable: result.executable,
                  owner: new BvmAddr(result.owner),
                  difs: result.difs,
                  reputations: result.reputations,
                  data: Buffer.from(result.data)
                });

              case 9:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function fetchAccountDetail(_x7) {
        return _fetchAccountDetail.apply(this, arguments);
      }

      return fetchAccountDetail;
    }()
    /**
     * Confirm the transaction identified by the specified signature
     */

  }, {
    key: "confmTxn",
    value: function () {
      var _confmTxn = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee6(signature) {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return this._rpcReq('confirmTxn', [signature]);

              case 2:
                unsafeRes = _context6.sent;
                res = ConfmTxnRpcResult(unsafeRes);

                if (!res.error) {
                  _context6.next = 6;
                  break;
                }

                throw new Error(res.error.message);

              case 6:
                assert$3(typeof res.result !== 'undefined');
                return _context6.abrupt("return", res.result);

              case 8:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function confmTxn(_x8) {
        return _confmTxn.apply(this, arguments);
      }

      return confmTxn;
    }()
    /**
     * Return the list of nodes that are currently participating in the cluster
     */

  }, {
    key: "fetchClusterNodes",
    value: function () {
      var _fetchClusterNodes = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee7() {
        var unsafeRes, res_015, res;
        return _regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.next = 2;
                return this._rpcReq('getClusterNodes', []);

              case 2:
                unsafeRes = _context7.sent;
                _context7.prev = 3;
                res_015 = GetClusterNodes_015(unsafeRes);

                if (!res_015.error) {
                  _context7.next = 8;
                  break;
                }

                console.log('no', res_015.error);
                throw new Error(res_015.error.message);

              case 8:
                return _context7.abrupt("return", res_015.result.map(function (node) {
                  node.pubkey = node.id;
                  node.id = undefined;
                  return node;
                }));

              case 11:
                _context7.prev = 11;
                _context7.t0 = _context7["catch"](3);

              case 13:
                // End Legacy v0.15 response
                res = GetClusterNodes(unsafeRes);

                if (!res.error) {
                  _context7.next = 16;
                  break;
                }

                throw new Error(res.error.message);

              case 16:
                assert$3(typeof res.result !== 'undefined');
                return _context7.abrupt("return", res.result);

              case 18:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this, [[3, 11]]);
      }));

      function fetchClusterNodes() {
        return _fetchClusterNodes.apply(this, arguments);
      }

      return fetchClusterNodes;
    }()
    /**
     * Return the list of nodes that are currently participating in the cluster
     */

  }, {
    key: "getEpochVoteAccounts",
    value: function () {
      var _getEpochVoteAccounts = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee8() {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _context8.next = 2;
                return this._rpcReq('getEpochVoteAccounts', []);

              case 2:
                unsafeRes = _context8.sent;
                res = GetEpochVoteAccounts(unsafeRes); //const res = unsafeRes;

                if (!res.error) {
                  _context8.next = 6;
                  break;
                }

                throw new Error(res.error.message);

              case 6:
                assert$3(typeof res.result !== 'undefined');
                return _context8.abrupt("return", res.result);

              case 8:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function getEpochVoteAccounts() {
        return _getEpochVoteAccounts.apply(this, arguments);
      }

      return getEpochVoteAccounts;
    }()
    /**
     * Fetch the current slot leader of the cluster
     */

  }, {
    key: "fetchRoundLeader",
    value: function () {
      var _fetchRoundLeader = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee9() {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                _context9.next = 2;
                return this._rpcReq('getRoundLeader', []);

              case 2:
                unsafeRes = _context9.sent;
                res = FetchRoundLeader(unsafeRes);

                if (!res.error) {
                  _context9.next = 6;
                  break;
                }

                throw new Error(res.error.message);

              case 6:
                assert$3(typeof res.result !== 'undefined');
                return _context9.abrupt("return", res.result);

              case 8:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9, this);
      }));

      function fetchRoundLeader() {
        return _fetchRoundLeader.apply(this, arguments);
      }

      return fetchRoundLeader;
    }()
    /**
     * Fetch the current transaction count of the cluster
     */

  }, {
    key: "fetchSignatureState",
    value: function () {
      var _fetchSignatureState = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee10(signature) {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                _context10.next = 2;
                return this._rpcReq('getSignatureState', [signature]);

              case 2:
                unsafeRes = _context10.sent;
                res = FetchSignatureStateRpcResult(unsafeRes);

                if (!res.error) {
                  _context10.next = 6;
                  break;
                }

                throw new Error(res.error.message);

              case 6:
                assert$3(typeof res.result !== 'undefined');
                return _context10.abrupt("return", res.result);

              case 8:
              case "end":
                return _context10.stop();
            }
          }
        }, _callee10, this);
      }));

      function fetchSignatureState(_x9) {
        return _fetchSignatureState.apply(this, arguments);
      }

      return fetchSignatureState;
    }()
    /**
     * Fetch the current transaction count of the cluster
     */

  }, {
    key: "fetchTxnAmount",
    value: function () {
      var _fetchTxnAmount = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee11() {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                _context11.next = 2;
                return this._rpcReq('getTxnCnt', []);

              case 2:
                unsafeRes = _context11.sent;
                res = FetchTxnAmountRpcResult(unsafeRes);

                if (!res.error) {
                  _context11.next = 6;
                  break;
                }

                throw new Error(res.error.message);

              case 6:
                assert$3(typeof res.result !== 'undefined');
                return _context11.abrupt("return", Number(res.result));

              case 8:
              case "end":
                return _context11.stop();
            }
          }
        }, _callee11, this);
      }));

      function fetchTxnAmount() {
        return _fetchTxnAmount.apply(this, arguments);
      }

      return fetchTxnAmount;
    }()
    /**
     * Fetch the current total currency supply of the cluster
     */

  }, {
    key: "getTotalSupply",
    value: function () {
      var _getTotalSupply = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee12() {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee12$(_context12) {
          while (1) {
            switch (_context12.prev = _context12.next) {
              case 0:
                _context12.next = 2;
                return this._rpcReq('getTotalSupply', []);

              case 2:
                unsafeRes = _context12.sent;
                res = GetTotalSupplyRpcResult(unsafeRes);

                if (!res.error) {
                  _context12.next = 6;
                  break;
                }

                throw new Error(res.error.message);

              case 6:
                assert$3(typeof res.result !== 'undefined');
                return _context12.abrupt("return", Number(res.result));

              case 8:
              case "end":
                return _context12.stop();
            }
          }
        }, _callee12, this);
      }));

      function getTotalSupply() {
        return _getTotalSupply.apply(this, arguments);
      }

      return getTotalSupply;
    }()
    /**
     * Fetch a recent blockhash from the cluster
     */

  }, {
    key: "fetchRecentBlockhash",
    value: function () {
      var _fetchRecentBlockhash = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee13() {
        var unsafeRes, res_015, _res_015$result, blockhash, feeCalculator, res;

        return _regeneratorRuntime.wrap(function _callee13$(_context13) {
          while (1) {
            switch (_context13.prev = _context13.next) {
              case 0:
                _context13.next = 2;
                return this._rpcReq('getLatestTransactionSeal', []);

              case 2:
                unsafeRes = _context13.sent;
                _context13.prev = 3;
                res_015 = GetRecentBlockhash_015(unsafeRes);

                if (!res_015.error) {
                  _context13.next = 7;
                  break;
                }

                throw new Error(res_015.error.message);

              case 7:
                _res_015$result = _slicedToArray(res_015.result, 2), blockhash = _res_015$result[0], feeCalculator = _res_015$result[1];
                feeCalculator.targetSignaturesPerSlot = 42;
                feeCalculator.targetDifsPerSignature = feeCalculator.difsPerSignature;
                return _context13.abrupt("return", [blockhash, feeCalculator]);

              case 13:
                _context13.prev = 13;
                _context13.t0 = _context13["catch"](3);

              case 15:
                // End Legacy v0.15 response
                res = FetchRecentBlockhash(unsafeRes);

                if (!res.error) {
                  _context13.next = 18;
                  break;
                }

                throw new Error(res.error.message);

              case 18:
                assert$3(typeof res.result !== 'undefined');
                return _context13.abrupt("return", res.result);

              case 20:
              case "end":
                return _context13.stop();
            }
          }
        }, _callee13, this, [[3, 13]]);
      }));

      function fetchRecentBlockhash() {
        return _fetchRecentBlockhash.apply(this, arguments);
      }

      return fetchRecentBlockhash;
    }()
    /**
     * Request an allocation of difs to the specified account
     */

  }, {
    key: "reqDrone",
    value: function () {
      var _reqDrone = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee14(to, amount) {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee14$(_context14) {
          while (1) {
            switch (_context14.prev = _context14.next) {
              case 0:
                _context14.next = 2;
                return this._rpcReq('requestDif', [to.converseToBase58(), amount]);

              case 2:
                unsafeRes = _context14.sent;
                res = ReqDroneRpcResult(unsafeRes);

                if (!res.error) {
                  _context14.next = 6;
                  break;
                }

                throw new Error(res.error.message);

              case 6:
                assert$3(typeof res.result !== 'undefined');
                return _context14.abrupt("return", res.result);

              case 8:
              case "end":
                return _context14.stop();
            }
          }
        }, _callee14, this);
      }));

      function reqDrone(_x10, _x11) {
        return _reqDrone.apply(this, arguments);
      }

      return reqDrone;
    }()
    /**
    * Request an allocation of reputations to the specified account
    */

  }, {
    key: "reqReputation",
    value: function () {
      var _reqReputation = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee15(to, amount) {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee15$(_context15) {
          while (1) {
            switch (_context15.prev = _context15.next) {
              case 0:
                _context15.next = 2;
                return this._rpcReq('requestReputation', [to.converseToBase58(), amount]);

              case 2:
                unsafeRes = _context15.sent;
                res = ReqReputationRpcResult(unsafeRes);

                if (!res.error) {
                  _context15.next = 6;
                  break;
                }

                throw new Error(res.error.message);

              case 6:
                assert$3(typeof res.result !== 'undefined');
                return _context15.abrupt("return", res.result);

              case 8:
              case "end":
                return _context15.stop();
            }
          }
        }, _callee15, this);
      }));

      function reqReputation(_x12, _x13) {
        return _reqReputation.apply(this, arguments);
      }

      return reqReputation;
    }()
    /**
     * Sign and send a transaction
     */

  }, {
    key: "sendTxn",
    value: function () {
      var _sendTxn = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee16(transaction) {
        var _len3,
            signers,
            _key3,
            seconds,
            signature,
            attempts,
            startTime,
            _ref3,
            _ref4,
            recentPackagehash,
            wireTransaction,
            _args16 = arguments;

        return _regeneratorRuntime.wrap(function _callee16$(_context16) {
          while (1) {
            switch (_context16.prev = _context16.next) {
              case 0:
                for (_len3 = _args16.length, signers = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
                  signers[_key3 - 1] = _args16[_key3];
                }

              case 1:
                // Attempt to use a recent blockhash for up to 30 seconds
                seconds = new Date().getSeconds();

                if (!(this._blockhashInfo.recentPackagehash != null && this._blockhashInfo.seconds < seconds + 30)) {
                  _context16.next = 12;
                  break;
                }

                transaction.recentPackagehash = this._blockhashInfo.recentPackagehash;
                transaction.sign.apply(transaction, signers);

                if (transaction.signature) {
                  _context16.next = 7;
                  break;
                }

                throw new Error('!signature');

              case 7:
                // If the signature of this transaction has not been seen before with the
                // current recentPackagehash, all done.
                signature = transaction.signature.toString();

                if (this._blockhashInfo.transactionSignatures.includes(signature)) {
                  _context16.next = 12;
                  break;
                }

                this._blockhashInfo.transactionSignatures.push(signature);

                if (this._disableBlockhashCaching) {
                  this._blockhashInfo.seconds = -1;
                }

                return _context16.abrupt("break", 31);

              case 12:
                // Fetch a new blockhash
                attempts = 0;
                startTime = Date.now();

              case 14:
                _context16.next = 16;
                return this.fetchRecentBlockhash();

              case 16:
                _ref3 = _context16.sent;
                _ref4 = _slicedToArray(_ref3, 1);
                recentPackagehash //feeCalculator,
                = _ref4[0];

                if (!(this._blockhashInfo.recentPackagehash != recentPackagehash)) {
                  _context16.next = 22;
                  break;
                }

                this._blockhashInfo = {
                  recentPackagehash: recentPackagehash,
                  seconds: new Date().getSeconds(),
                  transactionSignatures: []
                };
                return _context16.abrupt("break", 29);

              case 22:
                if (!(attempts === 50)) {
                  _context16.next = 24;
                  break;
                }

                throw new Error("Unable to obtain a new blockhash after ".concat(Date.now() - startTime, "ms"));

              case 24:
                _context16.next = 26;
                return dormant(500 * DEFAULT_TICKS_PER_SLOT / NUM_TICKS_PER_SEC);

              case 26:
                ++attempts;

              case 27:
                _context16.next = 14;
                break;

              case 29:
                _context16.next = 1;
                break;

              case 31:
                wireTransaction = transaction.serialize();
                _context16.next = 34;
                return this.sendNativeTxn(wireTransaction);

              case 34:
                return _context16.abrupt("return", _context16.sent);

              case 35:
              case "end":
                return _context16.stop();
            }
          }
        }, _callee16, this);
      }));

      function sendTxn(_x14) {
        return _sendTxn.apply(this, arguments);
      }

      return sendTxn;
    }()
    /**
     * @private
     */

  }, {
    key: "fullnodeExit",
    value: function () {
      var _fullnodeExit = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee17() {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee17$(_context17) {
          while (1) {
            switch (_context17.prev = _context17.next) {
              case 0:
                _context17.next = 2;
                return this._rpcReq('fullnodeQuit', []);

              case 2:
                unsafeRes = _context17.sent;
                res = jsonRpcResult('boolean')(unsafeRes);

                if (!res.error) {
                  _context17.next = 6;
                  break;
                }

                throw new Error(res.error.message);

              case 6:
                assert$3(typeof res.result !== 'undefined');
                return _context17.abrupt("return", res.result);

              case 8:
              case "end":
                return _context17.stop();
            }
          }
        }, _callee17, this);
      }));

      function fullnodeExit() {
        return _fullnodeExit.apply(this, arguments);
      }

      return fullnodeExit;
    }()
    /**
     * Send a transaction that has already been signed and serialized into the
     * wire format
     */

  }, {
    key: "sendNativeTxn",
    value: function () {
      var _sendNativeTxn = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee18(rawTransaction) {
        var unsafeRes, res;
        return _regeneratorRuntime.wrap(function _callee18$(_context18) {
          while (1) {
            switch (_context18.prev = _context18.next) {
              case 0:
                _context18.next = 2;
                return this._rpcReq('sendTxn', [_toConsumableArray(rawTransaction)]);

              case 2:
                unsafeRes = _context18.sent;
                res = SendTxnRpcResult(unsafeRes);

                if (!res.error) {
                  _context18.next = 6;
                  break;
                }

                throw new Error(res.error.message);

              case 6:
                assert$3(typeof res.result !== 'undefined');
                assert$3(res.result);
                return _context18.abrupt("return", res.result);

              case 9:
              case "end":
                return _context18.stop();
            }
          }
        }, _callee18, this);
      }));

      function sendNativeTxn(_x15) {
        return _sendNativeTxn.apply(this, arguments);
      }

      return sendNativeTxn;
    }()
    /**
     * @private
     */

  }, {
    key: "_wsOnOpen",
    value: function _wsOnOpen() {
      this._rpcWebSockConnected = true;

      this._updateSubscriptions();
    }
    /**
     * @private
     */

  }, {
    key: "_wsOnErr",
    value: function _wsOnErr(err) {
      console.log('ws error:', err.message);
    }
    /**
     * @private
     */

  }, {
    key: "_wsOnClose",
    value: function _wsOnClose(code, message) {
      // 1000 means _rpcWebSock.close() was called explicitly
      if (code !== 1000) {
        console.log('ws close:', code, message);
      }

      this._rpcWebSockConnected = false;
    }
    /**
     * @private
     */

  }, {
    key: "_updateSubscriptions",
    value: function () {
      var _updateSubscriptions2 = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee19() {
        var accountKeys, programKeys, _iteratorNormalCompletion2, _didIteratorError2, _iteratorError2, _iterator2, _step2, id, _iteratorNormalCompletion3, _didIteratorError3, _iteratorError3, _iterator3, _step3, _id, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, _id2, _this$_accountChangeS, subscriptionId, pubKey, _iteratorNormalCompletion5, _didIteratorError5, _iteratorError5, _iterator5, _step5, _id3, _this$_controllerAcco, _subscriptionId, controllerId;

        return _regeneratorRuntime.wrap(function _callee19$(_context19) {
          while (1) {
            switch (_context19.prev = _context19.next) {
              case 0:
                accountKeys = Object.keys(this._accountChangeSubscriptions).map(Number);
                programKeys = Object.keys(this._controllerAccountChangeSubscriptions).map(Number);

                if (!(accountKeys.length === 0 && programKeys.length === 0)) {
                  _context19.next = 5;
                  break;
                }

                this._rpcWebSock.close();

                return _context19.abrupt("return");

              case 5:
                if (this._rpcWebSockConnected) {
                  _context19.next = 46;
                  break;
                }

                _iteratorNormalCompletion2 = true;
                _didIteratorError2 = false;
                _iteratorError2 = undefined;
                _context19.prev = 9;

                for (_iterator2 = accountKeys[Symbol.iterator](); !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                  id = _step2.value;
                  this._accountChangeSubscriptions[id].subscriptionId = null;
                }

                _context19.next = 17;
                break;

              case 13:
                _context19.prev = 13;
                _context19.t0 = _context19["catch"](9);
                _didIteratorError2 = true;
                _iteratorError2 = _context19.t0;

              case 17:
                _context19.prev = 17;
                _context19.prev = 18;

                if (!_iteratorNormalCompletion2 && _iterator2["return"] != null) {
                  _iterator2["return"]();
                }

              case 20:
                _context19.prev = 20;

                if (!_didIteratorError2) {
                  _context19.next = 23;
                  break;
                }

                throw _iteratorError2;

              case 23:
                return _context19.finish(20);

              case 24:
                return _context19.finish(17);

              case 25:
                _iteratorNormalCompletion3 = true;
                _didIteratorError3 = false;
                _iteratorError3 = undefined;
                _context19.prev = 28;

                for (_iterator3 = programKeys[Symbol.iterator](); !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                  _id = _step3.value;
                  this._controllerAccountChangeSubscriptions[_id].subscriptionId = null;
                }

                _context19.next = 36;
                break;

              case 32:
                _context19.prev = 32;
                _context19.t1 = _context19["catch"](28);
                _didIteratorError3 = true;
                _iteratorError3 = _context19.t1;

              case 36:
                _context19.prev = 36;
                _context19.prev = 37;

                if (!_iteratorNormalCompletion3 && _iterator3["return"] != null) {
                  _iterator3["return"]();
                }

              case 39:
                _context19.prev = 39;

                if (!_didIteratorError3) {
                  _context19.next = 42;
                  break;
                }

                throw _iteratorError3;

              case 42:
                return _context19.finish(39);

              case 43:
                return _context19.finish(36);

              case 44:
                this._rpcWebSock.connect();

                return _context19.abrupt("return");

              case 46:
                _iteratorNormalCompletion4 = true;
                _didIteratorError4 = false;
                _iteratorError4 = undefined;
                _context19.prev = 49;
                _iterator4 = accountKeys[Symbol.iterator]();

              case 51:
                if (_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done) {
                  _context19.next = 67;
                  break;
                }

                _id2 = _step4.value;
                _this$_accountChangeS = this._accountChangeSubscriptions[_id2], subscriptionId = _this$_accountChangeS.subscriptionId, pubKey = _this$_accountChangeS.pubKey;

                if (!(subscriptionId === null)) {
                  _context19.next = 64;
                  break;
                }

                _context19.prev = 55;
                _context19.next = 58;
                return this._rpcWebSock.call('accountSubscribe', [pubKey]);

              case 58:
                this._accountChangeSubscriptions[_id2].subscriptionId = _context19.sent;
                _context19.next = 64;
                break;

              case 61:
                _context19.prev = 61;
                _context19.t2 = _context19["catch"](55);
                console.log("accountSubscribe error for ".concat(pubKey, ": ").concat(_context19.t2.message));

              case 64:
                _iteratorNormalCompletion4 = true;
                _context19.next = 51;
                break;

              case 67:
                _context19.next = 73;
                break;

              case 69:
                _context19.prev = 69;
                _context19.t3 = _context19["catch"](49);
                _didIteratorError4 = true;
                _iteratorError4 = _context19.t3;

              case 73:
                _context19.prev = 73;
                _context19.prev = 74;

                if (!_iteratorNormalCompletion4 && _iterator4["return"] != null) {
                  _iterator4["return"]();
                }

              case 76:
                _context19.prev = 76;

                if (!_didIteratorError4) {
                  _context19.next = 79;
                  break;
                }

                throw _iteratorError4;

              case 79:
                return _context19.finish(76);

              case 80:
                return _context19.finish(73);

              case 81:
                _iteratorNormalCompletion5 = true;
                _didIteratorError5 = false;
                _iteratorError5 = undefined;
                _context19.prev = 84;
                _iterator5 = programKeys[Symbol.iterator]();

              case 86:
                if (_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done) {
                  _context19.next = 102;
                  break;
                }

                _id3 = _step5.value;
                _this$_controllerAcco = this._controllerAccountChangeSubscriptions[_id3], _subscriptionId = _this$_controllerAcco.subscriptionId, controllerId = _this$_controllerAcco.controllerId;

                if (!(_subscriptionId === null)) {
                  _context19.next = 99;
                  break;
                }

                _context19.prev = 90;
                _context19.next = 93;
                return this._rpcWebSock.call('programSubscribe', [controllerId]);

              case 93:
                this._controllerAccountChangeSubscriptions[_id3].subscriptionId = _context19.sent;
                _context19.next = 99;
                break;

              case 96:
                _context19.prev = 96;
                _context19.t4 = _context19["catch"](90);
                console.log("programSubscribe error for ".concat(controllerId, ": ").concat(_context19.t4.message));

              case 99:
                _iteratorNormalCompletion5 = true;
                _context19.next = 86;
                break;

              case 102:
                _context19.next = 108;
                break;

              case 104:
                _context19.prev = 104;
                _context19.t5 = _context19["catch"](84);
                _didIteratorError5 = true;
                _iteratorError5 = _context19.t5;

              case 108:
                _context19.prev = 108;
                _context19.prev = 109;

                if (!_iteratorNormalCompletion5 && _iterator5["return"] != null) {
                  _iterator5["return"]();
                }

              case 111:
                _context19.prev = 111;

                if (!_didIteratorError5) {
                  _context19.next = 114;
                  break;
                }

                throw _iteratorError5;

              case 114:
                return _context19.finish(111);

              case 115:
                return _context19.finish(108);

              case 116:
              case "end":
                return _context19.stop();
            }
          }
        }, _callee19, this, [[9, 13, 17, 25], [18,, 20, 24], [28, 32, 36, 44], [37,, 39, 43], [49, 69, 73, 81], [55, 61], [74,, 76, 80], [84, 104, 108, 116], [90, 96], [109,, 111, 115]]);
      }));

      function _updateSubscriptions() {
        return _updateSubscriptions2.apply(this, arguments);
      }

      return _updateSubscriptions;
    }()
    /**
     * @private
     */

  }, {
    key: "_wsOnAccountNotice",
    value: function _wsOnAccountNotice(notification) {
      var res = AccountNoticeResult(notification);

      if (res.error) {
        throw new Error(res.error.message);
      }

      var keys = Object.keys(this._accountChangeSubscriptions).map(Number);
      var _iteratorNormalCompletion6 = true;
      var _didIteratorError6 = false;
      var _iteratorError6 = undefined;

      try {
        for (var _iterator6 = keys[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
          var id = _step6.value;
          var sub = this._accountChangeSubscriptions[id];

          if (sub.subscriptionId === res.subscription) {
            var result = res.result;
            assert$3(typeof result !== 'undefined');
            sub.callback({
              executable: result.executable,
              owner: new BvmAddr(result.owner),
              difs: result.difs,
              reputations: result.reputations,
              data: Buffer.from(result.data)
            });
            return true;
          }
        }
      } catch (err) {
        _didIteratorError6 = true;
        _iteratorError6 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion6 && _iterator6["return"] != null) {
            _iterator6["return"]();
          }
        } finally {
          if (_didIteratorError6) {
            throw _iteratorError6;
          }
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

  }, {
    key: "onAccountChange",
    value: function onAccountChange(pubKey, callback) {
      var id = ++this._accountChangeSubscriptionCounter;
      this._accountChangeSubscriptions[id] = {
        pubKey: pubKey.converseToBase58(),
        callback: callback,
        subscriptionId: null
      };

      this._updateSubscriptions();

      return id;
    }
    /**
     * Deregister an account notification callback
     *
     * @param id subscription id to deregister
     */

  }, {
    key: "removeListenerOfAccountChange",
    value: function () {
      var _removeListenerOfAccountChange = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee20(id) {
        var subscriptionId;
        return _regeneratorRuntime.wrap(function _callee20$(_context20) {
          while (1) {
            switch (_context20.prev = _context20.next) {
              case 0:
                if (!this._accountChangeSubscriptions[id]) {
                  _context20.next = 15;
                  break;
                }

                subscriptionId = this._accountChangeSubscriptions[id].subscriptionId;
                delete this._accountChangeSubscriptions[id];

                if (!(subscriptionId !== null)) {
                  _context20.next = 12;
                  break;
                }

                _context20.prev = 4;
                _context20.next = 7;
                return this._rpcWebSock.call('accountUnsubscribe', [subscriptionId]);

              case 7:
                _context20.next = 12;
                break;

              case 9:
                _context20.prev = 9;
                _context20.t0 = _context20["catch"](4);
                console.log('accountUnsubscribe error:', _context20.t0.message);

              case 12:
                this._updateSubscriptions();

                _context20.next = 16;
                break;

              case 15:
                throw new Error("Unknown account change id: ".concat(id));

              case 16:
              case "end":
                return _context20.stop();
            }
          }
        }, _callee20, this, [[4, 9]]);
      }));

      function removeListenerOfAccountChange(_x16) {
        return _removeListenerOfAccountChange.apply(this, arguments);
      }

      return removeListenerOfAccountChange;
    }()
    /**
     * @private
     */

  }, {
    key: "_wsOnProgramAccountNotification",
    value: function _wsOnProgramAccountNotification(notification) {
      var res = ControllerAccountNoticeResult(notification);

      if (res.error) {
        throw new Error(res.error.message);
      }

      var keys = Object.keys(this._controllerAccountChangeSubscriptions).map(Number);
      var _iteratorNormalCompletion7 = true;
      var _didIteratorError7 = false;
      var _iteratorError7 = undefined;

      try {
        for (var _iterator7 = keys[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
          var id = _step7.value;
          var sub = this._controllerAccountChangeSubscriptions[id];

          if (sub.subscriptionId === res.subscription) {
            var result = res.result;
            assert$3(typeof result !== 'undefined');
            sub.callback({
              accountId: result[0],
              fetchAccountDetail: {
                executable: result[1].executable,
                owner: new BvmAddr(result[1].owner),
                difs: result[1].difs,
                reputations: result[1].reputations,
                data: Buffer.from(result[1].data)
              }
            });
            return true;
          }
        }
      } catch (err) {
        _didIteratorError7 = true;
        _iteratorError7 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion7 && _iterator7["return"] != null) {
            _iterator7["return"]();
          }
        } finally {
          if (_didIteratorError7) {
            throw _iteratorError7;
          }
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

  }, {
    key: "onControllerAccountChange",
    value: function onControllerAccountChange(controllerId, callback) {
      var id = ++this._controllerAccountChangeSubscriptionCounter;
      this._controllerAccountChangeSubscriptions[id] = {
        controllerId: controllerId.converseToBase58(),
        callback: callback,
        subscriptionId: null
      };

      this._updateSubscriptions();

      return id;
    }
    /**
     * Deregister an account notification callback
     *
     * @param id subscription id to deregister
     */

  }, {
    key: "removeControllerAccountChangeListener",
    value: function () {
      var _removeControllerAccountChangeListener = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee21(id) {
        var subscriptionId;
        return _regeneratorRuntime.wrap(function _callee21$(_context21) {
          while (1) {
            switch (_context21.prev = _context21.next) {
              case 0:
                if (!this._controllerAccountChangeSubscriptions[id]) {
                  _context21.next = 15;
                  break;
                }

                subscriptionId = this._controllerAccountChangeSubscriptions[id].subscriptionId;
                delete this._controllerAccountChangeSubscriptions[id];

                if (!(subscriptionId !== null)) {
                  _context21.next = 12;
                  break;
                }

                _context21.prev = 4;
                _context21.next = 7;
                return this._rpcWebSock.call('programUnsubscribe', [subscriptionId]);

              case 7:
                _context21.next = 12;
                break;

              case 9:
                _context21.prev = 9;
                _context21.t0 = _context21["catch"](4);
                console.log('programUnsubscribe error:', _context21.t0.message);

              case 12:
                this._updateSubscriptions();

                _context21.next = 16;
                break;

              case 15:
                throw new Error("Unknown account change id: ".concat(id));

              case 16:
              case "end":
                return _context21.stop();
            }
          }
        }, _callee21, this, [[4, 9]]);
      }));

      function removeControllerAccountChangeListener(_x17) {
        return _removeControllerAccountChangeListener.apply(this, arguments);
      }

      return removeControllerAccountChangeListener;
    }()
  }]);

  return Connection;
}(); ////////////////////////////////////////////////////////////////////////////////////////////////////////////
// let utils = require('./utils');
// const encryptType = 2;
// const ethjsUtil = require('ethereumjs-util');

var BN = ethjsUtil.BN;
 ////////////////////////////////////////////////////////////////////////////////////////////////////////////

var util = require('util');

var _ = require('underscore');

var _str = require('underscore.string'); // var RpcCall = require('../rpc-call').RpcCall;

var _ = require('underscore');

var _str = require('underscore.string');

var Socket = require('net').Socket;

var format = require('util').format;
/**
 * Send transaction to leader to sign and wait until the transaction being confirm.
 */


function launchThenAcknowledgeTx(_x, _x2) {
  return _launchThenAcknowledgeTx.apply(this, arguments);
}

function _launchThenAcknowledgeTx() {
  _launchThenAcknowledgeTx = _asyncToGenerator(
  /*#__PURE__*/
  _regeneratorRuntime.mark(function _callee(connection, transaction) {
    var failed_send_retries,
        tx_signature,
        _len,
        signers,
        _key,
        start_time,
        tx_status,
        failed_status_retries,
        duration,
        _args = arguments;

    return _regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            failed_send_retries = 10;

            for (_len = _args.length, signers = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
              signers[_key - 2] = _args[_key];
            }

          case 2:
            start_time = Date.now();
            _context.next = 5;
            return connection.sendTxn.apply(connection, [transaction].concat(signers));

          case 5:
            tx_signature = _context.sent;
            // Wait a couple leader rotation duration for a transaction confirmation
            tx_status = null;
            failed_status_retries = 6;

          case 8:
            _context.next = 10;
            return connection.fetchSignatureState(tx_signature);

          case 10:
            tx_status = _context.sent;

            if (!tx_status) {
              _context.next = 13;
              break;
            }

            return _context.abrupt("break", 19);

          case 13:
            if (!(--failed_status_retries <= 0)) {
              _context.next = 15;
              break;
            }

            return _context.abrupt("break", 19);

          case 15:
            _context.next = 17;
            return dormant(500 * DEFAULT_TICKS_PER_SLOT / NUM_TICKS_PER_SEC);

          case 17:
            _context.next = 8;
            break;

          case 19:
            if (!(tx_status && 'Ok' in tx_status)) {
              _context.next = 21;
              break;
            }

            return _context.abrupt("break", 30);

          case 21:
            if (!(--failed_send_retries <= 0)) {
              _context.next = 24;
              break;
            }

            duration = (Date.now() - start_time) / 1000;
            throw new Error("Transaction '".concat(tx_signature, "' was not confirmed in ").concat(duration.toFixed(2), " seconds (").concat(JSON.stringify(tx_status), ")"));

          case 24:
            if (!(tx_status && tx_status.Err && !('AccountInUse' in tx_status.Err))) {
              _context.next = 26;
              break;
            }

            throw new Error("Transaction ".concat(tx_signature, " failed (").concat(JSON.stringify(tx_status), ")"));

          case 26:
            _context.next = 28;
            return dormant(Math.random() * 100);

          case 28:
            _context.next = 2;
            break;

          case 30:
            assert$3(tx_signature !== undefined);
            return _context.abrupt("return", tx_signature);

          case 32:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));
  return _launchThenAcknowledgeTx.apply(this, arguments);
}

/**
 * Factory class for transactions to interact with the System controller
 */


var SystemController =
/*#__PURE__*/
function () {
  function SystemController() {
    _classCallCheck(this, SystemController);
  }

  _createClass(SystemController, null, [{
    key: "createNewAccount",

    /**
     * Generate a Transaction that creates a new account
     */
    value: function createNewAccount(from, _createNewAccount, difs, reputations, space, controllerId) {
      var dataLayout = BufferLayout.struct([BufferLayout.u32('instruction'), BufferLayout.ns64('difs'), BufferLayout.ns64('reputations'), BufferLayout.ns64('space'), pubKey('controllerId')]);
      var data = Buffer.alloc(dataLayout.span);
      dataLayout.encode({
        instruction: 0,
        // Create BvmAcct instruction
        difs: difs,
        reputations: reputations,
        space: space,
        controllerId: controllerId.converseToBuffer()
      }, data);
      return new Transaction().add({
        keys: [{
          pubkey: from,
          isSigner: true,
          isDebitable: true
        }, {
          pubkey: _createNewAccount,
          isSigner: false,
          isDebitable: true
        }],
        controllerId: SystemController.controllerId,
        data: data
      });
    }
    /**
     * Generate a Transaction that transfers difs from one account to another
     */

  }, {
    key: "transfer",
    value: function transfer(from, to, amount) {
      var dataLayout = BufferLayout.struct([BufferLayout.u32('instruction'), BufferLayout.ns64('amount')]);
      var data = Buffer.alloc(dataLayout.span);
      dataLayout.encode({
        instruction: 2,
        // Move instruction
        amount: amount
      }, data);
      return new Transaction().add({
        keys: [{
          pubkey: from,
          isSigner: true,
          isDebitable: true
        }, {
          pubkey: to,
          isSigner: false,
          isDebitable: false
        }],
        controllerId: SystemController.controllerId,
        data: data
      });
    }
    /**
     * Generate a Transaction that transfers reputations from one account to another
     */

  }, {
    key: "transferReputation",
    value: function transferReputation(from, to, amount) {
      var dataLayout = BufferLayout.struct([BufferLayout.u32('instruction'), BufferLayout.ns64('amount')]);
      var data = Buffer.alloc(dataLayout.span);
      dataLayout.encode({
        instruction: 4,
        // transfer reputations instruction
        amount: amount
      }, data);
      return new Transaction().add({
        keys: [{
          pubkey: from,
          isSigner: true,
          isDebitable: true
        }, {
          pubkey: to,
          isSigner: false,
          isDebitable: false
        }],
        controllerId: SystemController.controllerId,
        data: data
      });
    }
    /**
     * Generate a Transaction that assigns an account to a controller
     */

  }, {
    key: "assign",
    value: function assign(from, controllerId) {
      var dataLayout = BufferLayout.struct([BufferLayout.u32('instruction'), pubKey('controllerId')]);
      var data = Buffer.alloc(dataLayout.span);
      dataLayout.encode({
        instruction: 1,
        // Assign instruction
        controllerId: controllerId.converseToBuffer()
      }, data);
      return new Transaction().add({
        keys: [{
          pubkey: from,
          isSigner: true,
          isDebitable: true
        }],
        controllerId: SystemController.controllerId,
        data: data
      });
    }
  }, {
    key: "controllerId",

    /**
     * Public key that identifies the System controller
     */
    get: function get() {
      return new BvmAddr('0x000000000000000000000000000000000000000000000000000000000000000');
    }
  }]);

  return SystemController;
}(); /// get the balance of attack in the bookkeeping variable

var _types2$1;

var PrecompiledError$1 =
/*#__PURE__*/
function (_Error) {
  _inherits(PrecompiledError, _Error);

  function PrecompiledError(msg) {
    var _this;

    _classCallCheck(this, PrecompiledError);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(PrecompiledError).call(this, msg));
    _this.name = 'PrecompiledError';
    return _this;
  }

  return PrecompiledError;
}(_wrapNativeSuper(Error));
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


var ControllerLoader =
/*#__PURE__*/
function () {
  function ControllerLoader() {
    _classCallCheck(this, ControllerLoader);
  }

  _createClass(ControllerLoader, null, [{
    key: "load",

    /**
     * Loads a generic controller
     *
     * @param connection The connection to use
     * @param payer System account that pays to load the controller
     * @param controller BvmAcct to load the controller into
     * @param controllerId Public key that identifies the loader
     * @param data controller octets
     */
    value: function () {
      var _load = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee(connection, payer, controller, controllerId, data) {
        var transaction, dataLayout, chunkSize, offset, array, transactions, bytes, _data, _transaction, _dataLayout, _data2, _transaction2;

        return _regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                transaction = SystemController.createNewAccount(payer.pubKey, controller.pubKey, 1, 0, data.length, controllerId);
                _context.next = 3;
                return launchThenAcknowledgeTx(connection, transaction, payer);

              case 3:
                dataLayout = BufferLayout.struct([BufferLayout.u32('instruction'), BufferLayout.u32('offset'), BufferLayout.u32('bytesLength'), BufferLayout.u32('bytesLengthPadding'), BufferLayout.seq(BufferLayout.u8('byte'), BufferLayout.offset(BufferLayout.u32(), -8), 'bytes')]);
                chunkSize = ControllerLoader.chunkSize;
                offset = 0;
                array = data;
                transactions = [];

              case 8:
                if (!(array.length > 0)) {
                  _context.next = 24;
                  break;
                }

                bytes = array.slice(0, chunkSize);
                _data = Buffer.alloc(chunkSize + 16);
                dataLayout.encode({
                  instruction: 0,
                  // Load instruction
                  offset: offset,
                  bytes: bytes
                }, _data);
                _transaction = new Transaction().add({
                  keys: [{
                    pubkey: controller.pubKey,
                    isSigner: true,
                    isDebitable: true
                  }],
                  controllerId: controllerId,
                  data: _data
                });
                transactions.push(launchThenAcknowledgeTx(connection, _transaction, payer, controller)); // Delay ~1 tick between write transactions in an attempt to reduce AccountInUse errors
                // since all the write transactions modify the same controller account

                _context.next = 16;
                return dormant(1000 / NUM_TICKS_PER_SEC);

              case 16:
                if (!(transactions.length === 8)) {
                  _context.next = 20;
                  break;
                }

                _context.next = 19;
                return Promise.all(transactions);

              case 19:
                transactions = [];

              case 20:
                offset += chunkSize;
                array = array.slice(chunkSize);
                _context.next = 8;
                break;

              case 24:
                _context.next = 26;
                return Promise.all(transactions);

              case 26:
                _dataLayout = BufferLayout.struct([BufferLayout.u32('instruction')]);
                _data2 = Buffer.alloc(_dataLayout.span);

                _dataLayout.encode({
                  instruction: 1 // Finalize instruction

                }, _data2);

                _transaction2 = new Transaction().add({
                  keys: [{
                    pubkey: controller.pubKey,
                    isSigner: true,
                    isDebitable: true
                  }],
                  controllerId: controllerId,
                  data: _data2
                });
                _context.next = 32;
                return launchThenAcknowledgeTx(connection, _transaction2, payer, controller);

              case 32:
                return _context.abrupt("return", controller.pubKey);

              case 33:
              case "end":
                return _context.stop();
            }
          }
        }, _callee);
      }));

      function load(_x, _x2, _x3, _x4, _x5) {
        return _load.apply(this, arguments);
      }

      return load;
    }()
  }, {
    key: "chunkSize",

    /**
     * Amount of controller data placed in each load Transaction
     */
    get: function get() {
      // Keep controller chunks under PACKET_DATA_SIZE, leaving enough room for the
      // rest of the Transaction fields
      //
      // TODO: replace 300 with a proper constant for the size of the other
      // Transaction fields
      return PACKET_DATA_SIZE - 300;
    }
  }]);

  return ControllerLoader;
}();

var type_number = 0;
var type_string = 1;
var type_object = 2;
var type_boolean = 3;

var _types$1 = (_types2$1 = {}, _defineProperty(_types2$1, type_number, 'number'), _defineProperty(_types2$1, type_string, 'string'), _defineProperty(_types2$1, type_object, 'object'), _defineProperty(_types2$1, type_boolean, 'boolean'), _types2$1);

/**
 * Factory class for transactions to interact with a controller loader
 */


var BpfControllerLoader =
/*#__PURE__*/
function () {
  function BpfControllerLoader() {
    _classCallCheck(this, BpfControllerLoader);
  }

  _createClass(BpfControllerLoader, null, [{
    key: "load",

    /**
     * Load a BPF controller
     *
     * @param connection  connection connect to rpc entrypoint
     * @param owner User account to load the controller into it's data field
     * @param elfBytes The entire ELF containing the BPF controller
     */
    value: function load(connection, payer, elf) {
      var controller = new BvmAcct();
      return ControllerLoader.load(connection, payer, controller, BpfControllerLoader.controllerId, elf);
    }
  }, {
    key: "controllerId",

    /**
     * Public key that identifies the BpfControllerLoader
     */
    get: function get() {
      return new BvmAddr('BPFLoader1111111111111111111111111111111111');
    }
  }]);

  return BpfControllerLoader;
}(); // livenet valid

var _$1 = require('lodash');

var _$2 = require('lodash');

var PreCondition =
/*#__PURE__*/
function () {
  function PreCondition() {
    _classCallCheck(this, PreCondition);
  }

  _createClass(PreCondition, [{
    key: "checkState",
    value: function checkState(condition, message) {
      if (!condition) {
        throw new Error("InvalidState");
      }
    }
  }, {
    key: "checkArgument",
    value: function checkArgument(condition, argumentName, message, docsPath) {
      if (!condition) {
        throw new Error("InvalidArgument");
      }
    }
  }, {
    key: "checkArgumentType",
    value: function checkArgumentType(argument, type, argumentName) {

      if (_$2.isString(type)) {
        if (type === 'Buffer') {
          var BufferUtil = require("./buffer");

          if (!BufferUtil.isBuffer(argument)) {
            throw new Error("InvalidArgumentType");
          }
        } else if (_typeof(argument) !== type) {
          throw new Error("InvalidArgumentType");
        }
      } else {
        if (!(argument instanceof type)) {
          // throw new errors.InvalidArgumentType(argument, type.name, argumentName);
          throw new Error("InvalidArgumentType");
        }
      }
    }
  }]);

  return PreCondition;
}();

/**
 * Matched a condiction which created by executing a transaction generated by sealWithSignature()
 * 
 * @typedef {Object} SignatureCond
 * @property {string} type string type for 'signature'
 * @property {BvmAddr} from Public key for whom signed the transaction
 */


/**
 *  Serialie a Payment into buffer to transport on the network.
 * 
 * @private
 */
function serializePayment(payment) {
  var toData = payment.to.converseToBuffer();
  var data = Buffer.alloc(8 + toData.length);
  data.writeUInt32LE(payment.amount, 0);
  toData.copy(data, 8);
  return data;
}
/**
 *  Serialize  a Datetime into buffer to transport on the network.
 * 
 * @private
 */


function serializeTime(when) {
  var data = Buffer.alloc(8 + 20);
  data.writeUInt32LE(20, 0); // size of timestamp as u64

  function iso(date) {
    function pad(number) {
      if (number < 10) {
        return '0' + number;
      }

      return number;
    }

    return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()) + 'T' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ':' + pad(date.getUTCSeconds()) + 'Z';
  }

  data.write(iso(when), 8);
  return data;
}
/**
 * Serialize a BudgetCond into buffer to transport on the network.
 * 
 * @private
 */


function serializeCond(condition) {
  switch (condition.type) {
    case 'timestamp':
      {
        var date = serializeTime(condition.when);
        var from = condition.from.converseToBuffer();
        var data = Buffer.alloc(4 + date.length + from.length);
        data.writeUInt32LE(0, 0); // Condition enum = Timestamp

        date.copy(data, 4);
        from.copy(data, 4 + date.length);
        return data;
      }

    case 'signature':
      {
        var _from = condition.from.converseToBuffer();

        var _data = Buffer.alloc(4 + _from.length);

        _data.writeUInt32LE(1, 0); // Condition enum = Signature


        _from.copy(_data, 4);

        return _data;
      }

    default:
      throw new Error("Unknown condition type: ".concat(condition.type));
  }
}
/**
 * Factory class for transactions to interact with the Budget controller
 */


var BudgetController =
/*#__PURE__*/
function () {
  function BudgetController() {
    _classCallCheck(this, BudgetController);
  }

  _createClass(BudgetController, null, [{
    key: "datetimeCond",

    /**
     * Creates a timestamp condition
     */
    value: function datetimeCond(from, when) {
      return {
        type: 'timestamp',
        from: from,
        when: when
      };
    }
    /**
     * Creates a signature condition
     */

  }, {
    key: "signatureCond",
    value: function signatureCond(from) {
      return {
        type: 'signature',
        from: from
      };
    }
    /**
     * Generates a transaction that transfers difs once any of the conditions are met
     */

  }, {
    key: "pay",
    value: function pay(from, controller, to, amount) {
      var data = Buffer.alloc(1024);
      var pos = 0;
      data.writeUInt32LE(0, pos); // NewBudget instruction

      pos += 4;

      for (var _len = arguments.length, conditions = new Array(_len > 4 ? _len - 4 : 0), _key = 4; _key < _len; _key++) {
        conditions[_key - 4] = arguments[_key];
      }

      switch (conditions.length) {
        case 0:
          {
            data.writeUInt32LE(0, pos); // BudgetExpr enum = Pay

            pos += 4;
            {
              var payment = serializePayment({
                amount: amount,
                to: to
              });
              payment.copy(data, pos);
              pos += payment.length;
            }
            var trimmedData = data.slice(0, pos);
            var transaction = SystemController.createNewAccount(from, controller, amount, amount, trimmedData.length, this.controllerId);
            return transaction.add({
              keys: [{
                pubkey: to,
                isSigner: false,
                isDebitable: false
              }, {
                pubkey: controller,
                isSigner: false,
                isDebitable: true
              }],
              controllerId: this.controllerId,
              data: trimmedData
            });
          }

        case 1:
          {
            data.writeUInt32LE(1, pos); // BudgetExpr enum = After

            pos += 4;
            {
              var condition = conditions[0];
              var conditionData = serializeCond(condition);
              conditionData.copy(data, pos);
              pos += conditionData.length;
              data.writeUInt32LE(0, pos); // BudgetExpr enum = Pay

              pos += 4;
              var paymentData = serializePayment({
                amount: amount,
                to: to
              });
              paymentData.copy(data, pos);
              pos += paymentData.length;
            }

            var _trimmedData = data.slice(0, pos);

            var _transaction = SystemController.createNewAccount(from, controller, amount, amount, _trimmedData.length, this.controllerId);

            return _transaction.add({
              keys: [{
                pubkey: controller,
                isSigner: false,
                isDebitable: true
              }],
              controllerId: this.controllerId,
              data: _trimmedData
            });
          }

        case 2:
          {
            data.writeUInt32LE(2, pos); // BudgetExpr enum = Or

            pos += 4;
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
              for (var _iterator = conditions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var _condition = _step.value;

                var _conditionData = serializeCond(_condition);

                _conditionData.copy(data, pos);

                pos += _conditionData.length;
                data.writeUInt32LE(0, pos); // BudgetExpr enum = Pay

                pos += 4;

                var _paymentData = serializePayment({
                  amount: amount,
                  to: to
                });

                _paymentData.copy(data, pos);

                pos += _paymentData.length;
              }
            } catch (err) {
              _didIteratorError = true;
              _iteratorError = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion && _iterator["return"] != null) {
                  _iterator["return"]();
                }
              } finally {
                if (_didIteratorError) {
                  throw _iteratorError;
                }
              }
            }

            var _trimmedData2 = data.slice(0, pos);

            var _transaction2 = SystemController.createNewAccount(from, controller, amount, amount, _trimmedData2.length, this.controllerId);

            return _transaction2.add({
              keys: [{
                pubkey: controller,
                isSigner: false,
                isDebitable: true
              }],
              controllerId: this.controllerId,
              data: _trimmedData2
            });
          }

        default:
          throw new Error("A maximum of two conditions are support: ".concat(conditions.length, " provided"));
      }
    }
    /**
     * Generates a transaction that transfers difs once both conditions are met
     */

  }, {
    key: "payOnAll",
    value: function payOnAll(from, controller, to, amount, condition1, condition2) {
      var data = Buffer.alloc(1024);
      var pos = 0;
      data.writeUInt32LE(0, pos); // NewBudget instruction

      pos += 4;
      data.writeUInt32LE(3, pos); // BudgetExpr enum = And

      pos += 4;

      for (var _i = 0, _arr = [condition1, condition2]; _i < _arr.length; _i++) {
        var condition = _arr[_i];
        var conditionData = serializeCond(condition);
        conditionData.copy(data, pos);
        pos += conditionData.length;
      }

      data.writeUInt32LE(0, pos); // BudgetExpr enum = Pay

      pos += 4;
      var paymentData = serializePayment({
        amount: amount,
        to: to
      });
      paymentData.copy(data, pos);
      pos += paymentData.length;
      var trimmedData = data.slice(0, pos);
      var transaction = SystemController.createNewAccount(from, controller, amount, amount, trimmedData.length, this.controllerId);
      return transaction.add({
        keys: [{
          pubkey: controller,
          isSigner: false,
          isDebitable: true
        }],
        controllerId: this.controllerId,
        data: trimmedData
      });
    }
    /**
     * Generates a transaction that applies a timestamp, which could enable a
     * pending payment to proceed.
     */

  }, {
    key: "sealWithDatetime",
    value: function sealWithDatetime(from, controller, to, when) {
      var whenData = serializeTime(when);
      var data = Buffer.alloc(4 + whenData.length);
      data.writeUInt32LE(1, 0); // ApplyTimestamp instruction

      whenData.copy(data, 4);
      return new Transaction().add({
        keys: [{
          pubkey: from,
          isSigner: true,
          isDebitable: true
        }, {
          pubkey: controller,
          isSigner: false,
          isDebitable: true
        }, {
          pubkey: to,
          isSigner: false,
          isDebitable: false
        }],
        controllerId: this.controllerId,
        data: data
      });
    }
    /**
     * Generates a transaction that applies a signature, which could enable a
     * pending payment to proceed.
     */

  }, {
    key: "sealWithSignature",
    value: function sealWithSignature(from, controller, to) {
      var dataLayout = BufferLayout.struct([BufferLayout.u32('instruction')]);
      var data = Buffer.alloc(dataLayout.span);
      dataLayout.encode({
        instruction: 2 // ApplySignature instruction

      }, data);
      return new Transaction().add({
        keys: [{
          pubkey: from,
          isSigner: true,
          isDebitable: true
        }, {
          pubkey: controller,
          isSigner: false,
          isDebitable: true
        }, {
          pubkey: to,
          isSigner: false,
          isDebitable: false
        }],
        controllerId: this.controllerId,
        data: data
      });
    }
  }, {
    key: "controllerId",

    /**
     * Public key that identifies the Budget controller
     */
    get: function get() {
      return new BvmAddr('Budget1111111111111111111111111111111111111');
    }
    /**
     * The amount of space this controller requires
     */

  }, {
    key: "size",
    get: function get() {
      return 128;
    }
  }]);

  return BudgetController;
}();

var buffer = require('buffer');

var assert$1 = require('assert'); // var js = require('./js');
/**
  * Fill a buffer with a value.
  *
  * @param {Buffer} buffer
  * @param {number} value
  * @return {Buffer}
  */
// function fill(buffer, value) {
//   PreCondition.checkArgumentType(buffer, 'Buffer', 'buffer');
//   PreCondition.checkArgumentType(value, 'number', 'value');
//   var length = buffer.length;
//   for (var i = 0; i < length; i++) {
//     buffer[i] = value;
//   }
//   return buffer;
// }


var buffer_1$1 = require("buffer");

////////////////////////////////////////////////////////////////////////////////////
// const request = require("request");
var path$1 = require('path');

var Web3$1 = require('web3'); //const AbiCoder = require('web3-eth-abi');


var Promise$2 = require("bluebird"); // const truffle_contract = require('truffle-contract');


var assert$2 = require('assert'); // const tracer = require('../EVM2Code');


var fs$2 = require('fs');

var locks$1 = require('locks'); // mutex


var mutex$1 = locks$1.createMutex();

var async$1 = require('async');

/**
 * Factory class for transactions to interact with a controller loader
 */


var NativeControllerLoader =
/*#__PURE__*/
function () {
  function NativeControllerLoader() {
    _classCallCheck(this, NativeControllerLoader);
  }

  _createClass(NativeControllerLoader, null, [{
    key: "load",

    /**
     * Loads a native controller
     *
     * @param connection The connection to use
     * @param payer System account that pays to load the controller
     * @param controllerName Name of the native controller
     */
    value: function load(connection, payer, controllerName) {
      var bytes = _toConsumableArray(Buffer.from(controllerName));

      var controller = new BvmAcct();
      return ControllerLoader.load(connection, payer, controller, NativeControllerLoader.controllerId, bytes);
    }
  }, {
    key: "controllerId",

    /**
     * Public key that identifies the NativeControllerLoader
     */
    get: function get() {
      return new BvmAddr('NativeLoader1111111111111111111111111111111');
    }
  }]);

  return NativeControllerLoader;
}(); ////////////////////////////////////////////////////////////////////////////////////
 ////////////////////////////////////////////////////////////////////////////////////

/**
 * Some amount of assets
 */
var AssetCount =
/*#__PURE__*/
function (_BN) {
  _inherits(AssetCount, _BN);

  function AssetCount() {
    _classCallCheck(this, AssetCount);

    return _possibleConstructorReturn(this, _getPrototypeOf(AssetCount).apply(this, arguments));
  }

  _createClass(AssetCount, [{
    key: "convertToBuffer",

    /**
     * Convert to Buffer representation
     */
    value: function convertToBuffer() {
      var zero_pad_array = _get(_getPrototypeOf(AssetCount.prototype), "toArray", this).call(this).reverse();

      var new_buffer = Buffer.from(zero_pad_array);

      if (new_buffer.length === 8) {
        return new_buffer;
      }

      assert$3(new_buffer.length < 8, 'AssetCount beyond limitation');
      var zeroPad = Buffer.alloc(8);
      new_buffer.copy(zeroPad);
      return zeroPad;
    }
    /**
     * Construct a AssetCount from Buffer representation
     */

  }], [{
    key: "createFromBuffer",
    value: function createFromBuffer(buffer) {
      assert$3(buffer.length === 8, "Invalid buffer length: ".concat(buffer.length));
      return new BN$1(_toConsumableArray(buffer).reverse().map(function (i) {
        return "00".concat(i.toString(16)).slice(-2);
      }).join(''), 16);
    }
  }]);

  return AssetCount;
}(BN$1);
/**
 * Information about a asset
 */

/**
 * @private
 */
var AssetDetailLayout = BufferLayout.struct([uint64('totalSupply'), BufferLayout.u8('decimalsPosition'), rustString('name'), rustString('symbol')]); /////////////////////////////////////////////////////////////////////////////////////////////

/**
 * @private
 */
var TokenAccountDetailLayout = BufferLayout.struct([pubKey('publickeyOfAsset'), pubKey('publickeyOfOwner'), uint64('amountOfAsset'), BufferLayout.u8('sourceOption'), pubKey('publickeyOfSourceAccount'), uint64('originalAmountOfAsset')]);
// This type exists to workaround an esdoc parse error

/**
 * The built-in asset controller
 */
var SYSTEM_TOKEN_CONTROLLER_ID = new BvmAddr('Token11111111111111111111111111111111111111');
/**
 * An ERC20-like Token
 */

var Asset =
/*#__PURE__*/
function () {
  /**
   * @private
   */

  /**
   * The public key identifying this asset
   */

  /**
   * Controller Identifier for the Token controller
   */

  /**
   * Create a Token object attached to the specific asset
   *
   * @param connection The connection to use
   * @param assetId Public key of the asset
   * @param controllerId Optional asset controllerId, uses the system controllerId by default
   */
  function Asset(connection, assetId) {
    var controllerId = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : SYSTEM_TOKEN_CONTROLLER_ID;

    _classCallCheck(this, Asset);

    _defineProperty(this, "connection", void 0);

    _defineProperty(this, "assetId", void 0);

    _defineProperty(this, "controllerId", void 0);

    Object.assign(this, {
      connection: connection,
      assetId: assetId,
      controllerId: controllerId
    });
  }
  /**
   * Create a new Asset
   *
   * @param connection The connection to use
   * @param ownerOfAsset User account that will own the returned Asset BvmAcct
   * @param totalSupply Total supply of the new asset
   * @param assetName Descriptive name of this asset
   * @param assetSymbol Symbol for this asset
   * @param assetDecimals Location of the decimal place
   * @param controllerId Optional asset controllerId, uses the system controllerId by default
   * @return Token object for the newly minted asset, Public key of the Asset BvmAcct holding the total supply of new assets
   */


  _createClass(Asset, [{
    key: "createNewAssetAccount",

    /**
     * Create a new and empty asset account.
     *
     * This account may then be used as a `transferAsset()` or `authorize()` destination
     *
     * @param ownerAccount User account that will own the new asset account
     * @param bvmAddrOfSourceAccount If not null, create a delegate account that when authorized
     *               may transfer assets from this `source` account
     * @return Public key of the new empty asset account
     */
    value: function () {
      var _createNewAssetAccount = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee(ownerAccount) {
        var bvmAddrOfSourceAccount,
            assetAccount,
            transaction,
            dataLayout,
            data,
            keys,
            _args = arguments;
        return _regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                bvmAddrOfSourceAccount = _args.length > 1 && _args[1] !== undefined ? _args[1] : null;
                assetAccount = new BvmAcct();
                dataLayout = BufferLayout.struct([BufferLayout.u32('instruction')]);
                data = Buffer.alloc(dataLayout.span);
                dataLayout.encode({
                  instruction: 1 // NewTokenAccount instruction

                }, data); // Allocate memory for the asset

                transaction = SystemController.createNewAccount(ownerAccount.pubKey, assetAccount.pubKey, 1, 0, 1 + TokenAccountDetailLayout.span, this.controllerId);
                _context.next = 8;
                return launchThenAcknowledgeTx(this.connection, transaction, ownerAccount);

              case 8:
                // Initialize the asset account
                keys = [{
                  pubkey: assetAccount.pubKey,
                  isSigner: true,
                  isDebitable: true
                }, {
                  pubkey: ownerAccount.pubKey,
                  isSigner: false,
                  isDebitable: false
                }, {
                  pubkey: this.assetId,
                  isSigner: false,
                  isDebitable: false
                }];

                if (bvmAddrOfSourceAccount) {
                  keys.push({
                    pubkey: bvmAddrOfSourceAccount,
                    isSigner: false,
                    isDebitable: false
                  });
                }

                transaction = new Transaction().add({
                  keys: keys,
                  controllerId: this.controllerId,
                  data: data
                });
                _context.next = 13;
                return launchThenAcknowledgeTx(this.connection, transaction, ownerAccount, assetAccount);

              case 13:
                return _context.abrupt("return", assetAccount.pubKey);

              case 14:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function createNewAssetAccount(_x13) {
        return _createNewAssetAccount.apply(this, arguments);
      }

      return createNewAssetAccount;
    }()
    /**
     * Retrieve asset information
     */

  }, {
    key: "fetchAssetDetail",
    value: function () {
      var _fetchAssetDetail = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee2() {
        var fetchAccountDetail, data, fetchTokenDetail;
        return _regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return this.connection.fetchAccountDetail(this.assetId);

              case 2:
                fetchAccountDetail = _context2.sent;

                if (fetchAccountDetail.owner.checkIfEquals(this.controllerId)) {
                  _context2.next = 5;
                  break;
                }

                throw new Error("Invalid asset owner: ".concat(JSON.stringify(fetchAccountDetail.owner)));

              case 5:
                data = Buffer.from(fetchAccountDetail.data);

                if (!(data.readUInt8(0) !== 1)) {
                  _context2.next = 8;
                  break;
                }

                throw new Error("Invalid asset data");

              case 8:
                fetchTokenDetail = AssetDetailLayout.decode(data, 1);
                fetchTokenDetail.totalSupply = AssetCount.createFromBuffer(fetchTokenDetail.totalSupply);
                return _context2.abrupt("return", fetchTokenDetail);

              case 11:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function fetchAssetDetail() {
        return _fetchAssetDetail.apply(this, arguments);
      }

      return fetchAssetDetail;
    }()
    /**
     * Retrieve account information
     *
     * @param account Public key of the asset account
     */

  }, {
    key: "fetchAccountDetail",
    value: function () {
      var _fetchAccountDetail = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee3(account) {
        var fetchAccountDetail, data, tokenAccountInfo;
        return _regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return this.connection.fetchAccountDetail(account);

              case 2:
                fetchAccountDetail = _context3.sent;

                if (fetchAccountDetail.owner.checkIfEquals(this.controllerId)) {
                  _context3.next = 5;
                  break;
                }

                throw new Error("Invalid asset account owner");

              case 5:
                data = Buffer.from(fetchAccountDetail.data);

                if (!(data.readUInt8(0) !== 2)) {
                  _context3.next = 8;
                  break;
                }

                throw new Error("Invalid asset account data");

              case 8:
                tokenAccountInfo = TokenAccountDetailLayout.decode(data, 1);
                tokenAccountInfo.publickeyOfAsset = new BvmAddr(tokenAccountInfo.publickeyOfAsset);
                tokenAccountInfo.publickeyOfOwner = new BvmAddr(tokenAccountInfo.publickeyOfOwner);
                tokenAccountInfo.amountOfAsset = AssetCount.createFromBuffer(tokenAccountInfo.amountOfAsset);

                if (tokenAccountInfo.sourceOption === 0) {
                  tokenAccountInfo.publickeyOfSourceAccount = null;
                  tokenAccountInfo.originalAmountOfAsset = new AssetCount();
                } else {
                  tokenAccountInfo.publickeyOfSourceAccount = new BvmAddr(tokenAccountInfo.publickeyOfSourceAccount);
                  tokenAccountInfo.originalAmountOfAsset = AssetCount.createFromBuffer(tokenAccountInfo.originalAmountOfAsset);
                }

                if (tokenAccountInfo.publickeyOfAsset.checkIfEquals(this.assetId)) {
                  _context3.next = 15;
                  break;
                }

                throw new Error("Invalid asset account bvmaddr: ".concat(JSON.stringify(tokenAccountInfo.publickeyOfAsset), " !== ").concat(JSON.stringify(this.assetId)));

              case 15:
                return _context3.abrupt("return", tokenAccountInfo);

              case 16:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function fetchAccountDetail(_x14) {
        return _fetchAccountDetail.apply(this, arguments);
      }

      return fetchAccountDetail;
    }()
    /**
     * Transfer assets to another account
     *
     * @param owner Owner of the source asset account
     * @param source Source asset account
     * @param destination Destination asset account
     * @param amount Number of assets to transfer
     */

  }, {
    key: "transferAsset",
    value: function () {
      var _transferAsset = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee4(owner, source, destination, amount) {
        return _regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _context4.t0 = launchThenAcknowledgeTx;
                _context4.t1 = this.connection;
                _context4.t2 = new Transaction();
                _context4.next = 5;
                return this.transferOperation(owner.pubKey, source, destination, amount);

              case 5:
                _context4.t3 = _context4.sent;
                _context4.t4 = _context4.t2.add.call(_context4.t2, _context4.t3);
                _context4.t5 = owner;
                _context4.next = 10;
                return (0, _context4.t0)(_context4.t1, _context4.t4, _context4.t5);

              case 10:
                return _context4.abrupt("return", _context4.sent);

              case 11:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function transferAsset(_x15, _x16, _x17, _x18) {
        return _transferAsset.apply(this, arguments);
      }

      return transferAsset;
    }()
    /**
     * Grant a third-party permission to transfer up the specified number of assets from an account
     *
     * @param ownerAccount Owner of the source asset account
     * @param publickeyOfAssetAccount Public key of the asset account
     * @param publickeyOfDelegateAccount Token account authorized to perform a transfer assets from the source account
     * @param amountAsset Maximum number of assets the delegate may transfer
     */

  }, {
    key: "authorize",
    value: function () {
      var _authorize = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee5(ownerAccount, publickeyOfAssetAccount, publickeyOfDelegateAccount, amountAsset) {
        return _regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return launchThenAcknowledgeTx(this.connection, new Transaction().add(this.approveOperation(ownerAccount.pubKey, publickeyOfAssetAccount, publickeyOfDelegateAccount, amountAsset)), ownerAccount);

              case 2:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function authorize(_x19, _x20, _x21, _x22) {
        return _authorize.apply(this, arguments);
      }

      return authorize;
    }()
    /**
     * Remove approval for the transfer of any remaining assets
     *
     * @param ownerAccount Owner of the source asset account
     * @param publickeyOfAssetAccount Public key of the asset account
     * @param publickeyOfDelegateAccount Token account to revoke authorization from
     */

  }, {
    key: "unauthorize",
    value: function unauthorize(ownerAccount, publickeyOfAssetAccount, publickeyOfDelegateAccount) {
      return this.authorize(ownerAccount, publickeyOfAssetAccount, publickeyOfDelegateAccount, 0);
    }
    /**
     * Assign a new owner to the account
     *
     * @param ownerAccount Owner of the asset account
     * @param publickeyOfAssetAccount Public key of the asset account
     * @param publickeyOfNewOwner New owner of the asset account
     */

  }, {
    key: "setNewOwnerToAssetAccount",
    value: function () {
      var _setNewOwnerToAssetAccount = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee6(ownerAccount, publickeyOfAssetAccount, publickeyOfNewOwner) {
        return _regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return launchThenAcknowledgeTx(this.connection, new Transaction().add(this.setOwnerOperation(ownerAccount.pubKey, publickeyOfAssetAccount, publickeyOfNewOwner)), ownerAccount);

              case 2:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function setNewOwnerToAssetAccount(_x23, _x24, _x25) {
        return _setNewOwnerToAssetAccount.apply(this, arguments);
      }

      return setNewOwnerToAssetAccount;
    }()
    /**
     * Construct a Transfer instruction
     *
     * @param publickeyOfOwnerSourceAccount Owner of the source asset account
     * @param publickeyOfSourceAccount Source asset account
     * @param publickeyOfDestinationAccount Destination asset account
     * @param amount Number of assets to transfer
     */

  }, {
    key: "transferOperation",
    value: function () {
      var _transferOperation = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee7(publickeyOfOwnerSourceAccount, publickeyOfSourceAccount, publickeyOfDestinationAccount, amountAsset) {
        var fetchAccountDetail, dataLayout, data, keys;
        return _regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.next = 2;
                return this.fetchAccountDetail(publickeyOfSourceAccount);

              case 2:
                fetchAccountDetail = _context7.sent;

                if (publickeyOfOwnerSourceAccount.checkIfEquals(fetchAccountDetail.publickeyOfOwner)) {
                  _context7.next = 5;
                  break;
                }

                throw new Error('BvmAcct owner mismatch');

              case 5:
                dataLayout = BufferLayout.struct([BufferLayout.u32('instruction'), uint64('amountAsset')]);
                data = Buffer.alloc(dataLayout.span);
                dataLayout.encode({
                  instruction: 2,
                  // Transfer instruction
                  amountAsset: new AssetCount(amountAsset).convertToBuffer()
                }, data);
                keys = [{
                  pubkey: publickeyOfOwnerSourceAccount,
                  isSigner: true,
                  isDebitable: false
                }, {
                  pubkey: publickeyOfSourceAccount,
                  isSigner: false,
                  isDebitable: true
                }, {
                  pubkey: publickeyOfDestinationAccount,
                  isSigner: false,
                  isDebitable: true
                }];

                if (fetchAccountDetail.publickeyOfSourceAccount) {
                  keys.push({
                    pubkey: fetchAccountDetail.publickeyOfSourceAccount,
                    isSigner: false,
                    isDebitable: true
                  });
                }

                return _context7.abrupt("return", new TxOperation({
                  keys: keys,
                  controllerId: this.controllerId,
                  data: data
                }));

              case 11:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function transferOperation(_x26, _x27, _x28, _x29) {
        return _transferOperation.apply(this, arguments);
      }

      return transferOperation;
    }()
    /**
     * Construct an Approve instruction
     *
     * @param owner Owner of the source asset account
     * @param account Public key of the asset account
     * @param delegate Token account authorized to perform a transfer assets from the source account
     * @param amount Maximum number of assets the delegate may transfer
     */

  }, {
    key: "approveOperation",
    value: function approveOperation(owner, account, delegate, amount) {
      var dataLayout = BufferLayout.struct([BufferLayout.u32('instruction'), uint64('amount')]);
      var data = Buffer.alloc(dataLayout.span);
      dataLayout.encode({
        instruction: 3,
        // Approve instruction
        amount: new AssetCount(amount).convertToBuffer()
      }, data);
      return new TxOperation({
        keys: [{
          pubkey: owner,
          isSigner: true,
          isDebitable: false
        }, {
          pubkey: account,
          isSigner: false,
          isDebitable: true
        }, {
          pubkey: delegate,
          isSigner: false,
          isDebitable: true
        }],
        controllerId: this.controllerId,
        data: data
      });
    }
    /**
     * Construct an Revoke instruction
     *
     * @param owner Owner of the source asset account
     * @param account Public key of the asset account
     * @param delegate Token account authorized to perform a transfer assets from the source account
     */

  }, {
    key: "revokeOperation",
    value: function revokeOperation(owner, account, delegate) {
      return this.approveOperation(owner, account, delegate, 0);
    }
    /**
     * Construct a SetOwner instruction
     *
     * @param owner Owner of the asset account
     * @param account Public key of the asset account
     * @param newOwner New owner of the asset account
     */

  }, {
    key: "setOwnerOperation",
    value: function setOwnerOperation(owner, account, newOwner) {
      var dataLayout = BufferLayout.struct([BufferLayout.u32('instruction')]);
      var data = Buffer.alloc(dataLayout.span);
      dataLayout.encode({
        instruction: 4 // SetOwner instruction

      }, data);
      return new TxOperation({
        keys: [{
          pubkey: owner,
          isSigner: true,
          isDebitable: false
        }, {
          pubkey: account,
          isSigner: false,
          isDebitable: true
        }, {
          pubkey: newOwner,
          isSigner: false,
          isDebitable: true
        }],
        controllerId: this.controllerId,
        data: data
      });
    }
  }], [{
    key: "createNewAsset",
    value: function () {
      var _createNewAsset = _asyncToGenerator(
      /*#__PURE__*/
      _regeneratorRuntime.mark(function _callee8(connection, ownerOfAsset, totalSupply, assetName, assetSymbol, assetDecimals) {
        var controllerId,
            assetAccount,
            asset,
            publickeyOfStoreAssetAccount,
            transaction,
            dataLayout,
            data,
            encodeLength,
            _args8 = arguments;
        return _regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                controllerId = _args8.length > 6 && _args8[6] !== undefined ? _args8[6] : SYSTEM_TOKEN_CONTROLLER_ID;
                assetAccount = new BvmAcct();
                asset = new Asset(connection, assetAccount.pubKey, controllerId);
                _context8.next = 5;
                return asset.createNewAssetAccount(ownerOfAsset, null);

              case 5:
                publickeyOfStoreAssetAccount = _context8.sent;
                dataLayout = BufferLayout.struct([BufferLayout.u32('instruction'), uint64('totalSupply'), BufferLayout.u8('assetDecimals'), rustString('assetName'), rustString('assetSymbol')]);
                data = Buffer.alloc(1024);
                encodeLength = dataLayout.encode({
                  instruction: 0,
                  // NewToken instruction
                  totalSupply: totalSupply.convertToBuffer(),
                  assetDecimals: assetDecimals,
                  assetName: assetName,
                  assetSymbol: assetSymbol
                }, data);
                data = data.slice(0, encodeLength);
                // Allocate memory for the assetAccount account
                transaction = SystemController.createNewAccount(ownerOfAsset.pubKey, assetAccount.pubKey, 1, 0, 1 + data.length, controllerId);
                _context8.next = 13;
                return launchThenAcknowledgeTx(connection, transaction, ownerOfAsset);

              case 13:
                transaction = new Transaction().add({
                  keys: [{
                    pubkey: assetAccount.pubKey,
                    isSigner: true,
                    isDebitable: false
                  }, {
                    pubkey: publickeyOfStoreAssetAccount,
                    isSigner: false,
                    isDebitable: true
                  }],
                  controllerId: controllerId,
                  data: data
                });
                _context8.next = 16;
                return launchThenAcknowledgeTx(connection, transaction, ownerOfAsset, assetAccount);

              case 16:
                return _context8.abrupt("return", [asset, publickeyOfStoreAssetAccount]);

              case 17:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8);
      }));

      function createNewAsset(_x30, _x31, _x32, _x33, _x34, _x35) {
        return _createNewAsset.apply(this, arguments);
      }

      return createNewAsset;
    }()
  }]);

  return Asset;
}(); //////////////////////////////////////////////////////////////////////////////////////////////

var fs$3 = require('fs');
/**
 * send transaction to the network
 * get transaction's status by signature
 */


function launchThenAcknowledgeNativeTxn(_x, _x2) {
  return _launchThenAcknowledgeNativeTxn.apply(this, arguments);
}

function _launchThenAcknowledgeNativeTxn() {
  _launchThenAcknowledgeNativeTxn = _asyncToGenerator(
  /*#__PURE__*/
  _regeneratorRuntime.mark(function _callee(connection, originalTransaction) {
    var start_time, tx_signature, tx_status, failed_status_retries, duration;
    return _regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            start_time = Date.now();
            _context.next = 3;
            return connection.sendNativeTxn(originalTransaction);

          case 3:
            tx_signature = _context.sent;
            // Wait up to a couple slots for a confirmation
            tx_status = null;
            failed_status_retries = 6;

          case 6:
            _context.next = 8;
            return connection.fetchSignatureState(tx_signature);

          case 8:
            tx_status = _context.sent;

            if (!tx_status) {
              _context.next = 11;
              break;
            }

            return _context.abrupt("break", 18);

          case 11:
            _context.next = 13;
            return dormant(500 * DEFAULT_TICKS_PER_SLOT / NUM_TICKS_PER_SEC);

          case 13:
            if (!(--failed_status_retries <= 0)) {
              _context.next = 16;
              break;
            }

            duration = (Date.now() - start_time) / 1000;
            throw new Error("Raw Transaction '".concat(tx_signature, "' was not confirmed in ").concat(duration.toFixed(2), " seconds (").concat(JSON.stringify(tx_status), ")"));

          case 16:
            _context.next = 6;
            break;

          case 18:
            if (!(tx_status && 'Ok' in tx_status)) {
              _context.next = 20;
              break;
            }

            return _context.abrupt("return", tx_signature);

          case 20:
            throw new Error("Raw transaction ".concat(tx_signature, " failed (").concat(JSON.stringify(tx_status), ")"));

          case 21:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));
  return _launchThenAcknowledgeNativeTxn.apply(this, arguments);
}

var testnetDefaultChannel = "edge";

/**
 * @private
 */

var endpoint = {
  edge: 'https://api.edge.testnet.bitconch.com',
  beta: 'https://api.beta.testnet.bitconch.com',
  stable: 'https://api.testnet.bitconch.com'
};
/**
 * Retrieves the RPC address for the specified testnet release
 * channel
 */

function testnetChannelEndpoint(channel) {
  if (!channel) {
    return endpoint[testnetDefaultChannel];
  }

  if (endpoint[channel]) {
    return endpoint[channel];
  }

  throw new Error("Unknown channel: ".concat(channel));
}

///

exports.Asset = Asset;
exports.AssetCount = AssetCount;
exports.BpfControllerLoader = BpfControllerLoader;
exports.BudgetController = BudgetController;
exports.BvmAcct = BvmAcct;
exports.BvmAddr = BvmAddr;
exports.Connection = Connection;
exports.ControllerLoader = ControllerLoader;
exports.NativeControllerLoader = NativeControllerLoader;
exports.PreCondition = PreCondition;
exports.RpcCall = RpcCall_1;
exports.RpcParameter = RpcParameter_1;
exports.SystemController = SystemController;
exports.Transaction = Transaction;
exports.TxOperation = TxOperation;
exports.launchThenAcknowledgeNativeTxn = launchThenAcknowledgeNativeTxn;
exports.launchThenAcknowledgeTx = launchThenAcknowledgeTx;
exports.testnetChannelEndpoint = testnetChannelEndpoint;
//# sourceMappingURL=index.cjs.js.map
