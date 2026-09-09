const test = require('node:test');
const assert = require('node:assert/strict');
const { countDueSoon } = require('../src/upcoming');

// The month arithmetic that drives the twelve-month trend window.
function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + delta, 1)).toISOString().slice(0, 7);
}

test('steps back across a year boundary', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-01', -11), '2025-02');
});

test('steps forward across a year boundary', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
});

test('a twelve-month window ends on the requested month and has no duplicates', () => {
  const months = [];
  for (let offset = 11; offset >= 0; offset -= 1) months.push(shiftMonth('2026-09', -offset));
  assert.equal(months.length, 12);
  assert.equal(months[11], '2026-09');
  assert.equal(months[0], '2025-10');
  assert.equal(new Set(months).size, 12);
});

test('month-over-month change is computed as a fraction, guarding divide-by-zero', () => {
  const change = (total, previous) => (previous === 0 ? null : (total - previous) / previous);
  assert.equal(change(150, 100), 0.5);
  assert.equal(change(50, 100), -0.5);
  assert.equal(change(100, 0), null);
});

test('bills due within a week count towards the bell, past ones do not', () => {
  const bills = [
    { date: '2026-09-08' },
    { date: '2026-09-09' },
    { date: '2026-09-16' },
    { date: '2026-09-17' }
  ];
  // today counts, the day before does not, and the window ends seven days out.
  assert.equal(countDueSoon(bills, '2026-09-09'), 2);
});

test('the due-soon window reaches into the next month', () => {
  const bills = [{ date: '2026-09-30' }, { date: '2026-10-02' }, { date: '2026-10-08' }];
  assert.equal(countDueSoon(bills, '2026-09-28'), 2);
});

test('nothing due means an unlit bell', () => {
  assert.equal(countDueSoon([], '2026-09-09'), 0);
  assert.equal(countDueSoon([{ date: '2026-10-20' }], '2026-09-09'), 0);
});
