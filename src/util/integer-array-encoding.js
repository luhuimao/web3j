// @flow

// var util = require('util');
// var _ = require('underscore');
// var clc = require('cli-color');
// var moment = require('moment');
// import  RpcClient from './rpc-client' ;
// var logger = require('bunyan').createLogger({
//     name: 'RpcClient',
//     level: 'trace'
// });

// function inspect(obj) {
//     return obj ? util.inspect(obj, {
//         depth: null
//     }) : '';
// }

// function printResult(error, result) {
//     console.log(clc.red(inspect(error)));
//     console.log(clc.cyan(inspect(result)));
// }

// function printJsonResult(error, result) {
//     console.log(clc.red(inspect(error)));

//     var output = result;
//     try {
//         output = JSON.parse(result);
//     } catch (err) {
//         // use default
//     }

//     console.log(clc.cyan(inspect(output)));
// }

// var context = 'OR CPRS GUI CHART';

// var configuration = {
//     context: 'HMP UI CONTEXT',
//     host: 'IP        ',
//     port: 2222,
//     accessCode: 'REDACTED',
//     verifyCode: 'REDACTED',
//     localIP: 'IP      ',
//     localAddress: 'localhost'
// };

Object.defineProperty(exports, "__esModule", { value: true });
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
exports.BufferUtil = BufferUtil;

/*
decode an array of number and return it's length.
 */
export function getDecodedArrayLength(bytes: Array<number>): number {
  let len_to_return = 0;
  let size = 0;
  for (;;) {
    let elem_of_array = bytes.shift();
    len_to_return |= (elem_of_array & 0x7f) << (size * 7);
    size += 1;
    if ((elem_of_array & 0x80) === 0) {
      break;
    }
  }
  return len_to_return;
}
/*
encode an array of number. 
*/
export function encodeArrayWithInteger(bytes: Array<number>, len: number) {
  let new_len = len;
  for (;;) {
    let new_elem = new_len & 0x7f;
    new_len >>= 7;
    if (new_len == 0) {
      bytes.push(new_elem);
      break;
    } else {
      new_elem |= 0x80;
      bytes.push(new_elem);
    }
  }
}


// Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionUtil = {
    binarySearch(sortedArray, item) {
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
    },
};
exports.default = exports.CollectionUtil;


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
    read64() {
        const firstPart = this.read32();
        const secondPart = this.read32();
        const combined = this.littleEndian
            ? secondPart.toString(16) + firstPart.toString(16).padStart(8, '0')
            : firstPart.toString(16) + secondPart.toString(16).padStart(8, '0');
        return new bignumber_js_1.default(`0x${combined}`, 16);
    }
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