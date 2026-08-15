/**
 * Tiny inventory utility module.
 *
 * Deliberately small: this app exists only to give a pull request something
 * real to change. The baseline implementation below is correct; Project 06's
 * demo PR will introduce one intentional, realistic bug into one of these
 * functions on a branch, never on main.
 */

/**
 * Returns the item at the given index, or undefined if the index is out of
 * bounds. Correct bounds check on both ends (this is the classic spot for an
 * off-by-one bug: using `<=` instead of `<` against items.length).
 */
function getItemAt(items, index) {
  if (index < 0 || index >= items.length) {
    return undefined;
  }
  return items[index];
}

/**
 * Finds an item by id in a list of { id, name, qty } records. Returns null
 * if not found. Correct null/undefined guard on the input list (this is the
 * classic spot for a null-check bug: skipping the guard and letting a
 * missing/undefined `items` argument throw instead of returning null).
 */
function findItemById(items, id) {
  if (!items) {
    return null;
  }
  for (const item of items) {
    if (item.id === id) {
      return item;
    }
  }
  return null;
}

/**
 * Sums the `qty` field across all items. Treats missing/undefined `qty` as
 * 0 rather than throwing or propagating NaN.
 */
function totalQuantity(items) {
  if (!items) {
    return 0;
  }
  let total = 0;
  for (const item of items) {
    total += item.qty || 0;
  }
  return total;
}

module.exports = { getItemAt, findItemById, totalQuantity };
