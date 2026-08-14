'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { average } = require('../src/average');

test('averages a simple set of numbers', () => {
  assert.equal(average([2, 4, 6]), 4);
});

test('averages a single-element array', () => {
  assert.equal(average([10]), 10);
});

test('averages an even-length array to a fractional mean', () => {
  assert.equal(average([1, 2, 3, 4]), 2.5);
});

test('averages a uniform array to the repeated value', () => {
  assert.equal(average([5, 5, 5, 5, 5]), 5);
});
