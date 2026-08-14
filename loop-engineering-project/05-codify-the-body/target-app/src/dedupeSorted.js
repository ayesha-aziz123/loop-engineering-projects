'use strict';

/**
 * Remove consecutive duplicates from a sorted array.
 *
 * BUG: the loop starts at index 1 and only pushes elements that differ
 * from their predecessor, so the first element is always dropped (and a
 * single-element array returns an empty array).
 */
function dedupeSorted(arr) {
  const result = [];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] !== arr[i - 1]) {
      result.push(arr[i]);
    }
  }
  return result;
}

module.exports = { dedupeSorted };
