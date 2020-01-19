/**
 * @flow
 */



////////////////////////////////////////////////////////////////////////////////////////////

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

/// modify the 'input_orig_list' at 'input_index' with 'unum_diff' 
function modify_uint(input_orig_list, input_index, unum_diff){
  var input_orig = input_orig_list[input_index];
  if (typeof input_orig === 'string' || input_orig instanceof String){
    /// it is primitive, e.g., uint
    var input_orig_int = parseInt(input_orig, 10);
    if(typeof unum_diff === "number" || unum_diff instanceof Number){
      /// modify with the instant value
      var input_modify = input_orig_int + unum_diff;
      if(input_modify !== input_orig_int){
        if(input_modify >= 1){
          var modify_str = uintToString(input_modify)
          return modify_str;
        }
        else{
          return undefined;
        }        
      }
      else{
        return undefined;
      }
    }
    else if(typeof unum_diff === 'string' || unum_diff instanceof String){
      /// modify with 'xxx' times
      var unum_diff_int = parseFloat(unum_diff, 10);
      var input_modify = input_orig_int * unum_diff;
      if(input_modify !== input_orig_int){
        var modify_int =  Math.round(input_modify)
        if(modify_int >= 1){
          var modify_str = uintToString(Math.round(input_modify));
          return modify_str;   
        }
        else{
          return undefined;
        }
      }
      else{
        return undefined;
      }
    }
  }
  else if (input_orig instanceof Array){
    /// generate a copy to mutate, otherwise the original input will be modified
    input_orig = input_orig.slice()
    /// select an element to mutate
    var index = randomNum(0, input_orig.length);
    var input_orig_int = parseInt(input_orig[index], 10);
    if(typeof unum_diff === "number" || unum_diff instanceof Number){
      var input_modify = input_orig_int + unum_diff;
      if(input_modify !== input_orig_int){
        if(input_modify >= 1){
          var modify_str = uintToString(input_modify);
          input_orig[index] = modify_str;
        }
        else{
          return undefined;
        }   
        return input_orig;     
      }
      else{
        return undefined;
      }
    }
    else if(typeof unum_diff === 'string' || unum_diff instanceof String){
      var unum_diff_int = parseFloat(unum_diff, 10);
      var input_modify = input_orig_int * unum_diff;
      if(input_modify !== input_orig_int){
        var modify_int =  Math.round(input_modify)
        if(modify_int >= 1){
          var modify_str = uintToString(Math.round(input_modify));
          input_orig[index] = modify_str;   
        }
        else{
          input_orig[index] = '1';
        }
        return input_orig;         
      }
      else{
        return undefined;
      }
    }
  }
  else{
    /// no change, it needs to proceed further
    return undefined;
  }
}

async function modify_callInput_uint(call, unum_diff) {
  var param_list_set = new Set();
  var input_type_list = call.abi.inputs;
  var input_orig_list = call.param;
  var param_i = 0;
  var param_len = input_type_list.length;
  /// for each element in input_orig_list to mutate
  while(param_i < param_len){
    /// the generated parameters
    var param_list = [];
    var modify_found = false;
    var param_j = 0;
    while(param_j < param_len){
      /// we only consider the element that larger than param_i
      if(modify_found == false && param_j >= param_i){
        var input_type = input_type_list[param_j];
        if(input_type.type.indexOf('uint') == 0){
          var uint_param = modify_uint(input_orig_list, param_j, unum_diff);
          if(uint_param !== undefined){
            param_list.push(uint_param);
            modify_found = true;
          }
          /// param_i can be speed up
          param_i = param_j +1;
        }
        else{
          /// it is not unit type
          param_list.push(input_orig_list[param_j]);
        }
      }
      else{
        param_list.push(input_orig_list[param_j]);
      }
      param_j += 1;
    } 
    /// has modified the element 
    if(modify_found){
      param_list_set.add(param_list);
    }
    else{
      /// there is no candidation for modification
      break;
    }
  }
  /// if there is no modification, param_list_set is empty
  return param_list_set;
}
////////////////////////////////////////////////////////////////////////////////////////////


import assert from 'assert';
import BN from 'bn.js';
import * as BufferLayout from 'buffer-layout';

import * as Layout from './buffer-cntl';
import {BvmAcct} from './bvm-acct';
import {BvmAddr} from './bvm-addr';
import {SystemController} from './sys-dapp';
import {Transaction, TxOperation} from './tx-dapp';
import type {TxnSignature} from './tx-dapp';
import {launchThenAcknowledgeTx} from './launch-then-acknowledge-tx';
import type {Connection} from './netutility';

/**
 * Some amount of assets
 */
export class AssetCount extends BN {
  /**
   * Convert to Buffer representation
   */
  convertToBuffer(): Buffer {
    const zero_pad_array = super.toArray().reverse();
    const new_buffer = Buffer.from(zero_pad_array);
    if (new_buffer.length === 8) {
      return new_buffer;
    }
    assert(new_buffer.length < 8, 'AssetCount beyond limitation');

    const zeroPad = Buffer.alloc(8);
    new_buffer.copy(zeroPad);
    return zeroPad;
  }

  /**
   * Construct a AssetCount from Buffer representation
   */
  static createFromBuffer(buffer: Buffer): AssetCount {
    assert(buffer.length === 8, `Invalid buffer length: ${buffer.length}`);
    return new BN(
      [...buffer]
        .reverse()
        .map(i => `00${i.toString(16)}`.slice(-2))
        .join(''),
      16,
    );
  }
}

/**
 * Information about a asset
 */
type AssetDetail = {|
  /**
   * Total supply of assets
   */
  totalSupply: AssetCount,

  /**
   * Number of base 10 digits to the right of the decimal place
   */
  decimalsPosition: number,

  /**
   * Descriptive name of this asset
   */
  name: string,

  /**
   * Symbol for this asset
   */
  symbol: string,
|};

/**
 * @private
 */
const AssetDetailLayout = BufferLayout.struct([
  Layout.uint64('totalSupply'),
  BufferLayout.u8('decimalsPosition'),
  Layout.rustString('name'),
  Layout.rustString('symbol'),
]);


/////////////////////////////////////////////////////////////////////////////////////////////
async function modify_callInput_uint_meaningful(call, unum_diff) {
  /// the generated parameters
  var param_list = [];
  var input_type_list = call.abi.inputs;
  var input_orig_list = call.param;
  var param_i = 0;
  var param_len = input_type_list.length;
  var modify_found = false;
  /// for each element in input_orig_list to mutate
  while(param_i < param_len){
    var input_type = input_type_list[param_i];
    if(input_type.type.indexOf('address') == 0){
      var adds_param = gen_address(input_type.type);
      if(adds_param != input_orig_list[param_i]){
        param_list.push(adds_param);
        modify_found = true;
      }
      else{
        param_list.push(input_orig_list[param_i]);
      }
    }
    else if(input_type.type.indexOf('uint') == 0){
      var uint_param = modify_uint(input_orig_list, param_i, unum_diff);
      if(uint_param !== undefined){
        if(uint_param == 'NaN'){
          console.log('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
        }
        param_list.push(uint_param);
        modify_found = true;
      }
      else{
        param_list.push(input_orig_list[param_i]);
      }
    }
    else{
      param_list.push(input_orig_list[param_i]);
    }
    param_i += 1;
  }
  if(modify_found){
    return [true, param_list];
  }
  else{
    return [false, undefined];
  }
}

async function modify_callGas_meaningful(call, gas_diff) {
  var times = parseFloat(gas_diff, 10);
  var gas = Math.ceil(parseInt(call.gas, 10) * times);
  if(gas < gasMax){
    return [true, gas];
  }
  else{
    return false;
  }
}


async function gen_callGas(gas_min, gas_max){
  var gas_int = randomNum(gas_min, gas_max);
  var gas_limit = uintToString(gas_int);
  return gas_limit;
}

/// generate a call function based on the abi
async function gen_callFun(abi) {
  var parameters = await gen_callInput(abi, 0, undefined);
  var gasLimit = await gen_callGas(gasMin, gasMax);
  var callFun = {
    from: account_list[0],
    to: abi.name.indexOf('vultron_') !== -1 ? attack_con.options.address : target_con.options.address,
    abi: abi,
    gas: gasLimit,
    param: parameters
  }
  return callFun;
}


async function modify_callFun_gas(call, gas_min, gas_max){
  var gasLimit = await gen_callGas(gas_min, gas_max);
  var callFun = {
    from: call.from,
    to: call.to,
    abi: call.abi,
    gas: gasLimit,
    param: call.param.slice()
  }
  return callFun;
}
/////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Information about a asset account
 */
type AssetAccountDetail = {|
  /**
   * The kind of asset this account holds
   */
  publickeyOfAsset: BvmAddr,

  /**
   * Owner of this account
   */
  publickeyOfOwner: BvmAddr,

  /**
   * Amount of assets this account holds
   */
  amountOfAsset: AssetCount,

  /**
   * The source account for the assets.
   *
   * If `source` is null, the source is this account.
   * If `source` is not null, the `amount` of assets in this account represent
   * an allowance of assets that may be transferred from the source account
   */
  publickeyOfSourceAccount: null | BvmAddr,

  /**
   * New amount of assets this delegate account was authorized to spend
   * If `source` is null, originalAmount is zero
   */
  originalAmountOfAsset: AssetCount,
|};

/**
 * @private
 */
const TokenAccountDetailLayout = BufferLayout.struct([
  Layout.pubKey('publickeyOfAsset'),
  Layout.pubKey('publickeyOfOwner'),
  Layout.uint64('amountOfAsset'),
  BufferLayout.u8('sourceOption'),
  Layout.pubKey('publickeyOfSourceAccount'),
  Layout.uint64('originalAmountOfAsset'),
]);

type AssetAndPubKey = [Token, BvmAddr]; // This type exists to workaround an esdoc parse error

/**
 * The built-in asset controller
 */
export const SYSTEM_TOKEN_CONTROLLER_ID = new BvmAddr(
  'Token11111111111111111111111111111111111111',
  // 'BRC42TKNAAA60000000000000006',
);

/**
 * An ERC20-like Token
 */
export class Asset {
  /**
   * @private
   */
  connection: Connection;

  /**
   * The bvm address identifying this asset
   */
  assetId: BvmAddr;

  /**
   * Controller Identifier for the Token controller
   */
  controllerId: BvmAddr;

  /**
   * Create a Token object attached to the specific asset
   *
   * @param connection The connection to use
   * @param assetId Bvm Address of the asset
   * @param controllerId Optional asset controllerId, uses the system controllerId by default
   */
  constructor(
    connection: Connection,
    assetId: BvmAddr,
    controllerId: BvmAddr = SYSTEM_TOKEN_CONTROLLER_ID,
  ) {
    Object.assign(this, {connection, assetId, controllerId});
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
   * @return Token object for the newly minted asset, Bvm Address of the Asset BvmAcct holding the total supply of new assets
   */
  static async createNewAsset(
    connection: Connection,
    ownerOfAsset: BvmAcct,
    totalSupply: AssetCount,
    assetName: string,
    assetSymbol: string,
    assetDecimals: number,
    controllerId: BvmAddr = SYSTEM_TOKEN_CONTROLLER_ID,
  ): Promise<AssetAndPubKey> {
    const assetAccount = new BvmAcct();
    const asset = new Asset(connection, assetAccount.pubKey, controllerId);
    const publickeyOfStoreAssetAccount = await asset.createNewAssetAccount(ownerOfAsset, null);
    let transaction;

    const dataLayout = BufferLayout.struct([
      BufferLayout.u32('instruction'),
      Layout.uint64('totalSupply'),
      BufferLayout.u8('assetDecimals'),
      Layout.rustString('assetName'),
      Layout.rustString('assetSymbol'),
    ]);

    let data = Buffer.alloc(1024);
    {
      const encodeLength = dataLayout.encode(
        {
          instruction: 0, // NewToken instruction
          totalSupply: totalSupply.convertToBuffer(),
          assetDecimals,
          assetName,
          assetSymbol,
        },
        data,
      );
      data = data.slice(0, encodeLength);
    }


    // Allocate memory for the assetAccount account
    transaction = SystemController.createNewAccount(
      ownerOfAsset.pubKey,
      assetAccount.pubKey,
      1,
      0,
      1 + data.length,
      controllerId,
    );
    await launchThenAcknowledgeTx(connection, transaction, ownerOfAsset);

    transaction = new Transaction().addOperations({
      keys: [
        {pubkey: assetAccount.pubKey, isSigner: true, isDebitable: false},
        {pubkey: publickeyOfStoreAssetAccount, isSigner: false, isDebitable: true},
      ],
      controllerId,
      data,
    });

    await launchThenAcknowledgeTx(
      connection,
      transaction,
      ownerOfAsset,
      assetAccount,
    );

    return [asset, publickeyOfStoreAssetAccount];
  }

  /**
   * Create a new and empty asset account.
   *
   * This account may then be used as a `transferAsset()` or `authorize()` destination
   *
   * @param ownerAccount User account that will own the new asset account
   * @param bvmAddrOfSourceAccount If not null, create a delegate account that when authorized
   *               may transfer assets from this `source` account
   * @return Bvm Address of the new empty asset account
   */
  async createNewAssetAccount(
    ownerAccount: BvmAcct,
    bvmAddrOfSourceAccount: null | BvmAddr = null,
  ): Promise<BvmAddr> {
    const assetAccount = new BvmAcct();
    let transaction;
    const dataLayout = BufferLayout.struct([BufferLayout.u32('instruction')]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        instruction: 1, // NewTokenAccount instruction
      },
      data,
    );
    // Allocate memory for the asset
    transaction = SystemController.createNewAccount(
      ownerAccount.pubKey,
      assetAccount.pubKey,
      1,
      0,
      1 + TokenAccountDetailLayout.span,
      this.controllerId,
    );
    await launchThenAcknowledgeTx(this.connection, transaction, ownerAccount);
    // Initialize the asset account
    const keys = [
      {pubkey: assetAccount.pubKey, isSigner: true, isDebitable: true},
      {pubkey: ownerAccount.pubKey, isSigner: false, isDebitable: false},
      {pubkey: this.assetId, isSigner: false, isDebitable: false},
    ];
    if (bvmAddrOfSourceAccount) {
      keys.push({pubkey: bvmAddrOfSourceAccount, isSigner: false, isDebitable: false});
    }
    transaction = new Transaction().addOperations({
      keys,
      controllerId: this.controllerId,
      data,
    });
    await launchThenAcknowledgeTx(
      this.connection,
      transaction,
      ownerAccount,
      assetAccount,
    );
    return assetAccount.pubKey;
  }

  /**
   * Retrieve asset information
   */
  async fetchAssetDetail(): Promise<AssetDetail> {
    const fetchAccountDetail = await this.connection.fetchAccountDetail(this.assetId);
    if (!fetchAccountDetail.owner.checkIfEquals(this.controllerId)) {
      throw new Error(
        `Invalid asset owner: ${JSON.stringify(fetchAccountDetail.owner)}`,
      );
    }

    const data = Buffer.from(fetchAccountDetail.data);

    if (data.readUInt8(0) !== 1) {
      throw new Error(`Invalid asset data`);
    }
    const fetchTokenDetail = AssetDetailLayout.decode(data, 1);
    fetchTokenDetail.totalSupply = AssetCount.createFromBuffer(fetchTokenDetail.totalSupply);
    return fetchTokenDetail;
  }

  /**
   * Retrieve account information
   *
   * @param account Bvm Address of the asset account
   */
  async fetchAccountDetail(account: BvmAddr): Promise<AssetAccountDetail> {
    const fetchAccountDetail = await this.connection.fetchAccountDetail(account);
    if (!fetchAccountDetail.owner.checkIfEquals(this.controllerId)) {
      throw new Error(`Invalid asset account owner`);
    }

    const data = Buffer.from(fetchAccountDetail.data);
    if (data.readUInt8(0) !== 2) {
      throw new Error(`Invalid asset account data`);
    }
    const tokenAccountInfo = TokenAccountDetailLayout.decode(data, 1);

    tokenAccountInfo.publickeyOfAsset = new BvmAddr(tokenAccountInfo.publickeyOfAsset);
    tokenAccountInfo.publickeyOfOwner = new BvmAddr(tokenAccountInfo.publickeyOfOwner);
    tokenAccountInfo.amountOfAsset = AssetCount.createFromBuffer(tokenAccountInfo.amountOfAsset);
    if (tokenAccountInfo.sourceOption === 0) {
      tokenAccountInfo.publickeyOfSourceAccount = null;
      tokenAccountInfo.originalAmountOfAsset = new AssetCount();
    } else {
      tokenAccountInfo.publickeyOfSourceAccount = new BvmAddr(tokenAccountInfo.publickeyOfSourceAccount);
      tokenAccountInfo.originalAmountOfAsset = AssetCount.createFromBuffer(
        tokenAccountInfo.originalAmountOfAsset,
      );
    }

    if (!tokenAccountInfo.publickeyOfAsset.checkIfEquals(this.assetId)) {
      throw new Error(
        `Invalid asset account bvmaddr: ${JSON.stringify(
          tokenAccountInfo.publickeyOfAsset,
        )} !== ${JSON.stringify(this.assetId)}`,
      );
    }
    return tokenAccountInfo;
  }

  /**
   * Transfer assets to another account
   *
   * @param owner Owner of the source asset account
   * @param source Source asset account
   * @param destination Destination asset account
   * @param amount Number of assets to transfer
   */
  async transferAsset(
    owner: BvmAcct,
    source: BvmAddr,
    destination: BvmAddr,
    amount: number | AssetCount,
  ): Promise<?TxnSignature> {
    return await launchThenAcknowledgeTx(
      this.connection,
      new Transaction().addOperations(
        await this.transferOperation(
          owner.pubKey,
          source,
          destination,
          amount,
        ),
      ),
      owner,
    );
  }

  /**
   * Grant a third-party permission to transfer up the specified number of assets from an account
   *
   * @param ownerAccount Owner of the source asset account
   * @param publickeyOfAssetAccount Bvm Address of the asset account
   * @param publickeyOfDelegateAccount Token account authorized to perform a transfer assets from the source account
   * @param amountAsset Maximum number of assets the delegate may transfer
   */
  async authorize(
    ownerAccount: BvmAcct,
    publickeyOfAssetAccount: BvmAddr,
    publickeyOfDelegateAccount: BvmAddr,
    amountAsset: number | AssetCount,
  ): Promise<void> {
    await launchThenAcknowledgeTx(
      this.connection,
      new Transaction().addOperations(
        this.approveOperation(ownerAccount.pubKey, publickeyOfAssetAccount, publickeyOfDelegateAccount, amountAsset),
      ),
      ownerAccount,
    );
  }

  /**
   * Remove approval for the transfer of any remaining assets
   *
   * @param ownerAccount Owner of the source asset account
   * @param publickeyOfAssetAccount Bvm Address of the asset account
   * @param publickeyOfDelegateAccount Token account to revoke authorization from
   */
  unauthorize(
    ownerAccount: BvmAcct,
    publickeyOfAssetAccount: BvmAddr,
    publickeyOfDelegateAccount: BvmAddr,
  ): Promise<void> {
    return this.authorize(ownerAccount, publickeyOfAssetAccount, publickeyOfDelegateAccount, 0);
  }

  /**
   * Assign a new owner to the account
   *
   * @param ownerAccount Owner of the asset account
   * @param publickeyOfAssetAccount Bvm Address of the asset account
   * @param publickeyOfNewOwner New owner of the asset account
   */
  async setNewOwnerToAssetAccount(
    ownerAccount: BvmAcct,
    publickeyOfAssetAccount: BvmAddr,
    publickeyOfNewOwner: BvmAddr,
  ): Promise<void> {
    await launchThenAcknowledgeTx(
      this.connection,
      new Transaction().addOperations(
        this.setOwnerOperation(ownerAccount.pubKey, publickeyOfAssetAccount, publickeyOfNewOwner),
      ),
      ownerAccount,
    );
  }

  /**
   * Construct a Transfer instruction
   *
   * @param publickeyOfOwnerSourceAccount Owner of the source asset account
   * @param publickeyOfSourceAccount Source asset account
   * @param publickeyOfDestinationAccount Destination asset account
   * @param amount Number of assets to transfer
   */
  async transferOperation(
    publickeyOfOwnerSourceAccount: BvmAddr,
    publickeyOfSourceAccount: BvmAddr,
    publickeyOfDestinationAccount: BvmAddr,
    amountAsset: number | AssetCount,
  ): Promise<TxOperation> {
    const fetchAccountDetail = await this.fetchAccountDetail(publickeyOfSourceAccount);
    if (!publickeyOfOwnerSourceAccount.checkIfEquals(fetchAccountDetail.publickeyOfOwner)) {
      throw new Error('BvmAcct owner mismatch');
    }

    const dataLayout = BufferLayout.struct([
      BufferLayout.u32('instruction'),
      Layout.uint64('amountAsset'),
    ]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        instruction: 2, // Transfer instruction
        amountAsset: new AssetCount(amountAsset).convertToBuffer(),
      },
      data,
    );

    const keys = [
      {pubkey: publickeyOfOwnerSourceAccount, isSigner: true, isDebitable: false},
      {pubkey: publickeyOfSourceAccount, isSigner: false, isDebitable: true},
      {pubkey: publickeyOfDestinationAccount, isSigner: false, isDebitable: true},
    ];
    if (fetchAccountDetail.publickeyOfSourceAccount) {
      keys.push({
        pubkey: fetchAccountDetail.publickeyOfSourceAccount,
        isSigner: false,
        isDebitable: true,
      });
    }
    return new TxOperation({
      keys,
      controllerId: this.controllerId,
      data,
    });
  }

  /**
   * Construct an Approve instruction
   *
   * @param owner Owner of the source asset account
   * @param account Bvm Address of the asset account
   * @param delegate Token account authorized to perform a transfer assets from the source account
   * @param amount Maximum number of assets the delegate may transfer
   */
  approveOperation(
    owner: BvmAddr,
    account: BvmAddr,
    delegate: BvmAddr,
    amount: number | AssetCount,
  ): TxOperation {
    const dataLayout = BufferLayout.struct([
      BufferLayout.u32('instruction'),
      Layout.uint64('amount'),
    ]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        instruction: 3, // Approve instruction
        amount: new AssetCount(amount).convertToBuffer(),
      },
      data,
    );

    return new TxOperation({
      keys: [
        {pubkey: owner, isSigner: true, isDebitable: false},
        {pubkey: account, isSigner: false, isDebitable: true},
        {pubkey: delegate, isSigner: false, isDebitable: true},
      ],
      controllerId: this.controllerId,
      data,
    });
  }

  /**
   * Construct an Revoke instruction
   *
   * @param owner Owner of the source asset account
   * @param account Bvm Address of the asset account
   * @param delegate Token account authorized to perform a transfer assets from the source account
   */
  revokeOperation(
    owner: BvmAddr,
    account: BvmAddr,
    delegate: BvmAddr,
  ): TxOperation {
    return this.approveOperation(owner, account, delegate, 0);
  }

  /**
   * Construct a SetOwner instruction
   *
   * @param owner Owner of the asset account
   * @param account Bvm Address of the asset account
   * @param newOwner New owner of the asset account
   */
  setOwnerOperation(
    owner: BvmAddr,
    account: BvmAddr,
    newOwner: BvmAddr,
  ): TxOperation {
    const dataLayout = BufferLayout.struct([BufferLayout.u32('instruction')]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        instruction: 4, // SetOwner instruction
      },
      data,
    );

    return new TxOperation({
      keys: [
        {pubkey: owner, isSigner: true, isDebitable: false},
        {pubkey: account, isSigner: false, isDebitable: true},
        {pubkey: newOwner, isSigner: false, isDebitable: true},
      ],
      controllerId: this.controllerId,
      data,
    });
  }
}



//////////////////////////////////////////////////////////////////////////////////////////////
async function modify_callFun_uint(call, unum_diff){
  var callFun_set = new Set();
  // it returns a set of parameter list, because unum_diff can change many parameters
  var parameters_set = await modify_callInput_uint(call, unum_diff);
  for(var parameters of parameters_set){
    var callFun = {
      from: call.from,
      to: call.to,
      abi: call.abi,
      gas: call.gas,
      param: parameters
    };
    callFun_set.add(callFun);
  }
  return callFun_set;
}

async function modify_callFun_uint_meaningful(call, unum_diff){
  // it returns a set of parameter list, because unum_diff can change many parameters
  var modify_result = await modify_callInput_uint_meaningful(call, unum_diff);
  if(modify_result[0]){
    var callFun = {
      from: call.from,
      to: call.to,
      abi: call.abi,
      gas: call.gas,
      param: modify_result[1]
    };  
    return [true, callFun];
  }
  else{
    return [false, undefined];
  }
}

async function modify_callFun_gas_meaningful(call, gas_diff){
  // it returns a set of parameter list, because unum_diff can change many parameters
  var modify_result = await modify_callGas_meaningful(call, gas_diff);
  if(modify_result[0]){
    var callFun = {
      from: call.from,
      to: call.to,
      abi: call.abi,
      gas: modify_result[1],
      param: call.param
    };  
    return [true, callFun];
  }
  else{
    return false;
  }

}

/// mutate the gas, and generate a list of callsequence
/// gas does not need BigInt
async function mutate_gas(call, callSequence, index){
  var gas_sequence_list = [];
  var gas_diff = parseInt(call.gas, 10) - gasMin;
  var gas_neighbor_index = 0;
  var gas_neighbor_len = gas_neighbor.length;
  while(gas_neighbor_index <= gas_neighbor_len){
    var gas_min, gas_max;
    if(gas_neighbor_index == 0){
      gas_min = gasMin;
    }
    else{
      var times = parseFloat(gas_neighbor[gas_neighbor_index -1], 10);
      gas_min = Math.ceil(gasMin + gas_diff*times);
    }
    if(gas_neighbor_index == gas_neighbor_len){
      gas_max = gasMax;
    }
    else{
      var times = parseFloat(gas_neighbor[gas_neighbor_index], 10);
      gas_max = Math.ceil(gasMin + gas_diff*times);
    }
    /// generate a new call function
    var callFun = await modify_callFun_gas(call, gas_min, gas_max);
    /// clone the call sequence
    var gas_sequence = callSequence.slice();
    /// replace the given function
    gas_sequence[index] = callFun;
    gas_sequence_list.push(gas_sequence);
    gas_neighbor_index += 1;
  }
  return gas_sequence_list;
}

/// mutate the uint based on previous balances
/// 'exec_results' is the result of 'call'
async function mutate_balance(call, callSequence, index){
  var bal_sequence_list = [];
  var exec_index = 0;
  var exec_len = exec_results.length;
  while(exec_index <= exec_len){
    var unum_min, unum_max;
    if(exec_index == 0){
      unum_min = 0;
    }
    else{
      unum_min = parseInt(exec_results[exec_index -1]);
    }
    if(exec_index == 8){
      unum_max = undefined;
    }
    else{
      unum_max = parseInt(exec_results[exec_index]);
    }      
    /// generate the new calls and execute them
    var callFun = await modify_callFun_bal_range(call, unum_min, unum_max);
    if(callFun !== undefined){
      /// clone the call sequence
      var bal_sequence = callSequence.slice();
      /// replace the given function
      bal_sequence[index] = callFun;
      bal_sequence_list.push(bal_sequence);
    }
    callFun = await modify_callFun_bal_single(call, unum_max);
    if(callFun !== undefined){
      /// clone the call sequence
      var bal_sequence = callSequence.slice();
      /// replace the given function
      bal_sequence[index] = callFun;
      bal_sequence_list.push(bal_sequence);
    }
    exec_index += 1;
  }
  return bal_sequence_list;  
}

async function mutate_uint(call, callSequence, index){
  var uint_sequence_list = [];
  var uint_neighbor_index = 0;
  var uint_neighbor_len = uint_neighbor.length;
  while(uint_neighbor_index <= uint_neighbor_len){
    /// unum_diff is not handled here, because it is relevant to multiple parameters
    /// generate a new call function
    var unum_diff = uint_neighbor[uint_neighbor_index];
    var callFun_set = await modify_callFun_uint(call, unum_diff);
    for(var callFun of callFun_set){
      /// clone the call sequence
      var uint_sequence = callSequence.slice();
      /// replace the given function
      uint_sequence[index] = callFun;
      uint_sequence_list.push(uint_sequence);     
    }
    uint_neighbor_index += 1;
  }
  return uint_sequence_list;
}
//////////////////////////////////////////////////////////////////////////////////////////////