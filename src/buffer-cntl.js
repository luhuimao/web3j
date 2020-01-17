// @flow


/// the last call
var lastCall = new Map();
/// the call function list for the execution
var sequence_call_list = [];
/// the executed call sequence
var sequence_executed = [];
/// the index in sequence_executed
var sequeExe_index = 0;
/// the sequence_exexuted become more meaningful
var sequeExe_meaningful = false;
/// the execution results of a call function
var exec_results = [];
/// another new call seqeunce
var new_sequence_start = false;

/// the hash of previous transaction
var pre_txHash = "0x0";
var startTime, endTime;
var timeDiff;

/// the candidate abi that can be used to start transaction
var cand_sequence = [];

var reset_num = 0;
var reset_index = 0;

var fuzzing_finish = false;

import * as BufferLayout from 'buffer-layout';

/// the mutation for gas neighbor
var gas_neighbor = [];
gas_neighbor.push('0.01');
gas_neighbor.push('0.1');
gas_neighbor.push('0.2');
gas_neighbor.push('0.3');
gas_neighbor.push('0.5');
gas_neighbor.push('0.8');
gas_neighbor.push('0.9');
gas_neighbor.push('0.92');
gas_neighbor.push('0.93');
gas_neighbor.push('0.95');
gas_neighbor.push('0.96');
gas_neighbor.push('0.97');
gas_neighbor.push('0.98');
gas_neighbor.push('0.99');
gas_neighbor.push('1.01');
gas_neighbor.push('1.02');
gas_neighbor.push('1.03');
gas_neighbor.push('1.0');
gas_neighbor.push('1.05');
gas_neighbor.push('1.06');
gas_neighbor.push('1.08');
gas_neighbor.push('1.1');
gas_neighbor.push('1.2');
gas_neighbor.push('1.5');
gas_neighbor.push('1.7');
gas_neighbor.push('2.0');
gas_neighbor.push('3.0');
gas_neighbor.push('5.0');
gas_neighbor.push('10.0');
gas_neighbor.push('50.0');
gas_neighbor.push('80.0');
gas_neighbor.push('100.0');
gas_neighbor.push('1000.0');

/**
 * Layout for a bvm address
 */
export const pubKey = (property: string = 'pubKey'): Object => {
  return BufferLayout.blob(32, property);
};

/// the mutation operation for uint neighbor
var uint_neighbor = [];
uint_neighbor.push('1.05');
uint_neighbor.push('0.95');
uint_neighbor.push('1.1');
uint_neighbor.push('0.9');
uint_neighbor.push('1.15');
uint_neighbor.push('0.85');  
uint_neighbor.push('1.2');
uint_neighbor.push('0.8');
uint_neighbor.push('1.5');
uint_neighbor.push('0.5');
uint_neighbor.push('2.0');
uint_neighbor.push('0.02');  
uint_neighbor.push('3.0');
uint_neighbor.push('0.015'); 
uint_neighbor.push('4.0');
uint_neighbor.push('0.01'); 
uint_neighbor.push('5.0');
uint_neighbor.push('0.001'); 
uint_neighbor.push('0.0001')
uint_neighbor.push(1);
uint_neighbor.push(-1);
uint_neighbor.push(2);
uint_neighbor.push(-2);
uint_neighbor.push(4);
uint_neighbor.push(-4);
uint_neighbor.push(8);
uint_neighbor.push(-8);

/**
 * Layout for a 64bit unsigned value
 */
export const uint64 = (property: string = 'uint64'): Object => {
  return BufferLayout.blob(8, property);
};

/**
 * Layout for a Rust String type
 */
export const rustString = (property: string = 'string') => {
  const rsl = BufferLayout.struct(
    [
      BufferLayout.u32('length'),
      BufferLayout.u32('lengthPadding'),
      BufferLayout.blob(BufferLayout.offset(BufferLayout.u32(), -8), 'chars'),
    ],
    property,
  );
  const _decode = rsl.decode.bind(rsl);
  const _encode = rsl.encode.bind(rsl);

  rsl.decode = (buffer, offset) => {
    const data = _decode(buffer, offset);
    return data.chars.toString('utf8');
  };

  rsl.encode = (str, buffer, offset) => {
    const data = {
      chars: Buffer.from(str, 'utf8'),
    };
    return _encode(data, buffer, offset);
  };

  return rsl;
};


async function reset() {
  if (target_con === undefined) {
    throw "Target contract is not loaded!";
  }
  if (attack_con === undefined) {
    throw "Attack contract is not loaded!";
  }
  // await resetBookKeeping();
  await redeploy();
  return "Contracts are reset!";
}


/// find the bookkeeping variable
async function findBookKeepingAbi(abis) {
  for (var abi of abis) {
    if (abi.type === 'function' && abi.constant &&
        abi.inputs.length === 1 && abi.inputs[0].type === 'address' &&
        abi.outputs.length === 1 && abi.outputs[0].type === 'uint256') {
      return abi;
    }
  }
  throw "Cannot find bookkeeping variable!";
  return;
}


async function findCandSequence(target_abis, attack_abis){
  var target_switch = true;
  var attack_switch = true;

  if(target_switch){
    await target_abis.forEach(function(abi) {
      /// if abi.constant is true, it would not change state variables
      if (abi.type === 'function' && abi.constant == false){
        var notsupport = false;
        var input_len = abi.inputs.length;
        var input_index = 0;
        while(input_index < input_len){
          var input = abi.inputs[input_index];
          if(input.type.indexOf('address') !== 0 && input.type.indexOf('uint') !== 0){
            notsupport = true;
            break;
          }
          input_index += 1;
        }
        if(!notsupport){
          cand_sequence.push(abi);
        }
      }
    }); 
  }
  if(attack_switch){
    await attack_abis.forEach(function(abi) {
      if (abi.type === 'function' && abi.constant == false){
        var notsupport = false;
        var input_len = abi.inputs.length;
        var input_index = 0;
        while(input_index < input_len){
          var input = abi.inputs[input_index];
          if(input.type.indexOf('address') !== 0 && input.type.indexOf('uint') !== 0){
            notsupport = true;
            break;
          }
          input_index += 1;
        }
        if(!notsupport){
          cand_sequence.push(abi);
        }
      }
    }); 
  }
}