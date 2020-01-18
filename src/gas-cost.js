// @flow

// const constant = require('./constant');
const { check, string, number } = require('./../../common/typeCheck');

const TABLE_FACTORY_PRECOMPILE_ADDRESS = '0x0000000000000000000000000000000000001001';
const CRUD_PRECOMPILE_ADDRESS = '0x0000000000000000000000000000000000001002';

const TABLE_FACTORY_PRECOMPILE_ABI = {
    'createTable': { "constant": false, "inputs": [{ "name": "tableName", "type": "string" }, { "name": "key", "type": "string" }, { "name": "valueField", "type": "string" }], "name": "createTable", "outputs": [{ "name": "", "type": "int256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }
};
const CRUD_PRECOMPILE_ABI = {
    'update': { "constant": false, "inputs": [{ "name": "tableName", "type": "string" }, { "name": "key", "type": "string" }, { "name": "entry", "type": "string" }, { "name": "condition", "type": "string" }, { "name": "optional", "type": "string" }], "name": "update", "outputs": [{ "name": "", "type": "int256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" },
    'select': { "constant": true, "inputs": [{ "name": "tableName", "type": "string" }, { "name": "key", "type": "string" }, { "name": "condition", "type": "string" }, { "name": "optional", "type": "string" }], "name": "select", "outputs": [{ "name": "", "type": "string" }], "payable": false, "stateMutability": "view", "type": "function" },
    'insert': { "constant": false, "inputs": [{ "name": "tableName", "type": "string" }, { "name": "key", "type": "string" }, { "name": "entry", "type": "string" }, { "name": "optional", "type": "string" }], "name": "insert", "outputs": [{ "name": "", "type": "int256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" },
    'remove': { "constant": false, "inputs": [{ "name": "tableName", "type": "string" }, { "name": "key", "type": "string" }, { "name": "condition", "type": "string" }, { "name": "optional", "type": "string" }], "name": "remove", "outputs": [{ "name": "", "type": "int256" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }
};

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


/**
 * @typedef {Object} GasCounter
 * @property {number} difsPerSignature difs Cost in difs to validate a signature
 * @property {number} targetDifsPerSignature
 * @property {number} targetSignaturesPerSlot
 */
export type GasCounter = {
  difsPerSignature: number,
  targetSignaturesPerSlot: number,
  targetDifsPerSignature: number,
};


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