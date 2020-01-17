// @flow

const request = require("request");


const AbiCoder = require('web3-eth-abi');
// const abiCoder = new AbiCoder.AbiCoder();

const Web3 = require('web3');
const Promise = require("bluebird");
const truffle_Contract = require('truffle-contract');
const assert = require('assert');
// const tracer = require('./EVM2Code');
const fs = require('fs');
const locks = require('locks');
// mutex
const mutex = locks.createMutex();
const async = require('async');
let httpRpcAddr = "http://localhost:8546"
let Provider = new Web3.providers.HttpProvider(httpRpcAddr);
let web3  =  new Web3(new Web3.providers.HttpProvider(httpRpcAddr));
let g_account_list = web3.eth.accounts;
let g_from_account = g_account_list[0];
  /// unlock initial user, which is also miner account
// web3.personal.unlockAccount(g_from_account, "123", 200 * 60 * 60);

import BN from 'bn.js';
import bs58 from 'bs58';

async function get_instance(artifact_path){
  let artifact = require(artifact_path);
  let network_id = Object.keys(artifact["networks"])[0];
  let conf = {
    contract_name:artifact["contractName"],
    abi:  artifact["abi"],                     // Array; required.  Application binary interface.
    unlinked_binary: artifact["bytecode"],       // String; optional. Binary without resolve library links.
    address: artifact["networks"][network_id]["address"],               // String; optional. Deployed address of contract.
    network_id: parseInt(network_id),            // String; optional. ID of network being saved within abstraction.
    default_network: parseInt(network_id)       // String; optional. ID of default network this abstraction should use.
  };
  // console.log(conf);
  let MyContract = truffle_Contract(conf);
  MyContract.setProvider(Provider);
  let instance = await MyContract.deployed();
  return instance;
}
async function send(){
  let private_bank = await get_instance("../build/contracts/Private_Bank.json");
  await web3.eth.sendTransaction({from:g_from_account,to:private_bank.address,value:10000000000000000000,gas:500000000000});
}
async function test(){
  let private_bank = await get_instance("../build/contracts/Private_Bank.json");
  let attack_private_bank = await get_instance("../build/contracts/Attack_Private_Bank0.json");
  let bal_private = await web3.eth.getBalance(private_bank.address);
  let bal_attack_private = await web3.eth.getBalance(attack_private_bank.address);
  console.log("Before");
  console.log("ether of contract:",bal_private.toString(),bal_attack_private.toString());
  let book_val = await private_bank.balances(attack_private_bank.address,{from:g_from_account,gas:500000000000});
  console.log("book of contract:",book_val.toString())
  await attack_private_bank.vultron_Deposit(10000000000000000000,{from:g_from_account,gas:500000000000});
 
  book_val = await private_bank.balances(attack_private_bank.address,{from:g_from_account,gas:500000000000});
  console.log("Middle");
  console.log("book of contract:",book_val.toString())
  bal_private = await web3.eth.getBalance(private_bank.address);
  bal_attack_private = await web3.eth.getBalance(attack_private_bank.address);
  console.log("ether of contract:",bal_private.toString(),bal_attack_private.toString());


  await attack_private_bank.vultron_CashOut(10000000000000000000,{from:g_from_account,gas:50000000000000});

  console.log("After");
  book_val = await private_bank.balances(attack_private_bank.address,{from:g_from_account,gas:500000000000});
  console.log(book_val.toString())
  bal_private = await web3.eth.getBalance(private_bank.address);
  bal_attack_private = await web3.eth.getBalance(attack_private_bank.address);
  console.log("ether of contract:",bal_private.toString(),bal_attack_private.toString());
  book_val = await private_bank.balances(attack_private_bank.address,{from:g_from_account,gas:500000000000});
  console.log("book of contract:",book_val.toString())
    
}


function setCharAt(str,index,chr) {
  if(index > str.length-1) return str;
  return str.substr(0,index) + chr + str.substr(index+1);
}

function transform(id) {
  var newStr = id;
  if (typeof id === 'string') {
      for (var i = 0; i < newStr.length; i++) {
          // console.log(newStr.charAt(i));
          
          if (newStr.charAt(i) === '0') {
              newStr = setCharAt(newStr, i, 'X2');
          }
          else if (newStr.charAt(i) === 'O') {
              newStr = setCharAt(newStr, i, 'X1');
          }
          else if (newStr.charAt(i) === 'I') {
              newStr = setCharAt(newStr, i, 'X3');
          }
          else if (newStr.charAt(i) === 'l') {
              newStr = setCharAt(newStr, i, 'X4');
          }
      }
  } else {
      throw new Error(`can't transform a not string type value`);
  }
  return newStr;
}

function reverse(id) {
  var originalStr = id;
  if (typeof id === 'string') {
      for (var i = 0; i < originalStr.length; i++) {
          if (originalStr.includes("X2")) {
              originalStr = originalStr.replace(/X2/g, "0");
          }
          else if (originalStr.includes("X1")) {
              originalStr = originalStr.replace(/X1/g, "O");
          }
          else if (originalStr.includes("X3")) {
              originalStr = originalStr.replace(/X3/g, "I");
          }
          else if (originalStr.includes("X4")) {
              originalStr = originalStr.replace(/X4/g, "l");
          }
      }
  } else {
      throw new Error(`can't transform a not string type value`);
  }
  return originalStr;
}

/**
 * A bvm address
 */
export class BvmAddr {
  _bn: BN;

  /**
   * Create a new BvmAddr object
   */
  constructor(value: number | string | Buffer | Array<number>) {
    if (typeof value === 'string') {
      // hexadecimal number
      if (value.startsWith('0x')) {
        this._bn = new BN(value.substring(2), 16);
      } else {
        // assume base 58 encoding by default
        var newstr = transform(value);
        this._bn = new BN(bs58.decode(newstr));
      }
    } else {
      this._bn = new BN(value);
    }

    if (this._bn.byteLength() > 32) {
      throw new Error(`Invalid bvm address input`);
    }
  }

  /**
   * Checks if the provided object is a BvmAddr
   */
  static isBvmAddr(o: Object): boolean {
    return o instanceof BvmAddr;
  }

  /**
   * Checks if two bvm addresses are equal
   */
  checkIfEquals(bvmaddr: BvmAddr): boolean {
    return this._bn.eq(bvmaddr._bn);
  }

  /**
   * Return the base-58 representation of the bvm address
   */
  converseToBase58(): string {
    return bs58.encode(this.converseToBuffer());
  }

  /**
   * Return the Buffer representation of the bvm address
   */
  converseToBuffer(): Buffer {
    const bign = this._bn.toArrayLike(Buffer);
    if (bign.length === 32) {
      return bign;
    }

    const zeroPad = Buffer.alloc(32);
    bign.copy(zeroPad, 32 - bign.length);
    return zeroPad;
  }

  /**
   * Returns a string representation of the bvm address
   */
  converseToString(): string {
    return reverse(this.converseToBase58());
    // return this.converseToBase58();
  }
}


// web3 abstractions
// var web3;
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
