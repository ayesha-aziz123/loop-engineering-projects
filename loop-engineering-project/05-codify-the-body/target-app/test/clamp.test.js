'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { clampToRange } = require('../src/clamp');

test('returns the value unchanged when it is inside the range', () => {
  assert.equal(clampToRange(5, 0, 10), 5);
});

test('clamps a value below the minimum up to the minimum', () => {
  assert.equal(clampToRange(-5, 0, 10), 0);
});

test('clamps a value above the maximum down to the maximum', () => {
  assert.equal(clampToRange(15, 0, 10), 10);
});

test('returns the minimum when the value equals the minimum boundary', () => {
  assert.equal(clampToRange(0, 0, 10), 0);
});

test('returns the maximum when the value equals the maximum boundary', () => {
  assert.equal(clampToRange(10, 0, 10), 10);
});
