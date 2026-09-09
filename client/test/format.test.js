import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, formatMoneyShort, formatMonth, formatDay, formatPercent, titleCase } from '../src/format.js';

const strip = (s) => s.replace(/ /g, ' ');

test('formats rupees with Indian digit grouping', () => {
  assert.equal(strip(formatMoney(123456)), '₹1,23,456.00');
  assert.equal(strip(formatMoney(1234567)), '₹12,34,567.00');
});

test('always shows two decimal places', () => {
  assert.equal(strip(formatMoney(25)), '₹25.00');
  assert.equal(strip(formatMoney(25.5)), '₹25.50');
});

test('short form drops the decimals', () => {
  assert.ok(!strip(formatMoneyShort(18500)).includes('.'));
});

test('dates render in UTC, so a date-only value never slips a day', () => {
  assert.match(strip(formatDay('2026-09-01')), /01 Sep/);
  assert.match(strip(formatMonth('2026-01')), /Jan 26/);
});

test('percent carries an explicit sign for increases', () => {
  assert.equal(formatPercent(0.332), '+33.2%');
  assert.equal(formatPercent(-0.273), '-27.3%');
});

test('titleCase capitalises only the first letter', () => {
  assert.equal(titleCase('food'), 'Food');
  assert.equal(titleCase('other categories'), 'Other categories');
});
