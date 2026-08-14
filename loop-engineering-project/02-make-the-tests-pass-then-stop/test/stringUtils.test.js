'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { reverseString, isPalindrome, titleCase } = require('../src/stringUtils');

test('reverseString reverses the input', () => {
  assert.equal(reverseString('hello'), 'olleh');
});

test('isPalindrome detects a palindrome, ignoring case', () => {
  assert.equal(isPalindrome('Racecar'), true);
  assert.equal(isPalindrome('hello'), false);
});

test('titleCase capitalizes each word', () => {
  assert.equal(titleCase('hello world'), 'Hello World');
});
