//@flow

import {testnetDefaultChannel} from '../../package.json';


// defines P2PKH and P2SH address types for standard (prod) and testnet networks
var CURRENCIES = [{
    name: 'bitcoin',
    symbol: 'btc',
    addressTypes: {prod: ['00', '05'], testnet: ['6f', 'c4']}
},{
    name: 'bitcoincash',
    symbol: 'bch',
    addressTypes: {prod: ['00', '05'], testnet: ['6f', 'c4']}
},{
    name: 'litecoin',
    symbol: 'ltc',
    addressTypes: {prod: ['30', '05', '32'], testnet: ['6f', 'c4']}
},{
    name: 'peercoin',
    symbol: 'ppc',
    addressTypes: {prod: ['37', '75'], testnet: ['6f', 'c4']}
},{
    name: 'dogecoin',
    symbol: 'doge',
    addressTypes: {prod: ['1e', '16'], testnet: ['71', 'c4']}
},{
    name: 'beavercoin',
    symbol: 'bvc',
    addressTypes: {prod: ['19', '05'], testnet: ['6f', 'c4']}
},{
    name: 'freicoin',
    symbol: 'frc',
    addressTypes: {prod: ['00', '05'], testnet: ['6f', 'c4']}
},{
    name: 'protoshares',
    symbol: 'pts',
    addressTypes: {prod: ['38', '05'], testnet: ['6f', 'c4']}
},{
    name: 'megacoin',
    symbol: 'mec',
    addressTypes: {prod: ['32', '05'], testnet: ['6f', 'c4']}
},{
    name: 'primecoin',
    symbol: 'xpm',
    addressTypes: {prod: ['17', '53'], testnet: ['6f', 'c4']}
},{
    name: 'auroracoin',
    symbol: 'aur',
    addressTypes: {prod: ['17', '05'], testnet: ['6f', 'c4']}
},{
    name: 'namecoin',
    symbol: 'nmc',
    addressTypes: {prod: ['34'], testnet: []}
},{
    name: 'biocoin',
    symbol: 'bio',
    addressTypes: {prod: ['19', '14'], testnet: ['6f', 'c4']}
},{
    name: 'garlicoin',
    symbol: 'grlc',
    addressTypes: {prod: ['26', '05'], testnet: ['6f', 'c4']}
},{
    name: 'vertcoin',
    symbol: 'vtc',
    addressTypes: {prod: ['0x', '47'], testnet: ['6f', 'c4']}
},{
    name: 'bitcoingold',
    symbol: 'btg',
    addressTypes: {prod: ['26', '17'], testnet: ['6f', 'c4']}
},{
    name: 'komodo',
    symbol: 'kmd',
    addressTypes: {prod: ['3c', '55'], testnet: ['0','5']}
},{
    name: 'bitcoinz',
    symbol: 'btcz',
    expectedLength: 26,
    addressTypes: {prod: ['1cb8','1cbd'], testnet: ['1d25', '1cba']}
},{
    name: 'bitcoinprivate',
    symbol: 'btcp',
    expectedLength: 26,
    addressTypes: {prod: ['1325','13af'], testnet: ['1957', '19e0']}
},{
    name: 'hush',
    symbol: 'hush',
    expectedLength: 26,
    addressTypes: {prod: ['1cb8','1cbd'], testnet: ['1d25', '1cba']}
},{
    name: 'snowgem',
    symbol: 'sng',
    expectedLength: 26,
    addressTypes: {prod: ['1c28','1c2d'], testnet: ['1d25', '1cba']}
},{
    name: 'zcash',
    symbol: 'zec',
    expectedLength: 26,
    addressTypes: {prod: ['1cb8','1cbd'], testnet: ['1d25', '1cba']}
},{
    name: 'zclassic',
    symbol: 'zcl',
    expectedLength: 26,
    addressTypes: {prod: ['1cb8','1cbd'], testnet: ['1d25', '1cba']}
},{
    name: 'zencash',
    symbol: 'zen',
    expectedLength: 26,
    addressTypes: {prod: ['2089','2096'], testnet: ['2092','2098']}
},{
    name: 'votecoin',
    symbol: 'vot',
    expectedLength: 26,
    addressTypes: {prod: ['1cb8','1cbd'], testnet: ['1d25', '1cba']}
},{
    name: 'decred',
    symbol: 'dcr',
    addressTypes: {prod: ['073f', '071a'], testnet: ['0f21', '0efc']},
    hashFunction: 'blake256',
    expectedLength: 26
},{
    name: 'cardano',
    symbol: 'ada',
    addressTypes: {prod: [], testnet: []},
    hashFunction: 'blake224',
},{
    name: 'iota',
    symbol: 'iota',
    addressTypes: {prod: [], testnet: []},
},{
    name: 'nano',
    symbol: 'nano',
    addressTypes: {prod: [], testnet: []},
},{
    name: 'railblocks',
    symbol: 'xrb',
    addressTypes: {prod: [], testnet: []},
},{
    name: 'monero',
    symbol: 'xmr',
    addressTypes: {prod: [], testnet: []},
},{
    name: 'nem',
    symbol: 'nem',
    addressTypes: {prod: [], testnet: []},
},{
    name: 'digibyte',
    symbol: 'dgb',
    addressTypes: {prod: ['1e'], testnet: []},
},{
    name: 'ethereum',
    symbol: 'eth',
    validator: 'ETHValidator',
},{
    name: 'etherzero',
    symbol: 'etz',
    validator: 'ETHValidator',
},{
    name: 'ethereumclassic',
    symbol: 'etc',
    validator: 'ETHValidator',
},{
    name: 'callisto',
    symbol: 'clo',
    validator: 'ETHValidator',
},{
    name: 'icon',
    symbol: 'icon',
    validator: 'ETHValidator',
},{
    name: 'eos',
    symbol: 'eos',
    validator: 'ETHValidator',
},{
    name: 'qash',
    symbol: 'qash',
    validator: 'ETHValidator',
},{
    name: 'republic protocol',
    symbol: 'ren',
    validator: 'ETHValidator',
},{
    name: 'tronix',
    symbol: 'trx',
    validator: 'ETHValidator',
},{
    name: 'vechain',
    symbol: 'vechain',
    validator: 'ETHValidator',
},{
    name: 'ripple',
    symbol: 'xrp',
    validator: 'XRPValidator',
},{
    name: 'stellar lumens',
    symbol: 'xlm',
    addressTypes: {prod: ['1e'], testnet: []},
},{
    name: 'dash',
    symbol: 'dash',
    addressTypes: {prod: ['4c', '10'], testnet: ['8c', '13']}
},{
    name: 'neo',
    symbol: 'neo',
    addressTypes: {prod: ['17'], testnet: []}
},{
    name: 'neogas',
    symbol: 'gas',
    addressTypes: {prod: ['17'], testnet: []}
},{
    name: 'qtum',
    symbol: 'qtum',
    addressTypes: {prod: ['3a', '32'], testnet: ['6f', 'c4']}
}];

/**
 * @private
 */
const endpoint = {
  edge: 'https://api.edge.testnet.bitconch.com',
  beta: 'https://api.beta.testnet.bitconch.com',
  stable: 'https://api.testnet.bitconch.com',
};

/**
 * Retrieves the RPC address for the specified testnet release
 * channel
 */
export function testnetChannelEndpoint(channel?: string): string {
  if (!channel) {
    return endpoint[testnetDefaultChannel];
  }

  if (endpoint[channel]) {
    return endpoint[channel];
  }
  throw new Error(`Unknown channel: ${channel}`);
}


var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
var ALPHABET_MAP = {};
for (var i = 0; i < ALPHABET.length; ++i) {
    ALPHABET_MAP[ALPHABET.charAt(i)] = i;
}
var BASE = ALPHABET.length;

function decode(string) {
  if (string.length === 0) return [];

  var i, j, bytes = [0];
  for (i = 0; i < string.length; ++i) {
      var c = string[i];
      if (!(c in ALPHABET_MAP)) throw new Error('Non-base58 character');

      for (j = 0; j < bytes.length; ++j) bytes[j] *= BASE
      bytes[0] += ALPHABET_MAP[c];

      var carry = 0;
      for (j = 0; j < bytes.length; ++j) {
          bytes[j] += carry;
          carry = bytes[j] >> 8;
          bytes[j] &= 0xff
      }

      while (carry) {
          bytes.push(carry & 0xff);
          carry >>= 8;
      }
  }
  // deal with leading zeros
  for (i = 0; string[i] === '1' && i < string.length - 1; ++i){
      bytes.push(0);
  }

  return bytes.reverse();
}
