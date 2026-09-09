import test from 'node:test';
import assert from 'node:assert/strict';

import {
  accountBalances,
  accountTotals,
  addDays,
  categoryTotals,
  dailySeries,
  daysBetween,
  monthlyTrend,
  periodTotals,
  summaryWindow
} from '../src/data/aggregate.js';

// The same arithmetic the SQL functions used to do, now that the database
// cannot read the numbers. These are the tests that stand in for
// supabase/test/functions.test.mjs.
const ROWS = [
  { date: '2026-09-01', kind: 'income', amount: 100000, category: 'salary', paymentMethod: 'bank_transfer', accountId: 'a' },
  { date: '2026-09-01', kind: 'expense', amount: 18500, category: 'housing', paymentMethod: 'bank_transfer', accountId: 'a' },
  { date: '2026-09-03', kind: 'expense', amount: 2462.62, category: 'utilities', paymentMethod: 'upi', accountId: 'a' },
  { date: '2026-09-05', kind: 'expense', amount: 483.94, category: 'transport', paymentMethod: null, accountId: null },
  { date: '2026-09-05', kind: 'expense', amount: 236.29, category: 'food', paymentMethod: 'upi', accountId: 'b' },
  { date: '2026-08-20', kind: 'expense', amount: 1000, category: 'food', paymentMethod: 'upi', accountId: 'b' }
];

test('the daily series covers every day of the range, gaps filled', () => {
  const series = dailySeries(ROWS, '2026-09-01', '2026-09-05');

  assert.equal(series.length, 5);
  assert.deepEqual(series.map((day) => day.day), [
    '2026-09-01',
    '2026-09-02',
    '2026-09-03',
    '2026-09-04',
    '2026-09-05'
  ]);
  assert.equal(series[1].spent, 0);
  assert.equal(series[0].earned, 100000);
});

test('the running total is a prefix sum of the days before it', () => {
  const series = dailySeries(ROWS, '2026-09-01', '2026-09-05');

  let spent = 0;
  for (const day of series) {
    spent += day.spent;
    assert.equal(day.spent_to_date, spent);
  }
  assert.equal(series.at(-1).spent_to_date, 18500 + 2462.62 + 483.94 + 236.29);
});

test('period totals separate this window from the one before it', () => {
  const totals = periodTotals(ROWS, '2026-09-01', '2026-09-05');

  const current = totals.find((row) => row.period === 'current' && row.kind === 'expense');
  const previous = totals.find((row) => row.period === 'previous' && row.kind === 'expense');

  assert.equal(current.transactions, 4);
  assert.equal(Math.round(current.total * 100) / 100, 21682.85);
  // The five days before 1 September reach back to 27 August, so August's row
  // is outside the comparison — which is the point of an equal-length window.
  assert.equal(previous, undefined);
});

test('category totals rank spending and ignore income', () => {
  const totals = categoryTotals(ROWS, '2026-09-01', '2026-09-05');

  assert.ok(!totals.some((row) => row.category === 'salary'));
  assert.deepEqual(totals.map((row) => row.category), ['housing', 'utilities', 'transport', 'food']);
  assert.equal(totals[0].total, 18500);
});

test('account totals group by payment method, both directions', () => {
  const totals = accountTotals(ROWS, '2026-09-01', '2026-09-05');

  const unassigned = totals.find((row) => row.method === 'unassigned');
  assert.equal(unassigned.total, 483.94);

  const bankIn = totals.find((row) => row.method === 'bank_transfer' && row.kind === 'income');
  assert.equal(bankIn.total, 100000);
});

test('the trend covers twelve months ending on the anchor, zeros included', () => {
  const trend = monthlyTrend(ROWS, '2026-09-30');

  assert.equal(trend.length, 12);
  assert.equal(trend.at(-1).month, '2026-09');
  assert.equal(trend[0].month, '2025-10');
  assert.equal(trend.at(-2).total, 1000);
  assert.equal(trend[0].total, 0);
});

test('one window covers the range, the period before it and the trend', () => {
  // September, so the trend reaches back to October, which is earlier than the
  // previous thirty days: the query has to start at whichever is earlier.
  assert.equal(summaryWindow('2026-09-01', '2026-09-30'), '2025-10-01');
  // A long range can reach back further than the trend does.
  assert.equal(summaryWindow('2024-01-01', '2026-09-30'), '2021-04-02');
});

test('a balance follows from the opening balance and the rows since', () => {
  const accounts = [
    { id: 'a', name: 'Bank', openingBalance: 5000 },
    { id: 'b', name: 'Card', openingBalance: 0 },
    { id: 'c', name: 'Cash', openingBalance: 250 }
  ];

  const [bank, card, cash] = accountBalances(accounts, ROWS);

  assert.equal(bank.balance, 5000 + 100000 - 18500 - 2462.62);
  assert.equal(bank.transactions, 3);
  assert.equal(card.balance, -1236.29);
  // An account nothing points at keeps its opening balance.
  assert.equal(cash.balance, 250);
  assert.equal(cash.transactions, 0);
});

test('dates move in whole days, inclusive', () => {
  assert.equal(addDays('2026-09-01', 30), '2026-10-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-09-01', '2026-09-30'), 30);
  assert.equal(daysBetween('2026-09-01', '2026-09-01'), 1);
});
