// @flow


////////////////////////////////////////////////////////////////////////////////////
// const request = require("request");
const path = require('path');

const Web3 = require('web3');
//const AbiCoder = require('web3-eth-abi');

const Promise = require("bluebird");
// const truffle_contract = require('truffle-contract');
const assert = require('assert');
// const tracer = require('../EVM2Code');
const fs = require('fs');
const locks = require('locks');
// mutex
const mutex = locks.createMutex();
const async = require('async');

const g_cwd = "connection/ethereum";
var g_data_feedback = false;

/// the file that used to keep exploit script
const g_exploit_path = "./exploit.txt";

/// json file
let g_target_artifact;
let g_attack_artifact;
// truffle-contract abstractions
let g_targetContract;
let g_attackContract;

// web3 abstractions
let web3;
let Provider;
let g_account_list = [];
/// the bookkeeping variable abi
let g_bookKeepingAbi;

let g_attackStmt_set;
let g_targetStmt_set;
// tracer abstractions at instruction level
let g_attackIns_map;
let g_targetIns_map;
// static dependency
let g_staticDep_attack;
let g_staticDep_target;

/// the gas amount
const gasMax = 8000000000;
/// dynamci array
const dyn_array_min = 1;
const dyn_array_max = 5;
/// the maximum length of seed_callSequence
const sequence_maxLen = 4;

/// the call sequence to be executed
let g_callSequen_list = [];
/// another new call seqeunce
let g_callSequen_start = false;

/// the current executed call, don't initialized because it is assigned again
/// we will mutate the inputs of this call function 
let g_lastCall_exec;
/// the current index in g_callSequen_cur, it corresponds to "g_lastCall_exec"
let g_callIndex_cur = 0;
/// the executed call sequence
let g_callSequen_cur = [];
/// the trace of a transaction
let g_trans_stmt_trace = [];
/// the trace of a call sequence
let g_sequen_stmt_trace = [];
/// the key is i^th call in sequence, the value is read/write variable
let g_stmt_read_map = new Map();
let g_stmt_write_map = new Map();
/// the set of dynamic dependencies in a call sequence
let g_sequen_depen_set = new Set();
/// the set of all dynamic dependencies in this contract until now
let g_contra_depen_set = new Set();

/// the hash of previous transactions
let g_pre_txHash_set = new Set();
let g_startTime, g_endTime;
let g_timeDiff;

/// the current call that is executed
let g_callFun_cur;
/// the candidate abi that can be used to start transaction
let g_cand_sequence = [];
let g_fuzzing_finish = false;

/// the account pools
let g_from_account;
/// the send and call statements
let g_send_call_set;
/// whether it has static control dependencies or write variable
let g_send_call_found;

let  g_fuzz_start_time = 0;
const FUZZ_TIME_SCALE = 10 * 60 * 1000;

function unlockAccount(){
  /// it is initialized by the blockchain, 
  /// for example, /home/hjwang/Tools/SCFuzzer/test_geth/data/keystore
  var g_from_account;
  web3.eth.getAccounts().then(e => {
    g_from_account = e[0];
    g_account_list.push(e[0]);
    console.log("Account[0]: " + g_from_account);
  }).then(() => {
    /// unlock initial user, which is also miner account
    web3.eth.personal.unlockAccount(g_from_account, "123456", 200 * 60 * 60)
      .then(() => {
        console.log('Account unlocked!');
      })
      .catch(() => {
        console.log('Account unlock failed!');
      });
  }).catch(() => {
    console.log('Cannot read account info!');
  });
}

import {BvmAcct} from './bvm-acct';
import {BvmAddr} from './bvm-addr';
import {ControllerLoader} from './dapp-mounter';
import type {Connection} from './netutility';

function setProvider(httpRpcAddr){
  Provider = new Web3.providers.HttpProvider(httpRpcAddr);
  web3 = new Web3(new Web3.providers.HttpProvider(httpRpcAddr));
  assert(web3);
}

function test_deployed(artifact_path){
  let artifact = require(path.relative(g_cwd, artifact_path));
  let network_id = Object.keys(artifact["networks"])[0];
  return network_id!=undefined;
}

////////////////////////////////////////////////////////////////////////////////////


/**
 * Factory class for transactions to interact with a controller loader
 */
export class NativeControllerLoader {
  /**
   * Bvm Address that identifies the NativeControllerLoader
   */
  static get controllerId(): BvmAddr {
    return new BvmAddr('NativeLoader1111111111111111111111111111111');
  }

  /**
   * Loads a native controller
   *
   * @param connection The connection to use
   * @param payer System account that pays to load the controller
   * @param controllerName Name of the native controller
   */
  static load(
    connection: Connection,
    payer: BvmAcct,
    controllerName: string,
  ): Promise<BvmAddr> {
    const bytes = [...Buffer.from(controllerName)];
    const controller = new BvmAcct();
    return ControllerLoader.load(
      connection,
      payer,
      controller,
      NativeControllerLoader.controllerId,
      bytes,
    );
  }
}


////////////////////////////////////////////////////////////////////////////////////
async function get_instance(artifact_path){
  // console.log(artifact_path);
  let artifact = require(path.relative(g_cwd, artifact_path));
  //let network_id = Object.keys(artifact["networks"])[0];
  // let conf = {
  //   contract_name:artifact["contractName"],
  //   abi:  artifact["abi"],                     // Array; required.  Application binary interface.
  //   unlinked_binary: artifact["bytecode"],       // String; optional. Binary without resolve library links.
  //   address: artifact["networks"][network_id]["address"],               // String; optional. Deployed address of contract.
  //   network_id: parseInt(network_id),            // String; optional. ID of network being saved within abstraction.
  //   default_network: parseInt(network_id)       // String; optional. ID of default network this abstraction should use.
  // };
  //console.log(artifact);
  let MyContract = truffle_contract(artifact);
  //console.log(MyContract);
  MyContract.setProvider(Provider);
  let instance = await MyContract.deployed();
  //console.log("instance: " + instance);
  return instance;
}

/// load some static information for the dynamic analysis. e.g., fuzzing
async function load(targetPath, attackPath, targetSolPath, attackSolPath){
  g_attackContract = await get_instance(attackPath);
  g_targetContract = await get_instance(targetPath);
  g_attack_artifact = require(path.relative(g_cwd, attackPath));
  g_target_artifact = require(path.relative(g_cwd, targetPath));
  
  /// add the attack contract address
  g_account_list.push(g_attackContract.address);
  /// find bookkeeping variable
  g_bookKeepingAbi = await findBookKeepingAbi(g_targetContract.abi);
  /// all the possible abi, then we use to synthesize the call sequence
  g_cand_sequence = [];
  await findCandSequence(g_targetContract.abi, g_attackContract.abi);

  /// the set of statements, which may be used for computing experimental results
  g_attackStmt_set = await buildStmtSet(g_attack_artifact.sourcePath,
                                               g_attack_artifact.deployedSourceMap,
                                               g_attack_artifact.source);
  g_targetStmt_set = await buildStmtSet(g_target_artifact.sourcePath,
                                               g_target_artifact.deployedSourceMap,
                                               g_target_artifact.source);     
  
  /// the map that the instruction corresponds to the statement 
  /// the form: [ '239JUMPI', 'Attack_SimpleDAO0.sol:1' ]
  /// where 239 is the offset, JUMPI is the instruction
  g_attackIns_map = await buildInsMap(g_attack_artifact.sourcePath,
                                             g_attack_artifact.deployedBytecode,
                                             g_attack_artifact.deployedSourceMap,
                                             g_attack_artifact.source);
  g_targetIns_map = await buildInsMap(g_target_artifact.sourcePath,
                                             g_target_artifact.deployedBytecode,
                                             g_target_artifact.deployedSourceMap,
                                             g_target_artifact.source);

  /// the static dependencies
  /// The form:
  // { Read: { 'SimpleDAO.sol:17': [ 'credit' ] },
  //  Write: { 'SimpleDAO.sol:8': [ 'owner' ] },
  //  CDepen: { 'SimpleDAO.sol:21': [ 'SimpleDAO.sol:22' ] } }
  // console.log("arriving here");
  g_staticDep_attack = await buildStaticDep(attackSolPath);
  g_staticDep_target = await buildStaticDep(targetSolPath);

  g_send_call_set = await buildMoneySet(targetSolPath);
  g_send_call_found = await buildRelevantDepen(g_staticDep_target, g_send_call_set);
  console.log(g_send_call_found);

  // /// clear the exploit script
  // if(fs.existsSync(g_exploit_path)){
  //   fs.unlinkSync(g_exploit_path);
  // }

  return {
   accounts: g_account_list,
   attack_adds: g_attackContract.address,
   target_adds: g_targetContract.address,
   attack_abi: g_attackContract.abi,
   target_abi: g_targetContract.abi
  };
}

function buildRelevantDepen(staticDep_target, send_call_set){
  var send_call_found = build_relevant_depen(staticDep_target, send_call_set);
  return send_call_found;
} 

const  build_relevant_depen = (staticDep_target, send_call_set) => {
  var send_call_found = new Set();

  // var write_target_map = staticDep_target["Write"];
  // var cd_target_map = staticDep_target["CDepen"];

  // for(var step of send_call_set){
  //   if(!write_target_map.hasOwnProperty(step) && !cd_target_map.hasOwnProperty(step)){
  //     send_call_found.add(step);
  //   }
  // }

  return send_call_found; 
}

function buildMoneySet(targetSolPath){
  var send_call_set = build_sendCall_set(targetSolPath);
  return send_call_set;
}

function buildStaticDep(fileName){
  var execSync = require('child_process').execSync;
  var cmdStr = "python3 ./connection/buildDepen.py " + fileName;
  var output = execSync(cmdStr);
  var staticDep = JSON.parse(output);
  return staticDep;
}


/// the seed for dynamic fuzzing
async function seed() {
  if (g_targetContract === undefined) {
    throw "Target contract is not deployed!";
  }
  if (g_attackContract === undefined) {
    throw "Attack contract is not deployed!";
  }
  // we only generate a call sequence
  let callFun_list;
  if(g_data_feedback){
    callFun_list = await seed_callSequence();
  }
  else{
    callFun_list = await seed_callSequence_withoutData();
  }
  // Execute the seed call sequence
  mutex.lock(async function() {
    try{
      /// the call sequence to be executed
      g_callSequen_list.push(callFun_list);
      g_callSequen_start = true;
      await exec_sequence_call();
    }
    catch (e) {
      console.log(e);
    }
    finally{
      mutex.unlock();
    }
  });

  let execResult_list = "successful!";
  return {
    callFuns: callFun_list,
    execResults: execResult_list
  };
}

/// it will be executed after each transaction is executed
async function fuzz(txHash, ins_trace) {
  const getTransaction = Promise.promisify(web3.eth.getTransaction);

  if (g_attackContract === undefined) {
    throw "Attack contract is not loaded!";
  }
  if (g_targetContract === undefined) {
    throw "Target contract is not loaded!";
  }

  mutex.lock(async function() {
    /// different transaction hash code, it is a string
    if(!g_pre_txHash_set.has(txHash)){
      /// store current txHash as previous txHash
      g_pre_txHash_set.add(txHash);
      try{
        /// this is used to get the input of transaction 
        // let transObj = await getTransaction(txHash);
        // console.log("receive: "+ transObj.input);
     
        /// when attack_target == 0, it is on attack contract
        /// when attack_target == 1, it is on target contract
        var attack_target = 0;
        /// ins_trace is the instrcution trace
        /// g_stmt_trace is list of line nunmber trace
        if(g_callFun_cur.to == g_targetContract.address){
          attack_target = 1;
        }
        g_trans_stmt_trace = await buildTraceMap(ins_trace,
                                                        g_attackIns_map,
                                                        g_targetIns_map,
                                                        attack_target);

        // for(var stmt_trace of g_trans_stmt_trace){
        //   if(g_send_call_found.has(stmt_trace)){
        //     console.log(Date.now() - g_fuzz_start_time);
        //     g_fuzzing_finish = true;
        //     return "Oracles are violated!";
        //   }
        // }
        /// the read/write variable in this transaction
        /// we use it to switch the order of sequence
        var WR_set = await buildWRSet(g_trans_stmt_trace,
                                             g_staticDep_attack,
                                             g_staticDep_target);
        g_stmt_write_map[g_callIndex_cur -1] = WR_set[0];
        g_stmt_read_map[g_callIndex_cur -1] = WR_set[1];

        /// concate the transaction tract into sequence trace
        g_sequen_stmt_trace = g_sequen_stmt_trace.concat(g_trans_stmt_trace);
        /// the dynamic dependencies in the g_stmt_trace
        g_sequen_depen_set = await buildDynDep(g_sequen_stmt_trace,
                                                      g_staticDep_attack,
                                                      g_staticDep_target);



        /// before executing next transaction, we first mutate the just executed transaction
        if(g_data_feedback){
          await determine_funMutation();
          await determine_sequenMutation();
        }
        else{
          await determine_funMutation_withoutData();
        }

        /// execute a function call
        await exec_sequence_call();
      }
      catch (e) {
        console.log(e);
      }
      finally{
        mutex.unlock();
      }
    }
  });     
}

function buildDynDep(trace, staticDep_attack, staticDep_target){
  var dynamicDep = buildDynamicDep(trace, staticDep_attack, staticDep_target);
  return dynamicDep;
}

const buildDynamicDep = (trace, staticDep_attack, staticDep_target) => {
  var dynamicDep = new Set();
  return dynamicDep;
}

const byteToTrace = (ins_list, byteToSrc_attack, byteToSrc_target, attack_target) => {
  var trace_list = [];
  return trace_list;
}

function buildWRSet(stmt_trace, staticDep_attack, staticDep_target){
  var WR_set = trace_WR(stmt_trace, staticDep_attack, staticDep_target);
  return WR_set;
}

const trace_WR = (stmt_trace, staticDep_attack, staticDep_target) => {
  var stmt_write_set = new Set();
  var stmt_read_set = new Set();
  return [stmt_write_set, stmt_read_set];
}


function buildTraceMap(ins_list, byteToSrc_attack, byteToSrc_target, attack_target) {
  var trace_list = byteToTrace(ins_list, byteToSrc_attack, byteToSrc_target, attack_target);
  return trace_list;
}

const json_parse = (fileName, srcmap, srccode) =>{
  /// the window system may use '\r\n' as newline, but getLineFromPos would take them as two lines
  // srccode = srccode.split('\r\n').join('\n');
  // srccode = srccode.split('\n\r').join('\n');
  // /// truncate the prefix of the path
  // fileName = fileName.slice(fileName.lastIndexOf('/') +1);
  // /// the first "" is set undefined (map ([s, l, f, j])), l,f,j does not exist.
  // const src_number = srcmap
  //       .split(";")
  //       .map(l => l.split(":"))
  //       .map(([s, l, f, j]) => ({ s: s === "" ? undefined : s, l, f, j }))
  //       .reduce(
  //         ([last, ...list], {s, l, f, j }) => [
  //           {
  //             s: parseInt(s || last.s, 10),
  //             l: parseInt(l || last.l, 10),
  //             f: parseInt(f || last.f, 10),
  //             j: j || last.j
  //           },
  //           last,
  //           ...list
  //         ],
  //         [{}]
  //       )
  //       .reverse()
  //       .slice(1)
  //       .map(
  //         ({ s, l, f, j }) => `${fileName}:${getLineFromPos(srccode, s)}`
  //       );
  // // writeSrcIndex_list(src_number);
  // return src_number;
}

const stmtCollection = (src_number) =>{
  var stmt_set = new Set();
	src_number.forEach(function(value, key, map){
		stmt_set.add(value);
	});
	return stmt_set;
}


const build_sendCall_set = (targetSolPath) => {
  var send_call_set = new Set();
  // var srccode = fs.readFileSync(targetSolPath, "utf-8"); 
  // srccode = srccode.split('\r\n').join('\n');
  // srccode = srccode.split('\n\r').join('\n');
  // var code_list = srccode.split('\n');
  // var lineNum = 1;
  // for (var line of code_list){
  //   if(line.indexOf("send(") != -1 || line.indexOf("send (") != -1 || line.indexOf("call.value") != -1){
  //     var content =  targetSolPath + ":" + lineNum;
  //     var lastIndex = content.lastIndexOf("/");
  //     content = content.slice(lastIndex +1);
  //     send_call_set.add(content);
  //   }
  //   lineNum++;
  // }
  return send_call_set;
}

/// each byte to the source code
const byteToInstIndex = (src_number, binary) => {
  const byteToSrc = new Map();
  /// "0x" is removed from binary
  // let byteIndex = 0;
  // let instIndex = 0;
  // /// for the binary code
  // const binmap = Buffer.from(binary.substring(2), "hex");
  // while (byteIndex < binmap.length) {
  //   const length = instructionLength(binmap[byteIndex]);
  //   if(opCodeToString[binmap[byteIndex]] != undefined && src_number[instIndex] != undefined){
  //     var key = byteIndex + opCodeToString[binmap[byteIndex]];
  //     var value = src_number[instIndex];
  //     byteToSrc[key] = value;
  //   }
  //   byteIndex += length;
  //   instIndex += 1;
  // }
  // writeByteIndex_list(byteToSrc);
  return byteToSrc;
}

function  buildInsMap(fileName, binary, srcmap, srccode) {
  var src_number = json_parse(fileName, srcmap, srccode);
  /// compute each instruction to its line number
  var byteToSrc = byteToInstIndex(src_number, binary);
  /// compute multiple instructions to their line number
  /// we do not use multiple instructions to the line number again, 
  /// because it is difficult to recognize the seperator instruction, specially not executed completely due to gas limit
  // var mulToSrc = mulbytesToSrcCode(byteToSrc);
  // return mulToSrc; 
  return byteToSrc
}


function buildStmtSet(fileName, srcmap, srccode) {
    var src_number = json_parse(fileName, srcmap, srccode);
    var stmt_set = stmtCollection(src_number);
    return stmt_set; 
  }




////////////////////////////////////////////////////////////////////////////////////