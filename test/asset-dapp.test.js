// @flow

import {Connection, BvmAddr, Asset, AssetCount} from '../src';
import {SYSTEM_TOKEN_CONTROLLER_ID} from '../src/asset-dapp';
import {mockRpc, mockRpcEnabled} from './__mocks__/node-fetch';
import {url} from './url';
import {newAccountWithDif} from './new-bvm-acct-with-dif';
import {mockGetRecentBlockhash} from './mockrpc/get-recent-blockhash';
import {dormant} from '../src/dormant';

// The default of 5 seconds is too slow for live testing sometimes
jest.setTimeout(60000);

function mockGetSignatureStatus(result: Object = {Ok: null}) {
  mockRpc.push([
    url,
    {
      method: 'getSignatureState',
    },
    {
      error: null,
      result,
    },
  ]);
}
function mockSendTransaction() {
  mockRpc.push([
    url,
    {
      method: 'sendTxn',
    },
    {
      error: null,
      result:
        '3WE5w4B7v59x6qjyC4FbG2FEKYKQfvsJwqSxNVmtMjT8TQ31hsZieDHcSgqzxiAoTL56n2w5TncjqEKjLhtF4Vk',
    },
  ]);
}

// A asset created by the first test and used by all subsequent tests
let testAsset: Asset;

// Initial owner of the asset supply
let initialOwner;
let initialOwnerTokenAccount: BvmAddr;

test('create new asset', async () => {
  const connection = new Connection(url);
  connection._disableBlockhashCaching = mockRpcEnabled;

  initialOwner = await newAccountWithDif(connection, 1024);

  {
    // mock SystemController.createNewAccount transaction for Asset.createNewAsset()
    mockGetRecentBlockhash();
    mockSendTransaction();
    mockGetSignatureStatus();

    // mock Token.createNewAccount() transaction
    mockSendTransaction();
    mockGetSignatureStatus(null);
    mockGetSignatureStatus();

    // mock SystemController.createNewAccount transaction for Asset.createNewAsset()
    mockSendTransaction();
    mockGetSignatureStatus();

    // mock Asset.createNewAsset() transaction
    mockSendTransaction();
    mockGetSignatureStatus(null);
    mockGetSignatureStatus();
  }

  [testAsset, initialOwnerTokenAccount] = await Asset.createNewAsset(
    connection,
    initialOwner,
    new AssetCount(10000),
    'Test token',
    'TEST',
    2,
  );

  {
    // mock Asset.fetchAssetDetail()'s fetchAccountDetail
    mockRpc.push([
      url,
      {
        method: 'getAccountInfo',
        params: [testAsset.assetId.converseToBase58()],
      },
      {
        error: null,
        result: {
          owner: [...SYSTEM_TOKEN_CONTROLLER_ID.converseToBuffer()],
          difs: 1,
          reputations: 1,
          data: [
            1,
            16,
            39,
            0,
            0,
            0,
            0,
            0,
            0,
            2,
            10,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            84,
            101,
            115,
            116,
            32,
            116,
            111,
            107,
            101,
            110,
            4,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            84,
            69,
            83,
            84,
          ],
          executable: false,
        },
      },
    ]);
  }

  const fetchTokenDetail = await testAsset.fetchAssetDetail();

  expect(fetchTokenDetail.totalSupply.toNumber()).toBe(10000);
  expect(fetchTokenDetail.decimalsPosition).toBe(2);
  expect(fetchTokenDetail.name).toBe('Test token');
  expect(fetchTokenDetail.symbol).toBe('TEST');

  {
    // mock Token.fetchAccountDetail()'s fetchAccountDetail
    mockRpc.push([
      url,
      {
        method: 'getAccountInfo',
        params: [initialOwnerTokenAccount.converseToBase58()],
      },
      {
        error: null,
        result: {
          owner: [...SYSTEM_TOKEN_CONTROLLER_ID.converseToBuffer()],
          difs: 1,
          reputations: 1,
          data: [
            2,
            ...testAsset.assetId.converseToBuffer(),
            ...initialOwner.pubKey.converseToBuffer(),
            16,
            39,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
          ],
          executable: false,
        },
      },
    ]);
  }

  const fetchAccountDetail = await testAsset.fetchAccountDetail(initialOwnerTokenAccount);

  expect(fetchAccountDetail.publickeyOfAsset.checkIfEquals(testAsset.assetId)).toBe(true);
  expect(fetchAccountDetail.publickeyOfOwner.checkIfEquals(initialOwner.pubKey)).toBe(true);
  expect(fetchAccountDetail.amountOfAsset.toNumber()).toBe(10000);
  expect(fetchAccountDetail.publickeyOfSourceAccount).toBe(null);
  expect(fetchAccountDetail.originalAmountOfAsset.toNumber()).toBe(0);
});

test('create new asset account', async () => {
  const connection = new Connection(url);
  connection._disableBlockhashCaching = mockRpcEnabled;
  const destOwner = await newAccountWithDif(connection);

  {
    // mock SystemController.createNewAccount transaction for Token.createNewAccount()
    mockSendTransaction();
    mockGetSignatureStatus();

    // mock Token.createNewAccount() transaction
    mockSendTransaction();
    mockGetSignatureStatus();
  }

  const dest = await testAsset.createNewAssetAccount(destOwner);
  {
    // mock Token.fetchAccountDetail()'s fetchAccountDetail
    mockRpc.push([
      url,
      {
        method: 'getAccountInfo',
        params: [dest.converseToBase58()],
      },
      {
        error: null,
        result: {
          owner: [...SYSTEM_TOKEN_CONTROLLER_ID.converseToBuffer()],
          difs: 1,
          reputations: 1,
          data: [
            2,
            ...testAsset.assetId.converseToBuffer(),
            ...destOwner.pubKey.converseToBuffer(),
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
          ],
          executable: false,
        },
      },
    ]);
  }

  const fetchAccountDetail = await testAsset.fetchAccountDetail(dest);

  expect(fetchAccountDetail.publickeyOfAsset.checkIfEquals(testAsset.assetId)).toBe(true);
  expect(fetchAccountDetail.publickeyOfOwner.checkIfEquals(destOwner.pubKey)).toBe(true);
  expect(fetchAccountDetail.amountOfAsset.toNumber()).toBe(0);
  expect(fetchAccountDetail.publickeyOfSourceAccount).toBe(null);
});

test('transfer', async () => {
  const connection = new Connection(url);
  connection._disableBlockhashCaching = mockRpcEnabled;
  const destOwner = await newAccountWithDif(connection);

  {
    // mock SystemController.createNewAccount transaction for Token.createNewAccount()
    mockSendTransaction();
    mockGetSignatureStatus();

    // mock Token.createNewAccount() transaction
    mockSendTransaction();
    mockGetSignatureStatus();
  }

  const dest = await testAsset.createNewAssetAccount(destOwner);

  {
    // mock Token.transferAsset()'s fetchAccountDetail
    mockRpc.push([
      url,
      {
        method: 'getAccountInfo',
        params: [initialOwnerTokenAccount.converseToBase58()],
      },
      {
        error: null,
        result: {
          owner: [...SYSTEM_TOKEN_CONTROLLER_ID.converseToBuffer()],
          difs: 1,
          reputations: 1,
          data: [
            2,
            ...testAsset.assetId.converseToBuffer(),
            ...initialOwner.pubKey.converseToBuffer(),
            123,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
          ],
          executable: false,
        },
      },
    ]);

    // mock Token.transferAsset() transaction
    mockSendTransaction();
    mockGetSignatureStatus();
  }

  await testAsset.transferAsset(initialOwner, initialOwnerTokenAccount, dest, 123);

  {
    // mock Token.fetchAccountDetail()'s fetchAccountDetail
    mockRpc.push([
      url,
      {
        method: 'getAccountInfo',
        params: [dest.converseToBase58()],
      },
      {
        error: null,
        result: {
          owner: [...SYSTEM_TOKEN_CONTROLLER_ID.converseToBuffer()],
          difs: 1,
          reputations: 1,
          data: [
            2,
            ...testAsset.assetId.converseToBuffer(),
            ...dest.converseToBuffer(),
            123,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
          ],
          executable: false,
        },
      },
    ]);
  }

  await dormant(500);

  const destAccountInfo = await testAsset.fetchAccountDetail(dest);
  expect(destAccountInfo.amountOfAsset.toNumber()).toBe(123);
});

test('approve/revoke', async () => {
  const connection = new Connection(url);
  connection._disableBlockhashCaching = mockRpcEnabled;
  const delegateOwner = await newAccountWithDif(connection);

  {
    // mock SystemController.createNewAccount transaction for Token.createNewAccount()
    mockSendTransaction();
    mockGetSignatureStatus();

    // mock Token.createNewAccount() transaction
    mockSendTransaction();
    mockGetSignatureStatus();
  }
  const delegate = await testAsset.createNewAssetAccount(
    delegateOwner,
    initialOwnerTokenAccount,
  );

  {
    // mock Token.authorize() transaction
    mockSendTransaction();
    mockGetSignatureStatus();
  }

  await testAsset.authorize(
    initialOwner,
    initialOwnerTokenAccount,
    delegate,
    456,
  );

  {
    // mock Token.fetchAccountDetail()'s fetchAccountDetail
    mockRpc.push([
      url,
      {
        method: 'getAccountInfo',
        params: [delegate.converseToBase58()],
      },
      {
        error: null,
        result: {
          owner: [...SYSTEM_TOKEN_CONTROLLER_ID.converseToBuffer()],
          difs: 1,
          reputations: 1,
          data: [
            2,
            ...testAsset.assetId.converseToBuffer(),
            ...delegate.converseToBuffer(),
            200,
            1,
            0,
            0,
            0,
            0,
            0,
            0,
            1,
            ...initialOwnerTokenAccount.converseToBuffer(),
            200,
            1,
            0,
            0,
            0,
            0,
            0,
            0,
          ],
          executable: false,
        },
      },
    ]);
  }

  let delegateAccountInfo = await testAsset.fetchAccountDetail(delegate);

  expect(delegateAccountInfo.amountOfAsset.toNumber()).toBe(456);
  expect(delegateAccountInfo.originalAmountOfAsset.toNumber()).toBe(456);
  if (delegateAccountInfo.publickeyOfSourceAccount === null) {
    throw new Error('source should not be null');
  } else {
    expect(delegateAccountInfo.publickeyOfSourceAccount.checkIfEquals(initialOwnerTokenAccount)).toBe(
      true,
    );
  }

  {
    // mock Token.unauthorize() transaction
    mockSendTransaction();
    mockGetSignatureStatus();
  }

  await testAsset.unauthorize(initialOwner, initialOwnerTokenAccount, delegate);

  {
    // mock Token.fetchAccountDetail()'s fetchAccountDetail
    mockRpc.push([
      url,
      {
        method: 'getAccountInfo',
        params: [delegate.converseToBase58()],
      },
      {
        error: null,
        result: {
          owner: [...SYSTEM_TOKEN_CONTROLLER_ID.converseToBuffer()],
          difs: 1,
          reputations: 1,
          data: [
            2,
            ...testAsset.assetId.converseToBuffer(),
            ...delegate.converseToBuffer(),
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            1,
            ...initialOwnerTokenAccount.converseToBuffer(),
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
          ],
          executable: false,
        },
      },
    ]);
  }

  delegateAccountInfo = await testAsset.fetchAccountDetail(delegate);
  expect(delegateAccountInfo.amountOfAsset.toNumber()).toBe(0);
  expect(delegateAccountInfo.originalAmountOfAsset.toNumber()).toBe(0);
  if (delegateAccountInfo.publickeyOfSourceAccount === null) {
    throw new Error('source should not be null');
  } else {
    expect(delegateAccountInfo.publickeyOfSourceAccount.checkIfEquals(initialOwnerTokenAccount)).toBe(
      true,
    );
  }
});

test('invalid approve', async () => {
  if (mockRpcEnabled) {
    console.log('non-live test skipped');
    return;
  }

  const connection = new Connection(url);
  const owner = await newAccountWithDif(connection);

  const account1 = await testAsset.createNewAssetAccount(owner);
  const account1Delegate = await testAsset.createNewAssetAccount(owner, account1);
  const account2 = await testAsset.createNewAssetAccount(owner);

  // account2 is not a delegate account of account1
  await expect(
    testAsset.authorize(owner, account1, account2, 123),
  ).rejects.toThrow();

  // account1Delegate is not a delegate account of account2
  await expect(
    testAsset.authorize(owner, account2, account1Delegate, 123),
  ).rejects.toThrow();
});

test('fail on authorize overspend', async () => {
  if (mockRpcEnabled) {
    console.log('non-live test skipped');
    return;
  }

  const connection = new Connection(url);
  const owner = await newAccountWithDif(connection);

  const account1 = await testAsset.createNewAssetAccount(owner);
  const account1Delegate = await testAsset.createNewAssetAccount(owner, account1);
  const account2 = await testAsset.createNewAssetAccount(owner);

  await testAsset.transferAsset(
    initialOwner,
    initialOwnerTokenAccount,
    account1,
    10,
  );

  await testAsset.authorize(owner, account1, account1Delegate, 2);

  let delegateAccountInfo = await testAsset.fetchAccountDetail(account1Delegate);
  expect(delegateAccountInfo.amountOfAsset.toNumber()).toBe(2);
  expect(delegateAccountInfo.originalAmountOfAsset.toNumber()).toBe(2);

  await testAsset.transferAsset(owner, account1Delegate, account2, 1);

  delegateAccountInfo = await testAsset.fetchAccountDetail(account1Delegate);
  expect(delegateAccountInfo.amountOfAsset.toNumber()).toBe(1);
  expect(delegateAccountInfo.originalAmountOfAsset.toNumber()).toBe(2);

  await testAsset.transferAsset(owner, account1Delegate, account2, 1);

  delegateAccountInfo = await testAsset.fetchAccountDetail(account1Delegate);
  expect(delegateAccountInfo.amountOfAsset.toNumber()).toBe(0);
  expect(delegateAccountInfo.originalAmountOfAsset.toNumber()).toBe(2);

  await expect(
    testAsset.transferAsset(owner, account1Delegate, account2, 1),
  ).rejects.toThrow();
});

test('set owner', async () => {
  if (mockRpcEnabled) {
    console.log('non-live test skipped');
    return;
  }

  const connection = new Connection(url);
  const owner = await newAccountWithDif(connection);
  const newOwner = await newAccountWithDif(connection);

  const account = await testAsset.createNewAssetAccount(owner);

  await testAsset.setNewOwnerToAssetAccount(owner, account, newOwner.pubKey);
  await expect(
    testAsset.setNewOwnerToAssetAccount(owner, account, newOwner.pubKey),
  ).rejects.toThrow();

  await testAsset.setNewOwnerToAssetAccount(newOwner, account, owner.pubKey);
});
