// @flow

function uintOrNaN (v) {
    if (typeof v !== 'number') return NaN
    if (!isFinite(v)) return NaN
    if (Math.floor(v) !== v) return NaN
    if (v < 0) return NaN
    return v
}

function blackjack (utxos, outputs) {
    if (!isFinite(uintOrNaN(outputs.targetValue))) return []

    var inAccum = 0
    var inputs = []
    var targetValue = outputs.targetValue;

    for (var i = 0; i < utxos.length; ++i) {
        var input = utxos[i]

        inAccum += uintOrNaN(input.balance)
        inputs.push(input)

        if (inAccum >= targetValue)
            return inputs;
    }

    return []
}

function utxoScore (x) {
    return x.balance
}

function numberWithCommas(x) {
    var number = x.toString();
    var beforePeriod = number.slice(0, number.indexOf("."));
    var afterPeriod = number.slice(number.indexOf("."), number.length);
    var numberWithComma = beforePeriod.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return numberWithComma + afterPeriod;
}

function showSnackBar(msg) {
    var $snackbar = $('#snackbar');
    if ($snackbar.length === 0) {
        $('body').append('<div id="snackbar"></div>');
        $snackbar = $('#snackbar');
    }

    $snackbar.text(msg);
    $snackbar.addClass("show");
    setTimeout(function(){
        $snackbar.removeClass("show");
    }, 3000);
}

function changeDateFormatKr(date) {
    var year = date.getFullYear();
    var month = (1 + date.getMonth());
    month = month >= 10 ? month : '0' + month;
    var day = date.getDate();
    day = day >= 10 ? day : '0' + day;

    var hh = date.getHours();
    hh = hh >= 10 ? hh : '0' + hh;
    var mm = date.getMinutes();
    mm = mm >= 10 ? mm : '0' + mm;

    return  year + '.' + month + '.' + day + " " + hh + ":" + mm;
}

function filterNumberOnly(input) {
    return (input != null ? input.replace(/[^0-9.]/gi, '') : input);
}

import * as BufferLayout from 'buffer-layout';

import {Transaction} from './tx-dapp';
import {BvmAddr} from './bvm-addr';
import {SystemController} from './sys-dapp';
import JS from './js';
import PreCondition from './preconditions';

function toDisplayAmount(number) {
    if (typeof number !== 'number') {
        number = Number(number);
    }

    number = number.toFixed(8);
    number = number.replace(/(0+$)/, "");

    if (number.indexOf(".") === (number.length - 1)) {
        number = number.substr(0, number.length - 1)
    }

    return number;
}

/**
 * Matched a condiction which created by executing a transaction generated by sealWithSignature()
 * 
 * @typedef {Object} SignatureCond
 * @property {string} type string type for 'signature'
 * @property {BvmAddr} from Bvm Address for whom signed the transaction
 */
export type SignatureCond = {
  type: 'signature',
  from: BvmAddr,
};

/**
 * Matched a condiction which created by executing a transaction generated by sealWithDatetime()

 * @typedef {Object} TimestampCond
 * @property {string} type string type 'timestamp'
 * @property {BvmAddr} from Bvm Address from which `sealWithDatetime()` will be accepted from
 * @property {Date} when The timestamp that will be trigger
 */
export type TimestampCond = {
  type: 'timestamp',
  from: BvmAddr,
  when: Date,
};

/**
 * Payment consist of payment's amount and payee's bvm address
 * 
 * @typedef {Object} Payment
 * @property {number} amount Amount of difs
 * @property {BvmAddr} to Bvm Address of the payee
 */
export type Payment = {
  amount: number,
  to: BvmAddr,
};

/**
 * Condition to release a payment
 * 
 * @typedef {SignatureCond|TimestampCond} BudgetCond
 */
export type BudgetCond = SignatureCond | TimestampCond;

/**
 *  Serialie a Payment into buffer to transport on the network.
 * 
 * @private
 */
function serializePayment(payment: Payment): Buffer {
  const toData = payment.to.converseToBuffer();
  const data = Buffer.alloc(8 + toData.length);
  data.writeUInt32LE(payment.amount, 0);
  toData.copy(data, 8);
  return data;
}

/**
 *  Serialize  a Datetime into buffer to transport on the network.
 * 
 * @private
 */
function serializeTime(when: Date): Buffer {
  const data = Buffer.alloc(8 + 20);
  data.writeUInt32LE(20, 0); // size of timestamp as u64

  function iso(date) {
    function pad(number) {
      if (number < 10) {
        return '0' + number;
      }
      return number;
    }

    return (
      date.getUTCFullYear() +
      '-' +
      pad(date.getUTCMonth() + 1) +
      '-' +
      pad(date.getUTCDate()) +
      'T' +
      pad(date.getUTCHours()) +
      ':' +
      pad(date.getUTCMinutes()) +
      ':' +
      pad(date.getUTCSeconds()) +
      'Z'
    );
  }
  data.write(iso(when), 8);
  return data;
}

/**
 * Serialize a BudgetCond into buffer to transport on the network.
 * 
 * @private
 */
function serializeCond(condition: BudgetCond) {
  switch (condition.type) {
    case 'timestamp': {
      const date = serializeTime(condition.when);
      const from = condition.from.converseToBuffer();

      const data = Buffer.alloc(4 + date.length + from.length);
      data.writeUInt32LE(0, 0); // Condition enum = Timestamp
      date.copy(data, 4);
      from.copy(data, 4 + date.length);
      return data;
    }
    case 'signature': {
      const from = condition.from.converseToBuffer();
      const data = Buffer.alloc(4 + from.length);
      data.writeUInt32LE(1, 0); // Condition enum = Signature
      from.copy(data, 4);
      return data;
    }
    default:
      throw new Error(`Unknown condition type: ${condition.type}`);
  }
}

/**
 * Factory class for transactions to interact with the Budget controller
 */
export class BudgetController {
  /**
   * Bvm Address that identifies the Budget controller
   */
  static get controllerId(): BvmAddr {
    return new BvmAddr('Budget1111111111111111111111111111111111111');
  }

  /**
   * The amount of space this controller requires
   */
  static get size(): number {
    return 128;
  }

  /**
   * Creates a timestamp condition
   */
  static datetimeCond(from: BvmAddr, when: Date): TimestampCond {
    return {
      type: 'timestamp',
      from,
      when,
    };
  }

  /**
   * Creates a signature condition
   */
  static signatureCond(from: BvmAddr): SignatureCond {
    return {
      type: 'signature',
      from,
    };
  }

  /**
   * Generates a transaction that transfers difs once any of the conditions are met
   */
  static pay(
    from: BvmAddr,
    controller: BvmAddr,
    to: BvmAddr,
    amount: number,
    ...conditions: Array<BudgetCond>
  ): Transaction {
    const data = Buffer.alloc(1024);
    let pos = 0;
    data.writeUInt32LE(0, pos); // NewBudget instruction
    pos += 4;

    switch (conditions.length) {
      case 0: {
        data.writeUInt32LE(0, pos); // BudgetExpr enum = Pay
        pos += 4;

        {
          const payment = serializePayment({amount, to});
          payment.copy(data, pos);
          pos += payment.length;
        }
        const trimmedData = data.slice(0, pos);

        const transaction = SystemController.createNewAccount(
          from,
          controller,
          amount,
          amount,
          trimmedData.length,
          this.controllerId,
        );

        return transaction.add({
          keys: [
            {pubkey: to, isSigner: false, isDebitable: false},
            {pubkey: controller, isSigner: false, isDebitable: true},
          ],
          controllerId: this.controllerId,
          data: trimmedData,
        });
      }
      case 1: {
        data.writeUInt32LE(1, pos); // BudgetExpr enum = After
        pos += 4;
        {
          const condition = conditions[0];

          const conditionData = serializeCond(condition);
          conditionData.copy(data, pos);
          pos += conditionData.length;

          data.writeUInt32LE(0, pos); // BudgetExpr enum = Pay
          pos += 4;

          const paymentData = serializePayment({amount, to});
          paymentData.copy(data, pos);
          pos += paymentData.length;
        }
        const trimmedData = data.slice(0, pos);

        const transaction = SystemController.createNewAccount(
          from,
          controller,
          amount,
          amount,
          trimmedData.length,
          this.controllerId,
        );

        return transaction.add({
          keys: [{pubkey: controller, isSigner: false, isDebitable: true}],
          controllerId: this.controllerId,
          data: trimmedData,
        });
      }

      case 2: {
        data.writeUInt32LE(2, pos); // BudgetExpr enum = Or
        pos += 4;

        for (let condition of conditions) {
          const conditionData = serializeCond(condition);
          conditionData.copy(data, pos);
          pos += conditionData.length;

          data.writeUInt32LE(0, pos); // BudgetExpr enum = Pay
          pos += 4;

          const paymentData = serializePayment({amount, to});
          paymentData.copy(data, pos);
          pos += paymentData.length;
        }
        const trimmedData = data.slice(0, pos);

        const transaction = SystemController.createNewAccount(
          from,
          controller,
          amount,
          amount,
          trimmedData.length,
          this.controllerId,
        );

        return transaction.add({
          keys: [{pubkey: controller, isSigner: false, isDebitable: true}],
          controllerId: this.controllerId,
          data: trimmedData,
        });
      }

      default:
        throw new Error(
          `A maximum of two conditions are support: ${
            conditions.length
          } provided`,
        );
    }
  }

  /**
   * Generates a transaction that transfers difs once both conditions are met
   */
  static payOnAll(
    from: BvmAddr,
    controller: BvmAddr,
    to: BvmAddr,
    amount: number,
    condition1: BudgetCond,
    condition2: BudgetCond,
  ): Transaction {
    const data = Buffer.alloc(1024);
    let pos = 0;
    data.writeUInt32LE(0, pos); // NewBudget instruction
    pos += 4;

    data.writeUInt32LE(3, pos); // BudgetExpr enum = And
    pos += 4;

    for (let condition of [condition1, condition2]) {
      const conditionData = serializeCond(condition);
      conditionData.copy(data, pos);
      pos += conditionData.length;
    }

    data.writeUInt32LE(0, pos); // BudgetExpr enum = Pay
    pos += 4;

    const paymentData = serializePayment({amount, to});
    paymentData.copy(data, pos);
    pos += paymentData.length;

    const trimmedData = data.slice(0, pos);

    const transaction = SystemController.createNewAccount(
      from,
      controller,
      amount,
      amount,
      trimmedData.length,
      this.controllerId,
    );

    return transaction.add({
      keys: [{pubkey: controller, isSigner: false, isDebitable: true}],
      controllerId: this.controllerId,
      data: trimmedData,
    });
  }

  /**
   * Generates a transaction that applies a timestamp, which could enable a
   * pending payment to proceed.
   */
  static sealWithDatetime(
    from: BvmAddr,
    controller: BvmAddr,
    to: BvmAddr,
    when: Date,
  ): Transaction {
    const whenData = serializeTime(when);
    const data = Buffer.alloc(4 + whenData.length);

    data.writeUInt32LE(1, 0); // ApplyTimestamp instruction
    whenData.copy(data, 4);

    return new Transaction().add({
      keys: [
        {pubkey: from, isSigner: true, isDebitable: true},
        {pubkey: controller, isSigner: false, isDebitable: true},
        {pubkey: to, isSigner: false, isDebitable: false},
      ],
      controllerId: this.controllerId,
      data,
    });
  }

  /**
   * Generates a transaction that applies a signature, which could enable a
   * pending payment to proceed.
   */
  static sealWithSignature(
    from: BvmAddr,
    controller: BvmAddr,
    to: BvmAddr,
  ): Transaction {
    const dataLayout = BufferLayout.struct([BufferLayout.u32('instruction')]);

    const data = Buffer.alloc(dataLayout.span);
    dataLayout.encode(
      {
        instruction: 2, // ApplySignature instruction
      },
      data,
    );

    return new Transaction().add({
      keys: [
        {pubkey: from, isSigner: true, isDebitable: true},
        {pubkey: controller, isSigner: false, isDebitable: true},
        {pubkey: to, isSigner: false, isDebitable: false},
      ],
      controllerId: this.controllerId,
      data,
    });
  }
}


function getPath(internal_path, external_path) {
  var bip_path = 0x8000002c;
  var coin_path = 0x800000c8;
  var account_path = 0x80000000;

  return bip_path + '/' + coin_path + '/' + account_path + '/' + internal_path + '/' + external_path;
}

function getPathFromAddress(wallet, address) {
  for (var idx in wallet.internal_addresses) {
      if (address === wallet.internal_addresses[idx].address) {
          return this.getPath(1, idx);
      }
  }

  for(idx in wallet.external_addresses) {
      if (address === wallet.external_addresses[idx].address) {
          return this.getPath(0, idx);
      }
  }

  return '';
}


var buffer = require('buffer');
var assert = require('assert');

// var js = require('./js');
// var $ = require('./preconditions');



function equals(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  var length = a.length;
  for (var i = 0; i < length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/**
  * Fill a buffer with a value.
  *
  * @param {Buffer} buffer
  * @param {number} value
  * @return {Buffer}
  */
// function fill(buffer, value) {
//   PreCondition.checkArgumentType(buffer, 'Buffer', 'buffer');
//   PreCondition.checkArgumentType(value, 'number', 'value');
//   var length = buffer.length;
//   for (var i = 0; i < length; i++) {
//     buffer[i] = value;
//   }
//   return buffer;
// }


const buffer_1 = require("buffer");
class BufferUtil {
    static fromHex(source) {
        const data = source.match(/.{1,2}/g).map(x => parseInt(x, 16));
        return new Uint8Array(data);
    }
    static fromBase64(source) {
        return Uint8Array.from(buffer_1.Buffer.from(source, 'base64'));
    }
    static fromString(source) {
        const buffer = new ArrayBuffer(source.length);
        const view = new DataView(buffer);
        for (let i = 0; i < source.length; i++) {
            view.setUint8(i, source.charCodeAt(i));
        }
        return new Uint8Array(buffer);
    }
    static toString(source) {
        const data = [];
        source.forEach(x => {
            data.push(String.fromCharCode(x));
        });
        return data.join('');
    }
    static toHex(sources) {
        const data = [];
        sources.forEach(x => {
            data.push(x.toString(16).padStart(2, '0'));
        });
        return data.join('');
    }
    static toBase64(sources) {
        return buffer_1.Buffer.from(sources).toString('base64');
    }
    static concat(a, b) {
        const c = new Uint8Array(a.length + b.length);
        c.set(a);
        c.set(b, a.length);
        return c;
    }
}


function binarySearch(sortedArray, item) {
  let lowIdx = 0;
  let highIdx = sortedArray.length - 1;
  while (lowIdx <= highIdx) {
      const midIdx = Math.floor((lowIdx + highIdx) / 2);
      if (sortedArray[midIdx] === item) {
          return midIdx;
      }
      else if (sortedArray[midIdx] < item) {
          lowIdx = midIdx + 1;
      }
      else {
          highIdx = midIdx - 1;
      }
  }
  return null;
}