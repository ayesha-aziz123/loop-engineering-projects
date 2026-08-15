'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateOrderTotal } = require('../src/pricing');

test('rounds a repeating-decimal price times quantity to the cent', () => {
  const total = calculateOrderTotal([{ price: 0.1, quantity: 3 }], 0);
  assert.equal(total, 0.3);
});

test('rounds a subtotal-plus-tax calculation to the cent', () => {
  const total = calculateOrderTotal([{ price: 19.99, quantity: 1 }], 0.0825);
  assert.equal(total, 21.64);
});

test('rounds correctly when summing multiple decimal-prone prices', () => {
  const total = calculateOrderTotal(
    [
      { price: 0.29, quantity: 1 },
      { price: 0.29, quantity: 1 },
      { price: 0.29, quantity: 1 },
    ],
    0,
  );
  assert.equal(total, 0.87);
});

test('does not perturb a total that already lands on a clean cent value', () => {
  const total = calculateOrderTotal([{ price: 2.15, quantity: 4 }], 0.05);
  assert.equal(total, 9.03);
});
