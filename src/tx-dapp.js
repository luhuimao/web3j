// @flow

/////////////////////////////////////////////////////////////////////////////////////////
async function mutate_callFun(call, callSequence, index) {
  var sequence_new_list = [];
  /// mutate the gas
  var gas_sequence_list = await mutate_gas(call, callSequence, index);
  for(var gas_sequence of gas_sequence_list){
    sequence_new_list.push(gas_sequence);
  }
  /// mutate the input based on the balance
  var bal_sequence_list = await mutate_balance(call, callSequence, index);
  for(var bal_sequence of bal_sequence_list){
    sequence_new_list.push(bal_sequence);
  }
  /// mutate the input based on the neighbor
  var uint_sequence_list = await mutate_uint(call, callSequence, index);
  for(var uint_sequence of uint_sequence_list){
    sequence_new_list.push(uint_sequence);
  }  
  return sequence_new_list;
}


async function mutate_callFun_uint_meaningful(call, callSequence, index) {
  var unum_diff = '0.0000001';
  /// unum_diff is not handled here, because it is relevant to multiple parameters
  /// generate a new call function
  var modify_result = await modify_callFun_uint_meaningful(call, unum_diff);
  if(modify_result[0]){
    /// callSequence itself is changed, not change at its copy 
    callSequence[index] = modify_result[1]; 
    return true;
  }
  else{
    return false;
  }
}

async function mutate_callFun_gas_meaningful(call, callSequence, index) {
  var gas_diff = '30.0';
  var modify_result = await modify_callFun_gas_meaningful(call, gas_diff);
  /// callSequence itself is changed, not change at its copy 
  if(modify_result[0]){
    callSequence[index] = modify_result[1]; 
    return true;
  }
  else{
    return false;
  }
}

async function mutate_callSequence(callSequence){
  var callSequence_new_set = new Set();
  var mutateSeque_index = 0;
  while(mutateSeque_index < mutateSeque_maxLen){
    /// copy the previous sequence, it would be modified
    var callSequence_new = callSequence.slice();
    var sequence_len = callSequence_new.length;
    var mutateOper_index = 0;
    while(mutateOper_index < mutateOper_maxLen){
      /// the location to mutate
      var sequence_index = randomNum(0, sequence_len);
      /// the type of mutation, e.g., add, delete, and modify
      var mutation_type = randomNum(0, 3);
      if(mutation_type == 0){
        /// add operation
        var operSeque_num = randomNum(0, operSeque_maxLen);
        var operSeque_index = 0;
        while(operSeque_index < operSeque_num){
          var abi_index = randomNum(0, cand_sequence.length);
          var abi = cand_sequence[abi_index];
          var callFun = await gen_callFun(abi);
          /// add the element
          callSequence_new.splice(sequence_index, 0, callFun);
          operSeque_index += 1;
        }
      }
      else if(mutation_type == 1){
        /// delete operation
        var operSeque_num = randomNum(0, operSeque_maxLen);
        /// delete operSeque_num element
        callSequence_new.splice(sequence_index, operSeque_num);     
      }
      else if(mutation_type == 2){
        /// modify operation
        var operSeque_num = randomNum(0, operSeque_maxLen);
        var operSeque_index = 0;
        while(operSeque_index < operSeque_num){
          var abi_index = randomNum(0, cand_sequence.length);
          var abi = cand_sequence[abi_index];
          var callFun = await gen_callFun(abi);
          /// replace the element
          callSequence_new.splice(sequence_index + operSeque_index, 1, callFun);
          operSeque_index += 1;
        }
      }
      mutateOper_index += 1;
    }
    callSequence_new_set.add(callSequence_new);
    mutateSeque_index += 1;
  }
  return callSequence_new_set;
}

async function insert_ownship(){
  await target_con._jsonInterface.forEach(function(abi) {
    /// abi.constant == true would not change state variables
    if (abi.name == 'transferOwnship'){
      let call = {
        from: account_list[0],
        to: target_con.options.address,
        abi: abi,
        gas: '1000000',
        param: [],
      }
      return call;
    }
  });
}

import invariant from 'assert';
import * as BufferLayout from 'buffer-layout';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

import * as Layout from './buffer-cntl';
import {BvmAddr} from './bvm-addr';
import {BvmAcct} from './bvm-acct';
import * as shortvec from './integer-array-encoding';
import type {Blockhash} from './tx-seal';

async function seed_callSequence() {
  var call_sequence = [];

  /// at least there are two calls
  var sequence_len = randomNum(2, sequence_maxLen);
  var sequence_index = 0;
  while (sequence_index < sequence_len){
    /// 0 <= call_index < cand_sequence.length
    var abi_index = randomNum(0, cand_sequence.length);
    var abi = cand_sequence[abi_index];
    var callFun = await gen_callFun(abi);
    call_sequence.push(callFun);
    sequence_index += 1;
  }
  return call_sequence;
}

///Redeploy contract
async function redeploy(){
  console.log("redeploy......");
  target_con = await target_con.deploy({data: target_artifact.bytecode, arguments: []})
    .send({
      from: account_list[0],
      gas: 1500000,
      value: web3.utils.toWei("5", "ether")
   });
  attack_con = await attack_con.deploy({data: attack_artifact.bytecode, arguments: [target_con.options.address]})
    .send({
      from: account_list[0],
      gas: 1500000,
      value: web3.utils.toWei("5", "ether")
    });
    console.log(target_con.options.address);
}
/////////////////////////////////////////////////////////////////////////////////////////


/**
 * @typedef {string} TxnSignature
 */
export type TxnSignature = string;

/**
 * Maximum over-the-wire size of a Transaction
 *
 * 1280 is IPv6 minimum MTU
 * 40 bytes is the size of the IPv6 header
 * 8 bytes is the size of the fragment header
 */
export const PACKET_DATA_SIZE = 1280 - 40 - 8;

/**
 * List of TxOperation object fields that may be initialized at construction
 *
 * @typedef {Object} TxInstructionControlFields
 * @property {?Array<BvmAddr>} keys
 * @property {?BvmAddr} controllerId
 * @property {?Buffer} data
 */
type TxInstructionControlFields = {|
  keys?: Array<{pubkey: BvmAddr, isSigner: boolean, isDebitable: boolean}>,
  controllerId?: BvmAddr,
  data?: Buffer,
|};

/**
 * Transaction Instruction class
 */
export class TxOperation {
  /**
   * Public keys to include in this transaction
   * Boolean represents whether this pubkey needs to sign the transaction
   */
  keys: Array<{
    pubkey: BvmAddr,
    isSigner: boolean,
    isDebitable: boolean,
  }> = [];

  /**
   * Controller Id to execute
   */
  controllerId: BvmAddr;

  /**
   * Controller input
   */
  data: Buffer = Buffer.alloc(0);

  constructor(opts?: TxInstructionControlFields) {
    opts && Object.assign(this, opts);
  }
}

/////////////////////////////////////////////////////////////////////////////////////////
/// for debugging
async function print_callSequence(calls_list){
  for(var calls of calls_list){
    console.log(calls);
  }
}

async function experiment_results(){
  endTime = new Date();
  timeDiff = Math.round((endTime - startTime) / 1000);
  console.log("elapsed time: " + timeDiff);
  var coverage_stmt = new Set();
  console.log(contr_depen_set);
  for(var contr_depen of contr_depen_set){
    var two_stmts = contr_depen.split('#');
    coverage_stmt.add(two_stmts[0]);
    coverage_stmt.add(two_stmts[1]);
  }
  var coverage_ratio = coverage_stmt.size / (attackStmt_set.size + targetStmt_set.size);
  console.log("coverage ratio: " + coverage_ratio);
}

async function internal_change(exec_results){
  if(exec_results[1] != exec_results[2]){
    return true;
  }
  else if(exec_results[3] != exec_results[4]){
    return true;
  }
  else if(exec_results[5] != exec_results[6]){
    return true;
  }
  else if(exec_results[7] != exec_results[8]){
    return true;
  }
  return false;
}


async function exec_sequence_call(){
  // console.log(sequence_call_list[0]);
  if(fuzzing_finish){
    /// for reentrancy
    // if (stmt_trace.length > 30)
      /// we finish the fuzzing
    return;
  }
  /// deal with the results of previous transaction
  /// mutate the function call, e.g., input, gas
  seque_depen_num_bf = seque_depen_set.size;
  /// add into the sequence dependencies
  for(var trans_depen of trans_depen_set){
    if (seque_depen_set.has(trans_depen) == false){
      seque_depen_set.add(trans_depen);
    }
  }
  seque_depen_num_af = seque_depen_set.size;
  console.log("seque before: " + seque_depen_num_bf + " seque after: " + seque_depen_num_af);
  console.log(seque_depen_set);
  if(seque_depen_num_af > seque_depen_num_bf){
    /// mutate the input and gas of the call
    /// sequence_executed, and sequeExe_index is still right
    var calls_new_list = await mutate_callFun(lastCall, sequence_executed, sequeExe_index -1);
    for(var calls_new of calls_new_list){
      sequence_call_list.push(calls_new);
    }    
    var callSequence_new_set = await mutate_callSequence(sequence_executed);
    for(var callSequence_new of callSequence_new_set){
      sequence_call_list.push(callSequence_new);
    }  
  }

  if(new_sequence_start){
    /// it a new call sequence, we consider the precious call sequence
    var contr_set_num_bf = contr_depen_set.size; 
    for(var seque_depen of seque_depen_set){
      if(contr_depen_set.has(seque_depen) == false){
        contr_depen_set.add(seque_depen);
      }
    }      
    var contr_set_num_af = contr_depen_set.size;
    if(contr_set_num_af > contr_set_num_bf){
      /// the call sequence generate new coverage, generate the new call sequence
      var callSequence_new_set = await mutate_callSequence(sequence_executed);
      for(var callSequence_new of callSequence_new_set){
        sequence_call_list.push(callSequence_new);
      }
    }

    /// start another statement trace, because another call sequence
    seque_stmt_trace = [];
    /// clear the coverage of call sequence, because we execute the new call sequence
    seque_depen_set.clear();
    sequeExe_meaningful = false;
    if(sequence_call_list.length != 0){
      /// the call sequence for the next execution
      sequence_executed = sequence_call_list[0].slice();
      sequeExe_index = 0;
      console.log("start another sequence.....");
    }
    else{
      fuzzing_finish = true;
      await experiment_results();
      console.log("fuzzing finish....");
      return;
    }
  }
  // console.log(sequence_call_list[0]);
  if(sequence_call_list.length !== 0){
    var sequence = sequence_call_list[0];
    var sequence_found = false;
    while(true){
      /// call sequence is empty, which may be generated by delete some calls
      if(sequence.length !== 0){
        sequence_found = true;
        break;
      }
      else{
        sequence_call_list.splice(0, 1);
        if(sequence_call_list.length != 0){
          /// start another statement trace, because another call sequence
          seque_stmt_trace = [];
          /// clear the coverage of call sequence, because we execute the new call sequence
          seque_depen_set.clear();
          sequeExe_meaningful = false;
          /// the call sequence for the next execution
          sequence_executed = sequence_call_list[0].slice();
          sequeExe_index = 0;
     
          sequence = sequence_call_list[0];
        }
        else{
          fuzzing_finish = true;
          experiment_results();
          console.log("fuzzing finish.....");
          return;
        }
      }
    }
    if(sequence_found){
      var call = sequence[0];
      lastCall = call;
      exec_results = await exec_callFun(call);
      if(exec_results === "found"){
        /// stop the running
        fuzzing_finish = true;
        experiment_results();
        console.log("fuzzing finish....");
      }
      else if(exec_results === "revert"){
        var mutate_gas_suc = await mutate_callFun_gas_meaningful(call, sequence_executed, sequeExe_index);
        if(mutate_gas_suc){
          sequeExe_meaningful = true;
        }    
        // if(exec_results[1] == exec_results[5] && exec_results[3] == exec_results[7]){
        //   /// here we use sequence_executed[sequeExe_index], because call is changed by its gas before
        //   var mutate_uint_suc = await mutate_callFun_uint_meaningful(sequence_executed[sequeExe_index], sequence_executed, sequeExe_index);
        //   if(mutate_uint_suc){
        //     sequeExe_meaningful = true;
        //   }  
        // } 
        exec_results = exec_results.slice(1);   
        /// sort is performed at the original array, not generate a new copy
        /// it is used in the mutate_callFun
        exec_results.sort(sortNumber);        
      }
      else {
        var status_change = await internal_change(exec_results);
        if(!status_change){
          /// here we use sequence_executed[sequeExe_index], because call is changed by its gas before
          var mutate_uint_suc = await mutate_callFun_uint_meaningful(call, sequence_executed, sequeExe_index);
          if(mutate_uint_suc){
            sequeExe_meaningful = true;
          }  
        } 
        exec_results = exec_results.slice(1);   
        /// sort is performed at the original array, not generate a new copy
        /// it is used in the mutate_callFun
        exec_results.sort(sortNumber);        
      }

      /// delete the call function
      sequence.splice(0, 1);
      /// sequeExe_index increase
      sequeExe_index += 1;
      new_sequence_start = false;
      if(sequence.length === 0){
        /// a call sequence is executed completely, delete the previous call sequence
        sequence_call_list.splice(0, 1);
        new_sequence_start = true;

        /// the sequence_executed becomes more meaningfule
        if(sequeExe_meaningful){
          /// we should use sequence_executed.slice
          /// because sequence_executed may be changer later
          /// we should add them into the front, because it is meaningful verson of last call sequence
          sequence_call_list.unshift(sequence_executed.slice());
        }
        else{
          /// the transferred money cannot be change, we generate another call sequence
          if(sequence_call_list.length <= 3){
            var callSequence_new_set = await mutate_callSequence(sequence_executed);
            for(var callSequence_new of callSequence_new_set){
              sequence_call_list.push(callSequence_new);
            }
          }
        }
        /// TODO maybe the parameters are wrong
        // if(reset_index >= reset_num){
        //   await redeploy();  
        //   reset_num = randomNum(0, 50);
        //   reset_index = 0;          
        // }
        // else{
        //   reset_index += 1;
        // }
      }
    }
  }
}
/////////////////////////////////////////////////////////////////////////////////////////


/**
 * @private
 */
type SignaturePubkeyPair = {|
  signature: Buffer | null,
  pubKey: BvmAddr,
|};

/**
 * List of Transaction object fields that may be initialized at construction
 *
 * @typedef {Object} TxnControlFields
 * @property (?recentPackagehash} A recent block hash
 * @property (?signatures} One or more signatures
 *
 */
type TxnControlFields = {|
  recentPackagehash?: Blockhash | null,
  signatures?: Array<SignaturePubkeyPair>,
|};

/**
 * Transaction class
 */
export class Transaction {
  /**
   * Signatures for the transaction.  Typically created by invoking the
   * `sign()` method
   */
  signatures: Array<SignaturePubkeyPair> = [];

  /**
   * The first (payer) Transaction signature
   */
  get signature(): Buffer | null {
    if (this.signatures.length > 0) {
      return this.signatures[0].signature;
    }
    return null;
  }

  /**
   * The operations to atomically execute
   */
  operations: Array<TxOperation> = [];

  /**
   * A recent transaction id.  Must be populated by the caller
   */
  recentPackagehash: Blockhash | null;

  /**
   * Construct an empty Transaction
   */
  constructor(opts?: TxnControlFields) {
    opts && Object.assign(this, opts);
  }

  /**
   * Add one or more operations to this Transaction
   */
  addOperations(
    ...items: Array<
      Transaction | TxOperation | TxInstructionControlFields,
    >
  ): Transaction {
    if (items.length === 0) {
      throw new Error('No operations');
    }

    items.forEach(item => {
      if (item instanceof Transaction) {
        this.operations = this.operations.concat(item.operations);
      } else if (item instanceof TxOperation) {
        this.operations.push(item);
      } else {
        this.operations.push(new TxOperation(item));
      }
    });
    return this;
  }

  /**
   * @private
   */
  _fetchSignData(): Buffer {
    const {recentPackagehash} = this;
    if (!recentPackagehash) {
      throw new Error('Transaction recentPackagehash required');
    }

    if (this.operations.length < 1) {
      throw new Error('No operations provided');
    }

    const keys = this.signatures.map(({pubKey}) => pubKey.converseToString());
    let numRequiredSignatures = 0;
    let numCreditOnlySignedAccounts = 0;
    let numCreditOnlyUnsignedAccounts = 0;

    const programIds = [];

    this.operations.forEach(instruction => {
      instruction.keys.forEach(keySignerPair => {
        const keyStr = keySignerPair.pubkey.converseToString();
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

      const controllerId = instruction.controllerId.converseToString();
      if (!programIds.includes(controllerId)) {
        programIds.push(controllerId);
      }
    });

    programIds.forEach(controllerId => {
      if (!keys.includes(controllerId)) {
        keys.push(controllerId);
        numCreditOnlyUnsignedAccounts += 1;
      }
    });

    if (numRequiredSignatures > this.signatures.length) {
      throw new Error(
        `Insufficent signatures: expected ${numRequiredSignatures} but got ${
          this.signatures.length
        }`,
      );
    }

    let keyCount = [];
    shortvec.encodeArrayWithInteger(keyCount, keys.length);

    const operations = this.operations.map(instruction => {
      const {data, controllerId} = instruction;
      let keyIndicesCount = [];
      shortvec.encodeArrayWithInteger(keyIndicesCount, instruction.keys.length);
      let dataCount = [];
      shortvec.encodeArrayWithInteger(dataCount, instruction.data.length);
      return {
        programIdIndex: keys.indexOf(controllerId.converseToString()),
        keyIndicesCount: Buffer.from(keyIndicesCount),
        keyIndices: Buffer.from(
          instruction.keys.map(keyObj =>
            keys.indexOf(keyObj.pubkey.converseToString()),
          ),
        ),
        dataLength: Buffer.from(dataCount),
        data,
      };
    });

    operations.forEach(instruction => {
      invariant(instruction.programIdIndex >= 0);
      instruction.keyIndices.forEach(keyIndex => invariant(keyIndex >= 0));
    });

    let instructionCount = [];
    shortvec.encodeArrayWithInteger(instructionCount, operations.length);
    let instructionBuffer = Buffer.alloc(PACKET_DATA_SIZE);
    Buffer.from(instructionCount).copy(instructionBuffer);
    let instructionBufferLength = instructionCount.length;

    operations.forEach(instruction => {
      const instructionLayout = BufferLayout.struct([
        BufferLayout.u8('programIdIndex'),

        BufferLayout.blob(
          instruction.keyIndicesCount.length,
          'keyIndicesCount',
        ),
        BufferLayout.seq(
          BufferLayout.u8('keyIndex'),
          instruction.keyIndices.length,
          'keyIndices',
        ),
        BufferLayout.blob(instruction.dataLength.length, 'dataLength'),
        BufferLayout.seq(
          BufferLayout.u8('userdatum'),
          instruction.data.length,
          'data',
        ),
      ]);
      const length = instructionLayout.encode(
        instruction,
        instructionBuffer,
        instructionBufferLength,
      );
      instructionBufferLength += length;
    });
    instructionBuffer = instructionBuffer.slice(0, instructionBufferLength);

    const signDataLayout = BufferLayout.struct([
      BufferLayout.blob(1, 'numRequiredSignatures'),
      BufferLayout.blob(1, 'numCreditOnlySignedAccounts'),
      BufferLayout.blob(1, 'numCreditOnlyUnsignedAccounts'),
      BufferLayout.blob(keyCount.length, 'keyCount'),
      BufferLayout.seq(Layout.pubKey('key'), keys.length, 'keys'),
      Layout.pubKey('recentPackagehash'),
    ]);

    const transaction = {
      numRequiredSignatures: Buffer.from([this.signatures.length]),
      numCreditOnlySignedAccounts: Buffer.from([numCreditOnlySignedAccounts]),
      numCreditOnlyUnsignedAccounts: Buffer.from([
        numCreditOnlyUnsignedAccounts,
      ]),
      keyCount: Buffer.from(keyCount),
      keys: keys.map(key => new BvmAddr(key).converseToBuffer()),
      recentPackagehash: Buffer.from(bs58.decode(recentPackagehash)),
    };

    let signData = Buffer.alloc(2048);
    const length = signDataLayout.encode(transaction, signData);
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
  signTx(...signers: Array<BvmAcct>) {
    this.signTxInPartial(...signers);
  }

  /**
   * Partially sign a Transaction with the specified accounts.  The `BvmAcct`
   * inputs will be used to sign the Transaction immediately, while any
   * `BvmAddr` inputs will be referenced in the signed Transaction but need to
   * be filled in later by calling `addSigner()` with the matching `BvmAcct`.
   *
   * All the caveats from the `sign` method apply to `signPartial`
   */
  signTxInPartial(...partialSigners: Array<BvmAddr | BvmAcct>) {
    if (partialSigners.length === 0) {
      throw new Error('No signers');
    }
    const signatures: Array<SignaturePubkeyPair> = partialSigners.map(
      accountOrPublicKey => {
        const pubKey =
          accountOrPublicKey instanceof BvmAcct
            ? accountOrPublicKey.pubKey
            : accountOrPublicKey;
        return {
          signature: null,
          pubKey,
        };
      },
    );
    this.signatures = signatures;
    const signData = this._fetchSignData();

    partialSigners.forEach((accountOrPublicKey, index) => {
      if (accountOrPublicKey instanceof BvmAddr) {
        return;
      }
      const signature = nacl.sign.detached(
        signData,
        accountOrPublicKey.privateKey,
      );
      invariant(signature.length === 64);
      signatures[index].signature = Buffer.from(signature);
    });
  }

  /**
   * Fill in a signature for a partially signed Transaction.  The `signer` must
   * be the corresponding `BvmAcct` for a `BvmAddr` that was previously provided to
   * `signPartial`
   */
  addSignerINtoSignature(signer: BvmAcct) {
    const index = this.signatures.findIndex(sigpair =>
      signer.pubKey.checkIfEquals(sigpair.pubKey),
    );
    if (index < 0) {
      throw new Error(`Unknown signer: ${signer.pubKey.converseToString()}`);
    }

    const signData = this._fetchSignData();
    const signature = nacl.sign.detached(signData, signer.privateKey);
    invariant(signature.length === 64);
    this.signatures[index].signature = Buffer.from(signature);
  }

  /**
   * Serialize the Transaction in the wire format.
   *
   * The Transaction must have a valid `signature` before invoking this method
   */
  serialize(): Buffer {
    const {signatures} = this;
    if (!signatures) {
      throw new Error('Transaction has not been signed');
    }

    const signData = this._fetchSignData();
    const signatureCount = [];
    shortvec.encodeArrayWithInteger(signatureCount, signatures.length);
    const transactionLength =
      signatureCount.length + signatures.length * 64 + signData.length;
    const wireTransaction = Buffer.alloc(transactionLength);
    invariant(signatures.length < 256);
    Buffer.from(signatureCount).copy(wireTransaction, 0);
    signatures.forEach(({signature}, index) => {
      invariant(signature !== null, `null signature`);
      invariant(signature.length === 64, `signature has invalid length`);
      Buffer.from(signature).copy(
        wireTransaction,
        signatureCount.length + index * 64,
      );
    });
    signData.copy(
      wireTransaction,
      signatureCount.length + signatures.length * 64,
    );
    invariant(
      wireTransaction.length <= PACKET_DATA_SIZE,
      `Transaction too large: ${wireTransaction.length} > ${PACKET_DATA_SIZE}`,
    );
    return wireTransaction;
  }

  /**
   * Deprecated method
   * @private
   */
  get keys(): Array<BvmAddr> {
    invariant(this.operations.length === 1);
    return this.operations[0].keys.map(keyObj => keyObj.pubkey);
  }

  /**
   * Deprecated method
   * @private
   */
  get controllerId(): BvmAddr {
    invariant(this.operations.length === 1);
    return this.operations[0].controllerId;
  }

  /**
   * Deprecated method
   * @private
   */
  get data(): Buffer {
    invariant(this.operations.length === 1);
    return this.operations[0].data;
  }

  /**
   * Parse a wire transaction into a Transaction object.
   */
  static from(buffer: Buffer): Transaction {
    const PUBKEY_LENGTH = 32;
    const SIGNATURE_LENGTH = 64;

    function isCreditDebit(
      i: number,
      numRequiredSignatures: number,
      numCreditOnlySignedAccounts: number,
      numCreditOnlyUnsignedAccounts: number,
      numKeys: number,
    ): boolean {
      return (
        i < numRequiredSignatures - numCreditOnlySignedAccounts ||
        (i >= numRequiredSignatures &&
          i < numKeys - numCreditOnlyUnsignedAccounts)
      );
    }

    let transaction = new Transaction();

    // Slice up wire data
    let byteArray = [...buffer];

    const signatureCount = shortvec.getDecodedArrayLength(byteArray);
    let signatures = [];
    for (let i = 0; i < signatureCount; i++) {
      const signature = byteArray.slice(0, SIGNATURE_LENGTH);
      byteArray = byteArray.slice(SIGNATURE_LENGTH);
      signatures.push(signature);
    }

    const numRequiredSignatures = byteArray.shift();
    // byteArray = byteArray.slice(1); // Skip numRequiredSignatures byte
    const numCreditOnlySignedAccounts = byteArray.shift();
    // byteArray = byteArray.slice(1); // Skip numCreditOnlySignedAccounts byte
    const numCreditOnlyUnsignedAccounts = byteArray.shift();
    // byteArray = byteArray.slice(1); // Skip numCreditOnlyUnsignedAccounts byte

    const accountCount = shortvec.getDecodedArrayLength(byteArray);
    let accounts = [];
    for (let i = 0; i < accountCount; i++) {
      const account = byteArray.slice(0, PUBKEY_LENGTH);
      byteArray = byteArray.slice(PUBKEY_LENGTH);
      accounts.push(account);
    }

    const recentPackagehash = byteArray.slice(0, PUBKEY_LENGTH);
    byteArray = byteArray.slice(PUBKEY_LENGTH);

    const instructionCount = shortvec.getDecodedArrayLength(byteArray);
    let operations = [];
    for (let i = 0; i < instructionCount; i++) {
      let instruction = {};
      instruction.programIndex = byteArray.shift();
      const accountIndexCount = shortvec.getDecodedArrayLength(byteArray);
      instruction.accountIndex = byteArray.slice(0, accountIndexCount);
      byteArray = byteArray.slice(accountIndexCount);
      const dataLength = shortvec.getDecodedArrayLength(byteArray);
      instruction.data = byteArray.slice(0, dataLength);
      byteArray = byteArray.slice(dataLength);
      operations.push(instruction);
    }

    // Populate Transaction object
    transaction.recentPackagehash = new BvmAddr(recentPackagehash).converseToBase58();
    for (let i = 0; i < signatureCount; i++) {
      const sigPubkeyPair = {
        signature: Buffer.from(signatures[i]),
        pubKey: new BvmAddr(accounts[i]),
      };
      transaction.signatures.push(sigPubkeyPair);
    }
    for (let i = 0; i < instructionCount; i++) {
      let instructionData = {
        keys: [],
        controllerId: new BvmAddr(accounts[operations[i].programIndex]),
        data: Buffer.from(operations[i].data),
      };
      for (let j = 0; j < operations[i].accountIndex.length; j++) {
        const pubkey = new BvmAddr(accounts[operations[i].accountIndex[j]]);

        instructionData.keys.push({
          pubkey,
          isSigner: transaction.signatures.some(
            keyObj => keyObj.pubKey.converseToString() === pubkey.converseToString(),
          ),
          isDebitable: isCreditDebit(
            j,
            numRequiredSignatures,
            numCreditOnlySignedAccounts,
            numCreditOnlyUnsignedAccounts,
            accounts.length,
          ),
        });
      }
      let instruction = new TxOperation(instructionData);
      transaction.operations.push(instruction);
    }
    return transaction;
  }
}



//////////////////////////////////////////////////////////////////////////////////////////
async function generateFunctionInputs_donate(abi) {

  let parameters = [];  
  await abi.inputs.forEach(function(param) {
    if (param.type == 'address') {
      // parameters.push(attack_con.options.address);
      parameters.push(account_list[0]);
    } else if (param.type == 'uint256') {
      // parameters.push(web3.utils.toWei('1', 'ether'));
      parameters.push("2000000000");
    } else {
      // default parameter
      parameters.push(0);
    }
  });

  let call = {
    from: account_list[0],
    to: abi.name.indexOf('vultron_') !== -1 ? attack_con.options.address : target_con.options.address,
    abi: abi,
    gas: '1000000',
    param: parameters,
  }
  return call;
}

async function generateFunctionInputs_withdraw(abi) {
  if (abi.constant) return;
  if (abi.type != 'function') return;

  let parameters = [];  
  await abi.inputs.forEach(function(param) {
    if (param.type == 'address') {
      parameters.push(attack_con.options.address);
    } else if (param.type == 'uint256') {
      // parameters.push(web3.utils.toWei('1', 'ether'));
      parameters.push("1000000000");
    } else {
      // default parameter
      parameters.push(0);
    }
  });

  let call = {
    from: account_list[0],
    to: abi.name.indexOf('vultron_') !== -1 ? attack_con.options.address : target_con.options.address,
    abi: abi,
    gas: '1000000',
    param: parameters,
  }
  return call;
}

async function simple_callSequence() {
  let callFun_list = [];
  await cand_sequence.forEach(function(abi) {
    if (abi.name == 'setTaxes') {
      generateFunctionInputs_donate(abi).then(function(call) {
      callFun_list.push(call);
      })
    }
  });
  await cand_sequence.forEach(function(abi) {
    if (abi.constant || abi.type != 'function')
      return;

    if (abi.name == 'transfer') {
      generateFunctionInputs_withdraw(abi).then(function(call) {
      callFun_list.push(call);
      })
    }
  });
  return callFun_list;
}
///////////////////////////////////////////////////////////////////////////////////////////