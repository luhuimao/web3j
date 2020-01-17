// @flow

    // static getPayload(cursor) {
    //   const argType = cursor.read32();
    //   if (argType === transaction_pb_1.TransactionArgument.ArgType.U64) {
    //       const data = cursor.read64();
    //       return TransactionArgumentLCS_1.TransactionArgumentLCS.fromU64(data.toString());
    //   }
    //   else if (argType === transaction_pb_1.TransactionArgument.ArgType.ADDRESS) {
    //       const data = this.getAddress(cursor);
    //       return TransactionArgumentLCS_1.TransactionArgumentLCS.fromAddress(data);
    //   }
    //   else if (argType === transaction_pb_1.TransactionArgument.ArgType.STRING) {
    //       const data = this.getString(cursor);
    //       return TransactionArgumentLCS_1.TransactionArgumentLCS.fromString(data);
    //   }
    //   else if (argType === transaction_pb_1.TransactionArgument.ArgType.BYTEARRAY) {
    //       const data = this.getByteArray(cursor);
    //       return TransactionArgumentLCS_1.TransactionArgumentLCS.fromByteArray(data);
    //   }
    //   return new TransactionArgumentLCS_1.TransactionArgumentLCS();
    // }

import nacl from 'tweetnacl';
import type {KeyPair} from 'tweetnacl';

import {BvmAddr} from './bvm-addr';

class CursorBuffer {
    constructor(typedArray, littleEndian = true) {
        this.dataView = new DataView(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
        this.littleEndian = littleEndian;
        this.bytePositon = 0;
    }
    /**
     * Reads 1 byte
     *
     */
    read8() {
        const value = this.dataView.getUint8(this.bytePositon);
        this.bytePositon += 1;
        return value;
    }
    /**
     * Reads 4 bytes
     *
     */
    read32() {
        const value = this.dataView.getUint32(this.bytePositon, this.littleEndian);
        this.bytePositon += 4;
        return value;
    }
    /**
     * Reads 8 bytes
     *
     *
     */
    // read64() {
    //     const firstPart = this.read32();
    //     const secondPart = this.read32();
    //     const combined = this.littleEndian
    //         ? secondPart.toString(16) + firstPart.toString(16).padStart(8, '0')
    //         : firstPart.toString(16) + secondPart.toString(16).padStart(8, '0');
    //     return new bignumber_js_1.default(`0x${combined}`, 16);
    // }
    readXBytes(x) {
        // console.log(this.bytePositon, this.dataView.byteOffset);
        // this.bytePositon -= 8;

        const startPosition = this.bytePositon + this.dataView.byteOffset; // original = 27
        console.log(startPosition);
        const value = new Uint8Array(this.dataView.buffer, startPosition, x);
        this.bytePositon += x;
        return value;

        // + 8 // receiver | 19 // sender (when not skipping bytes with .read32 before signedTxn)

        // const startPosition = this.bytePositon + this.dataView.byteOffset + 8; // receiver = 35
        // const value = new Uint8Array(this.dataView.buffer, startPosition, x);
        // this.bytePositon += x;
        // return value;

        // const value = new Uint8Array(this.dataView.buffer, 19, x); // sender
        // return value;
    }
    readXXBytes(x) {
      this.bytePositon += 4;
      
      const value = new Uint8Array(this.dataView.buffer, 271, x);
      return value;
    }
    /**
     * Read bool as 1 byte
     *
     */
    readBool() {
        const value = this.dataView.getUint8(this.bytePositon);
        this.bytePositon += 1;
        if (value !== 0 && value !== 1) {
            throw new Error(`bool must be 0 or 1, found ${value}`);
        }
        return value !== 0;
    }
}

/**
 * An account key pair (public and secret keys).
 */
export class BvmAcct {
  _keypair: KeyPair;

  /**
   * Create a new BvmAcct object
   *
   * If the privateKey parameter is not provided a new key pair is randomly
   * created for the account
   *
   * @param privateKey Secret key for the account
   */
  constructor(privateKey: ?Buffer = null) {
    if (privateKey) {
      this._keypair = nacl.sign.keyPair.fromSecretKey(privateKey);
    } else {
      this._keypair = nacl.sign.keyPair();
    }
  }

  /**
   * The public key for this account
   */
  get pubKey(): BvmAddr {
    return new BvmAddr(this._keypair.publicKey);
  }

  /**
   * The **unencrypted** secret key for this account
   */
  get privateKey(): Buffer {
    return this._keypair.secretKey;
  }
}



// static getRawTransaction(cursor) {
    //     const sender = this.getAddress(cursor);
    //     const sequence = cursor.read64();
    //     const payload = this.getTransactionPayload(cursor);
    //     const maxGasAmount = cursor.read64();
    //     const gasUnitPrice = cursor.read64();
    //     const expiryTime = cursor.read64();
    //     const transaction = new RawTransactionLCS_1.RawTransactionLCS(sender.value, sequence.toString(), payload);
    //     transaction.maxGasAmount = maxGasAmount;
    //     transaction.gasUnitPrice = gasUnitPrice;
    //     transaction.expirtationTime = expiryTime;
    //     return transaction;
    // }



    

    // static getRawTransaction(cursor) {
    //   const sender = this.getAddress(cursor);
    //   const sequence = cursor.read64();
    //   // const payload = this.getTransactionPayload(cursor);
    //   const maxGasAmount = cursor.read64();
    //   const gasUnitPrice = new BigNumber.default(cursor.read64());
    //   const expiryTime = new BigNumber.default(cursor.read64());
    //   // const transaction = new RawTransactionLCS_1.RawTransactionLCS(sender.value, sequence.toString(), payload);
    //   // transaction.maxGasAmount = maxGasAmount;
    //   // transaction.gasUnitPrice = gasUnitPrice;
    //   // transaction.expirtationTime = expiryTime;
    //   return ({sender:sender, sequence:sequence, maxGasAmount:maxGasAmount, gasUnitPrice:gasUnitPrice, expiryTime:expiryTime});
    // }


    import * as fs from 'fs'
import * as path from 'path'

type PackageJson = {
  name: string,
  version?: string,
  description?: string,
  main?: string,
  scripts?: { [string]: string },
  dependencies?: { [string]: string },
  devDependencies?: { [string]: string }
}

export async function findNearestPackageJson(
  directoryPath: string = path.resolve()
): Promise<{ path: string, data: PackageJson }> {
  try {
    const packageJsonPath = path.join(directoryPath, 'package.json')
    const packageJsonData = JSON.parse(await readFile(packageJsonPath))
    return {
      path: packageJsonPath,
      data: packageJsonData
    }
  } catch (error) {
    const parentDirectoryPath = path.dirname(directoryPath)
    if (parentDirectoryPath === directoryPath) {
      throw new Error('No package.json files found')
    }
    return findNearestPackageJson(parentDirectoryPath)
  }
}

function readFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (error, result) => {
      if (error) reject(error)
      else resolve(result)
    })
  })
}

export function findNearestPackageJsonSync(
  directoryPath: string = path.resolve()
): { path: string, data: PackageJson } {
  try {
    const packageJsonPath = path.join(directoryPath, 'package.json')
    const packageJsonData = JSON.parse(readFileSync(packageJsonPath))
    return {
      path: packageJsonPath,
      data: packageJsonData
    }
  } catch (error) {
    const parentDirectoryPath = path.dirname(directoryPath)
    if (parentDirectoryPath === directoryPath) {
      throw new Error('No package.json files found')
    }
    return findNearestPackageJsonSync(parentDirectoryPath)
  }
}

function readFileSync(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}


class StatusCode {
    static getStatusMessage(status) {
        let message = '';
        switch (status) {
            case this.Success:
                message = 'success';
                break;
            case this.Unknown:
                message = 'unknown';
                break;
            case this.BadRLP:
                message = 'bad RLP';
                break;
            case this.InvalidFormat:
                message = 'invalid format';
                break;
            case this.OutOfGasIntrinsic:
                message = 'out of gas intrinsic';
                break;
            case this.InvalidSignature:
                message = 'invalid signature';
                break;
            case this.InvalidNonce:
                message = 'invalid nonce';
                break;
            case this.NotEnoughCash:
                message = 'not enough cash';
                break;
            case this.OutOfGasBase:
                message = 'out of gas base';
                break;
            case this.BlockGasLimitReached:
                message = 'block gas limit reached';
                break;
            case this.BadInstruction:
                message = 'bad instruction';
                break;
            case this.BadJumpDestination:
                message = 'bad jump destination';
                break;
            case this.OutOfGas:
                message = 'out of gas';
                break;
            case this.OutOfStack:
                message = 'out of stack';
                break;
            case this.StackUnderflow:
                message = 'stack underflow';
                break;
            case this.NonceCheckFail:
                message = 'nonce check fail';
                break;
            case this.BlockLimitCheckFail:
                message = 'block limit check fail';
                break;
            case this.FilterCheckFail:
                message = 'filter check fail';
                break;
            case this.NoDeployPermission:
                message = 'no deploy permission';
                break;
            case this.NoCallPermission:
                message = 'no call permission';
                break;
            case this.NoTxPermission:
                message = 'no tx permission';
                break;
            case this.PrecompiledError:
                message = 'precompiled error';
                break;
            case this.RevertInstruction:
                message = 'revert instruction';
                break;
            case this.InvalidZeroSignatureFormat:
                message = 'invalid zero signature format';
                break;
            case this.AddressAlreadyUsed:
                message = 'address already used';
                break;
            case this.PermissionDenied:
                message = 'permission denied';
                break;
            case this.CallAddressError:
                message = 'call address error';
                break;
            default:
                message = `unknown status code:${status}`;
                break;
        }

        return message;
    }
}

StatusCode.Success = '0x0';
StatusCode.Unknown = '0x1';
StatusCode.BadRLP = '0x2';
StatusCode.InvalidFormat = '0x3';
StatusCode.OutOfGasIntrinsic = '0x4';
StatusCode.InvalidSignature = '0x5';
StatusCode.InvalidNonce = '0x6';
StatusCode.NotEnoughCash = '0x7';
StatusCode.OutOfGasBase = '0x8';
StatusCode.BlockGasLimitReached = '0x9';
StatusCode.BadInstruction = '0xa';
StatusCode.BadJumpDestination = '0xb';
StatusCode.OutOfGas = '0xc';
StatusCode.OutOfStack = '0xd';
StatusCode.StackUnderflow = '0xe';
StatusCode.NonceCheckFail = '0xf';
StatusCode.BlockLimitCheckFail = '0x10';
StatusCode.FilterCheckFail = '0x11';
StatusCode.NoDeployPermission = '0x12';
StatusCode.NoCallPermission = '0x13';
StatusCode.NoTxPermission = '0x14';
StatusCode.PrecompiledError = '0x15';
StatusCode.RevertInstruction = '0x16';
StatusCode.InvalidZeroSignatureFormat = '0x17';
StatusCode.AddressAlreadyUsed = '0x18';
StatusCode.PermissionDenied = '0x19';
StatusCode.CallAddressError = '0x1a';