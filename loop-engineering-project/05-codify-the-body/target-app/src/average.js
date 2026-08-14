'use strict';

/**
 * Compute the arithmetic mean of a non-empty array of numbers.
 *
 * BUG: divides by `nums.length - 1` instead of `nums.length`, so every
 * result is wrong (and a single-element array divides by zero).
 */
function average(nums) {
  let sum = 0;
  for (let i = 0; i < nums.length; i++) {
    sum += nums[i];
  }
  return sum / (nums.length - 1);
}

module.exports = { average };
