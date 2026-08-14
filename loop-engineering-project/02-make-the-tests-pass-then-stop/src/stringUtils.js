'use strict';

/**
 * Reverse a string.
 */
function reverseString(str) {
  return str.split('').reverse().join('');
}

/**
 * Check whether a string is a palindrome (ignoring case).
 */
function isPalindrome(str) {
  const normalized = str.toLowerCase();
  return normalized === normalized.split('').reverse().join('');
}

/**
 * Convert a string to title case, e.g. "hello world" -> "Hello World".
 */
function titleCase(str) {
  return str
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

module.exports = { reverseString, isPalindrome, titleCase };
