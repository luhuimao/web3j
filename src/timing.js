// @flow



/// conver scientific number to string
function uintToString(num){
  var num_str = "" + num;
  /// scientific number
  var index = num_str.indexOf("+");
  if(index != -1){
    var result = num_str[0];
    var power_len = parseInt(num_str.slice(index +1), 10);
    var power_index = 0;
    while(power_index < power_len){
      /// num_str[index-1:] is 'e+...'
      if((power_index +2) < (index -1)){
        result += num_str[power_index +2];
      }
      else{
        result += '0';
      }
      power_index += 1;
    }
    return result;
  }
  else{
    return num_str;
  }
}

/// generate an unsigned integer
/// unum_min is defined, in most case it is 0
/// unum_max may not be defined, e.g., undefined
function gen_uint(uint_type, unum_min, unum_max){
  /// get rid of uint in e.g., 'uint256'
  var num_left = 4;
  /// maybe it is an array, e,g., 'uint256[]'
  var num_right = uint_type.indexOf('[');
  if(num_right == -1){
    /// it is primitive unit, not an array
    num_right = uint_type.length;
  } 
  /// the number of bytes
  var byte_num = parseInt(uint_type.slice(num_left, num_right), 10) / 8;
  var byte_index = 0;
  var num_str = '0x';
  while(byte_index < byte_num){
    num_str += 'ff';
    byte_index += 1;
  }
  if(unum_max === undefined){
    /// unum_max is undefined, we use the default maximum value
    unum_max = parseInt(num_str, 16); 
  }
  else{
    var num_max = parseInt(num_str, 16);
    if(num_max < unum_max){
      unum_max = num_max;
    }
  }
  if(uint_type.indexOf('[') == -1){
    /// primitive type
    var value_int = randomNum(unum_min, unum_max);
    var value = uintToString(value_int);
    return value;
  }
  else if(adds_type.indexOf('[]') != -1){
    /// dynamic array
    var value_list = [];
    var value_num = randomNum(dyn_array_min, dyn_array_max);
    var value_index = 0;
    while(value_index < value_num){
      var value_int = randomNum(unum_min, unum_max);
      var value = uintToString(value_int);;      
      value_list.push(value);
      value_index += 1;
    }
    return value_list;
  }
  else{
    /// static array
    var value_list = [];
    var left_index = uint_type.indexOf('[');
    var right_index = uint_type.indexOf(']');
    var value_num = parseInt(uint_type.slice(left_index +1, right_index), 10);
    var value_index = 0;
    while(value_index < value_num){
      var value_int = randomNum(unum_min, unum_max);
      var value = uintToString(value_int);
      value_list.push(value);
      value_index += 1;
    }
    return value_list;
  }
}

/**
 * @ignore
 */
export const NUM_TICKS_PER_SEC = 10;

// tracer abstractions at instruction level
var targetIns_map;
var attackIns_map;

// static dependency
var staticDep_target;
var staticDep_attack;

/// the gas amount
const gasMin = 25000;
const gasMax = 8000000000;
/// dynamci array
const dyn_array_min = 1;
const dyn_array_max = 10;

/**
 * @ignore
 */
export const DEFAULT_TICKS_PER_SLOT = 8;




/// the maximum length of seed_callSequence
const sequence_maxLen = 4;
/// the maximum number of muated call sequences 
const mutateSeque_maxLen = 4;
/// the maximum number of muated operation for each call sequence
const mutateOper_maxLen = 3;
/// the maximum length of changed call sequence
const operSeque_maxLen = 3;

/// the set to keep the coverage for guided fuzzing
var stmt_trace = [];
var seque_stmt_trace = [];
var trans_depen_set = new Set();
var seque_depen_set = new Set();
var contr_depen_set = new Set();

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