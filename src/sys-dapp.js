// @flow

var web3;
/// get the balacne of given address in the bookkeeping variable
async function getBookBalance(acc_address) {
  var balance = 0;
  var encode = web3.eth.abi.encodeFunctionCall(bookKeepingAbi, [acc_address]);

  await web3.eth.call({
                      to: target_con.options.address,
                      data: encode}, function(err, result) {
                        if (!err) {
                          if (web3.utils.isHex(result)){
                            balance += web3.utils.toBN(result);
                          }
                        }
                      });
  return balance;
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

import * as BufferLayout from 'buffer-layout';

import {Transaction} from './tx-dapp';
import {BvmAddr} from './bvm-addr';
import * as Layout from './buffer-cntl';

/// generate an account address
function gen_address(adds_type){
  /// returns -1, if the value to search for never occurs
  if(adds_type.indexOf('[') == -1){
    /// primitive type
    var account_index = randomNum(0, account_list.length);
    var account = account_list[account_index];
    return account;
  }
  else if(adds_type.indexOf('[]') != -1){
    /// dynamic array
    var adds_list = [];
    var adds_num = randomNum(dyn_array_min, dyn_array_max);
    var adds_index = 0;
    while(adds_index < adds_num){
      var account_index = randomNum(0, account_list.length);
      var account = account_list[account_index];
      adds_list.push(account);
      adds_index += 1;
    }
    return adds_list;
  }
  else{
    /// static array
    var adds_list = [];
    var left_index = adds_type.indexOf('[');
    var right_index = adds_type.indexOf(']');
    var adds_num = parseInt(adds_type.slice(left_index +1, right_index), 10);
    var adds_index = 0;
    while(adds_index < adds_num){
      var account_index = randomNum(0, account_list.length);
      var account = account_list[account_index];
      adds_list.push(account);
      adds_index += 1;
    }
    return adds_list;
  }
}

/**
 * Factory class for transactions to interact with the System controller
 */
export class SystemController {
  /**
   * Public key that identifies the System controller
   */
  static get controllerId(): BvmAddr {
    return new BvmAddr(
      '0x000000000000000000000000000000000000000000000000000000000000000',
    );
  }

  /**
   * Generate a Transaction that creates a new account
   */
  static createNewAccount(
    from: BvmAddr,
    createNewAccount: BvmAddr,
    difs: number,
    reputations: number,
    space: number,
    controllerId: BvmAddr,
  ): Transaction {
    const dataLayout = BufferLayout.struct([
      BufferLayout.u32('instruction'),
      BufferLayout.ns64('difs'),
      BufferLayout.ns64('reputations'),
      BufferLayout.ns64('space'),
      Layout.pubKey('controllerId'),
    ]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        instruction: 0, // Create BvmAcct instruction
        difs,
        reputations,
        space,
        controllerId: controllerId.converseToBuffer(),
      },
      data,
    );

    return new Transaction().add({
      keys: [
        {pubkey: from, isSigner: true, isDebitable: true},
        {pubkey: createNewAccount, isSigner: false, isDebitable: true},
      ],
      controllerId: SystemController.controllerId,
      data,
    });
  }

  /**
   * Generate a Transaction that transfers difs from one account to another
   */
  static transfer(from: BvmAddr, to: BvmAddr, amount: number): Transaction {
    const dataLayout = BufferLayout.struct([
      BufferLayout.u32('instruction'),
      BufferLayout.ns64('amount'),
    ]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        instruction: 2, // Move instruction
        amount,
      },
      data,
    );

    return new Transaction().add({
      keys: [
        {pubkey: from, isSigner: true, isDebitable: true},
        {pubkey: to, isSigner: false, isDebitable: false},
      ],
      controllerId: SystemController.controllerId,
      data,
    });
  }

  /**
   * Generate a Transaction that transfers reputations from one account to another
   */
  static transferReputation(from: BvmAddr, to: BvmAddr, amount: number): Transaction {
    const dataLayout = BufferLayout.struct([
      BufferLayout.u32('instruction'),
      BufferLayout.ns64('amount'),
    ]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        instruction: 4, // transfer reputations instruction
        amount,
      },
      data,
    );

    return new Transaction().add({
      keys: [
        {pubkey: from, isSigner: true, isDebitable: true},
        {pubkey: to, isSigner: false, isDebitable: false},
      ],
      controllerId: SystemController.controllerId,
      data,
    });
  }

  /**
   * Generate a Transaction that assigns an account to a controller
   */
  static assign(from: BvmAddr, controllerId: BvmAddr): Transaction {
    const dataLayout = BufferLayout.struct([
      BufferLayout.u32('instruction'),
      Layout.pubKey('controllerId'),
    ]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        instruction: 1, // Assign instruction
        controllerId: controllerId.converseToBuffer(),
      },
      data,
    );

    return new Transaction().add({
      keys: [{pubkey: from, isSigner: true, isDebitable: true}],
      controllerId: SystemController.controllerId,
      data,
    });
  }
}


/// get the balance of attack in the bookkeeping variable
async function getAccountBalance() {
  var balance = await getBookBalance(attack_con.options.address);
  return balance;
}

/// get the sum of bookkeeping variable
async function getBookSum() {
  var sum = BigInt(0);
  for (var account of account_list) { 
    var account_bal = await getBookBalance(account);
    console.log('account_bal: ' + account_bal);
    /// only the BigInt can be added safely
    sum += BigInt(account_bal);
  }
  return "" + sum;
}

/// execute the call and generate the transaction
async function exec_callFun(call){
  var target_bal_bf = await web3.eth.getBalance(target_con.options.address);
  var target_bal_sum_bf = await getBookSum();
  var attack_bal_bf = await web3.eth.getBalance(attack_con.options.address);
  var attack_bal_acc_bf = await getAccountBalance();

  console.log(call);
  var tx_hash;
  try{
    await web3.eth.sendTransaction({ from: call.from,
                                     to: call.to, 
                                     gas: call.gas,                               
                                     data: web3.eth.abi.encodeFunctionCall(call.abi, call.param)
                                   },
                                   function(error, hash) {
                                     if (!error) {
                                      tx_hash = hash;
                                     }
                                     else{
                                       console.log(error);
                                      }
                                  });
  }catch(e){
    console.log(e);
  }
  var revert_found = false;
  await web3.eth.getTransactionReceipt(tx_hash).then((receipt) => {
    console.log("receipt status: " + receipt.status + " ######receipt gasused: " + receipt.gasUsed);
    if(receipt.status === false){
      if((parseInt(call.gas, 10) - receipt.gasUsed) < 500){
        console.log(tx_hash + '  out-of-gas transaction failed');
        revert_found = true;
      }
    }
    }).catch((e)=> {
      console.log(e);
  });

  var target_bal_af = await web3.eth.getBalance(target_con.options.address);
  var target_bal_sum_af = await getBookSum();
  var attack_bal_af = await web3.eth.getBalance(attack_con.options.address);
  var attack_bal_acc_af = await getAccountBalance();

  console.log(attack_bal_bf);
  console.log(attack_bal_af);
  console.log(target_bal_bf);
  console.log(target_bal_af);
  console.log(attack_bal_acc_bf);
  console.log(attack_bal_acc_af);
  console.log(target_bal_sum_bf);
  console.log(target_bal_sum_af);
  
  /// TODO still not consider the price of asset in bookkeeping variable  
  try{ 
    // if((BigInt(target_bal_bf) - BigInt(target_bal_sum_bf)) != (BigInt(target_bal_af) - BigInt(target_bal_sum_af))){
    //   throw "Balance invariant is not held....";
    // }
    if((BigInt(target_bal_bf) - BigInt(target_bal_sum_bf)) < (BigInt(target_bal_af) - BigInt(target_bal_sum_af))){
      throw "Balance invariant is not held....";
    }
    // if((BigInt(attack_bal_af) - BigInt(attack_bal_bf)) != (BigInt(attack_bal_acc_bf) - BigInt(attack_bal_acc_af))){
    //   throw "Transaction invariant is not held....";
    // }
  }
  catch(e){
    return "found";
  }

  if(revert_found){
    return "revert";
  }
  else{
    return [
      attack_bal_bf,
      attack_bal_af,
      target_bal_bf,
      target_bal_af,  
      attack_bal_acc_bf,
      attack_bal_acc_af,
      target_bal_sum_bf,
      target_bal_sum_af
    ];
  }
}


/// min <= r < max
function randomNum(min, max){
  if(min >= max){
    return Math.floor(min);
  }
  else{
    var range = max - min;
    var rand = Math.random();
    var num = min + Math.floor(rand * range);
    return num; 
  }
}

function sortNumber(a,b)
{
  return a - b;
}