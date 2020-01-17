// @flow

import {BvmAcct, BudgetController, SystemController} from '../src';

test('createNewAccount', () => {
  const from = new BvmAcct();
  const createNewAccount = new BvmAcct();
  let transaction;

  transaction = SystemController.createNewAccount(
    from.pubKey,
    createNewAccount.pubKey,
    123,
    0,
    BudgetController.space,
    BudgetController.controllerId,
  );

  expect(transaction.keys).toHaveLength(2);
  expect(transaction.controllerId).toEqual(SystemController.controllerId);
  // TODO: Validate transaction contents more
});

test('transfer', () => {
  const from = new BvmAcct();
  const to = new BvmAcct();
  let transaction;

  transaction = SystemController.transfer(from.pubKey, to.pubKey, 123);

  expect(transaction.keys).toHaveLength(2);
  expect(transaction.controllerId).toEqual(SystemController.controllerId);
  // TODO: Validate transaction contents more
});

test('transferReputation', () => {
  const from = new BvmAcct();
  const to = new BvmAcct();
  let transaction;

  transaction = SystemController.transferReputation(from.pubKey, to.pubKey, 123);

  expect(transaction.keys).toHaveLength(2);
  expect(transaction.controllerId).toEqual(SystemController.controllerId);
  // TODO: Validate transaction contents more
});

test('assign', () => {
  const from = new BvmAcct();
  const to = new BvmAcct();
  let transaction;

  transaction = SystemController.assign(from.pubKey, to.pubKey);

  expect(transaction.keys).toHaveLength(1);
  expect(transaction.controllerId).toEqual(SystemController.controllerId);
  // TODO: Validate transaction contents more
});
