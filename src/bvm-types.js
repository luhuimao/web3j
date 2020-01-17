// @flow

//////////////////////////////////////////////////////////////////////////////
/// json file
var target_artifact;
var attack_artifact
// truffle-contract abstractions
var targetContract;
var attackContract;

// web3 abstractions
var web3;
var target_con;
var attack_con;
var account_list;
var bookKeepingAbi;

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
//////////////////////////////////////////////////////////////////////////////

export const pubKey = (property: string = 'pubKey'): Object => {
  return BufferLayout.blob(32, property);
};


export const uint64 = (property: string = 'uint64'): Object => {
  return BufferLayout.blob(8, property);
};


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


async function load(targetPath, attackPath, targetSolPath, attackSolPath) {
    //var execSync = require('child_process').execSync;
    //var cmdStr = "sh ./startTruffle.sh";
    //execSync(cmdStr, {stdio: [process.stdin, process.stdout, process.stderr]});

    var self = this;
    web3 = self.web3;
    try {
      startTime = new Date();
      account_list = await web3.eth.getAccounts();

      target_artifact = require(targetPath);
      targetContract = contract(target_artifact);
      targetContract.setProvider(self.web3.currentProvider);
      attack_artifact = require(attackPath);
      attackContract = contract(attack_artifact);
      attackContract.setProvider(self.web3.currentProvider);

      // This is workaround: https://github.com/trufflesuite/truffle-contract/issues/57
      if (typeof targetContract.currentProvider.sendAsync !== "function") {
        targetContract.currentProvider.sendAsync = function() {
          return targetContract.currentProvider.send.apply(
            targetContract.currentProvider, arguments);
        };
      }
      
      if (typeof attackContract.currentProvider.sendAsync !== "function") {
        attackContract.currentProvider.sendAsync = function() {
          return attackContract.currentProvider.send.apply(
            attackContract.currentProvider, arguments);
        };
      }
      var target_abs = await targetContract.deployed();
      var attack_abs = await attackContract.deployed();

      // target_con = await new web3.eth.Contract(target_abs.abi, target_abs.address);
      // attack_con = await new web3.eth.Contract(attack_abs.abi, attack_abs.address);
      // /// add the attack contract address
      // account_list.push(attack_con.options.address);

      // // find bookkeeping var
      // bookKeepingAbi = await findBookKeepingAbi(target_con._jsonInterface);

      // /// all the possible abi
      // cand_sequence = [];
      // await findCandSequence(target_con._jsonInterface, attack_con._jsonInterface);

      // // /// the set of statements
      // attackStmt_set = await tracer.buildStmtSet(attack_artifact.sourcePath,
      //   attack_artifact.deployedSourceMap,
      //   attack_artifact.source);

      // targetStmt_set = await tracer.buildStmtSet(target_artifact.sourcePath,
      //   target_artifact.deployedSourceMap,
      //   target_artifact.source);     
      
      // /// the map that the instruction corresponds to the statement 
      // attackIns_map = await tracer.buildInsMap(
      //   attack_artifact.sourcePath,
      //   attack_artifact.deployedBytecode,
      //   attack_artifact.deployedSourceMap,
      //   attack_artifact.source);

      // targetIns_map = await tracer.buildInsMap(
      //   target_artifact.sourcePath,
      //   target_artifact.deployedBytecode,
      //   target_artifact.deployedSourceMap,
      //   target_artifact.source);

      // /// the static dependencies
      // staticDep_target = await tracer.buildStaticDep(targetSolPath);
      // staticDep_attack = await tracer.buildStaticDep(attackSolPath);

    } catch (e) {
      console.log(e);
      return e.message;
    }
    return {
      // accounts: account_list,
      // target_adds: target_con.options.address,
      // attack_adds: attack_con.options.address,
      // target_abi: target_con._jsonInterface,
      // attack_abi: attack_con._jsonInterface
    };
  }