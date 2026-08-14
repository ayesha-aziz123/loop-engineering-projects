'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { dedupeSorted } = require('../src/dedupeSorted');

test('removes consecutive duplicates from a longer array', () => {
  assert.deepEqual(dedupeSorted([1, 1, 2, 3, 3, 3, 4]), [1, 2, 3, 4]);
});

test('keeps a single-element array intact', () => {
  assert.deepEqual(dedupeSorted([5]), [5]);
});

test('keeps an already-unique array intact', () => {
  assert.deepEqual(dedupeSorted([1, 2, 3]), [1, 2, 3]);
});

test('returns an empty array for empty input', () => {
  assert.deepEqual(dedupeSorted([]), []);
});
