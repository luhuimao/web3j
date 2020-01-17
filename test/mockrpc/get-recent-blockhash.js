// @flow

import {BvmAcct} from '../../src';
import {url} from '../url';
import {mockRpc} from '../__mocks__/node-fetch';

export function mockGetRecentBlockhash() {
  const recentPackagehash = new BvmAcct();

  mockRpc.push([
    url,
    {
      // method: 'getLatestBlockhash',
      method: 'getLatestTransactionSeal',
      params: [],
    },
    {
      error: null,
      result: [
        recentPackagehash.pubKey.converseToBase58(),
        {
          difsPerSignature: 42,
        },
      ],
    },
  ]);
}
