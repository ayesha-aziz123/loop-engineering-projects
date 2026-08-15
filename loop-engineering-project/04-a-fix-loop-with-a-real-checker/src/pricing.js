'use strict';

/**
 * Calculate the total for an order: sum(price * quantity) plus tax.
 *
 * BUG: the result is returned as a raw floating-point value. Because binary
 * floating point can't represent most decimal fractions exactly, this
 * produces totals like 20.099999999999998 instead of 20.1 for ordinary
 * money inputs (e.g. an item priced at $0.10).
 */
function calculateOrderTotal(items, taxRate) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return subtotal + subtotal * taxRate;
}

module.exports = { calculateOrderTotal };
