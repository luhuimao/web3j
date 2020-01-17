// @flow
import {BvmAddr} from '../src/bvm-addr';

test('invalid', () => {
  expect(() => {
    new BvmAddr([
      3,
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
    ]);
  }).toThrow();

  expect(() => {
    new BvmAddr(
      '0x300000000000000000000000000000000000000000000000000000000000000000000',
    );
  }).toThrow();

  expect(() => {
    new BvmAddr(
      '135693854574979916511997248057056142015550763280047535983739356259273198796800000',
    );
  }).toThrow();
});

test('equals', () => {
  const arrayKey = new BvmAddr([
    3,
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
  ]);
  const hexKey = new BvmAddr(
    '0x300000000000000000000000000000000000000000000000000000000000000',
  );
  const base56Key = new BvmAddr(
    'CiDwVBFgWV9E5MvXWoLgnEgn2hK7rJikbvfWavzAQz3',
  );

  expect(arrayKey.checkIfEquals(hexKey)).toBe(true);
  expect(arrayKey.checkIfEquals(base56Key)).toBe(true);
});

test('isBvmAddr', () => {
  const key = new BvmAddr(
    '0x100000000000000000000000000000000000000000000000000000000000000',
  );
  expect(BvmAddr.isBvmAddr(key)).toBe(true);
  expect(BvmAddr.isBvmAddr({})).toBe(false);
});

test('toBase58', () => {
  const key = new BvmAddr(
    '0x300000000000000000000000000000000000000000000000000000000000000',
  );
  expect(key.converseToBase58()).toBe('CiDwVBFgWV9E5MvXWoLgnEgn2hK7rJikbvfWavzAQz3');
  expect(key.converseToString()).toBe('CiDwVBFgWV9E5MvXWoLgnEgn2hK7rJikbvfWavzAQz3');

  const key2 = new BvmAddr('1111111111111111111111111111BukQL');
  expect(key2.converseToBase58()).toBe('1111111111111111111111111111BukQL');
  expect(key2.converseToString()).toBe('1111111111111111111111111111BukQL');

  const key3 = new BvmAddr('11111111111111111111111111111111');
  expect(key3.converseToBase58()).toBe('11111111111111111111111111111111');

  const key4 = new BvmAddr([
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
  ]);
  expect(key4.converseToBase58()).toBe('11111111111111111111111111111111');
});

test('toBuffer', () => {
  const key = new BvmAddr(
    '0x300000000000000000000000000000000000000000000000000000000000000',
  );
  expect(key.converseToBuffer()).toHaveLength(32);
  expect(key.converseToBase58()).toBe('CiDwVBFgWV9E5MvXWoLgnEgn2hK7rJikbvfWavzAQz3');

  const key2 = new BvmAddr(
    '0x000000000000000000000000000000000000000000000000000000000000000',
  );
  expect(key2.converseToBuffer()).toHaveLength(32);
  expect(key2.converseToBase58()).toBe('11111111111111111111111111111111');
});

test('equals (II)', () => {
  const key1 = new BvmAddr([
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
    1,
  ]);
  const key2 = new BvmAddr(key1.converseToBuffer());

  expect(key1.checkIfEquals(key2)).toBe(true);
});
