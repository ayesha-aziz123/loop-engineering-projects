const test = require('node:test');
const assert = require('node:assert/strict');
const { getItemAt, findItemById, totalQuantity } = require('../src/inventory');

const items = [
  { id: 'a1', name: 'Widget', qty: 3 },
  { id: 'b2', name: 'Gadget', qty: 5 },
  { id: 'c3', name: 'Gizmo', qty: 2 },
];

test('getItemAt returns the item at a valid index', () => {
  assert.deepEqual(getItemAt(items, 0), items[0]);
  assert.deepEqual(getItemAt(items, 2), items[2]);
});

test('getItemAt returns undefined for an out-of-bounds index (right edge)', () => {
  assert.equal(getItemAt(items, items.length), undefined);
  assert.equal(getItemAt(items, items.length + 5), undefined);
});

test('getItemAt returns undefined for a negative index', () => {
  assert.equal(getItemAt(items, -1), undefined);
});

test('findItemById finds an existing item', () => {
  assert.deepEqual(findItemById(items, 'b2'), items[1]);
});

test('findItemById returns null for a missing id', () => {
  assert.equal(findItemById(items, 'nope'), null);
});

test('findItemById returns null (not a throw) when items is null/undefined', () => {
  assert.equal(findItemById(null, 'a1'), null);
  assert.equal(findItemById(undefined, 'a1'), null);
});

test('totalQuantity sums qty across all items', () => {
  assert.equal(totalQuantity(items), 10);
});

test('totalQuantity treats missing qty as 0', () => {
  assert.equal(totalQuantity([{ id: 'x' }, { id: 'y', qty: 4 }]), 4);
});

test('totalQuantity returns 0 for null/undefined input', () => {
  assert.equal(totalQuantity(null), 0);
  assert.equal(totalQuantity(undefined), 0);
});
