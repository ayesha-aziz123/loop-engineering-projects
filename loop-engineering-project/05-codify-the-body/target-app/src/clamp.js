'use strict';

/**
 * Clamp a value into the inclusive range [min, max].
 *
 * BUG: the comparisons are wrong — in-range values fall through to `max`
 * instead of returning `value`, and values above `max` are returned as-is
 * instead of being clamped down to `max`.
 */
function clampToRange(value, min, max) {
  if (value < min) return min;
  if (value > max) return value;
  return max;
}

module.exports = { clampToRange };
