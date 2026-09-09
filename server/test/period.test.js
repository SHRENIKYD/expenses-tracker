const test = require('node:test');
const assert = require('node:assert/strict');

const {
  addDays,
  coveredMonth,
  daysBetween,
  monthEnd,
  monthsInRange,
  previousPeriod,
  resolvePeriod
} = require('../src/period');

test('a month resolves to its first and last day, leap years included', () => {
  assert.deepEqual(resolvePeriod({ month: '2026-09' }, '2026-09-09').period, {
    from: '2026-09-01',
    to: '2026-09-30'
  });
  assert.equal(monthEnd('2024-02'), '2024-02-29');
  assert.equal(monthEnd('2026-02'), '2026-02-28');
  assert.equal(monthEnd('2026-12'), '2026-12-31');
});

test('no month and no range falls back to the month containing today', () => {
  assert.deepEqual(resolvePeriod({}, '2026-03-17').period, {
    from: '2026-03-01',
    to: '2026-03-31'
  });
});

test('an explicit range is taken as given', () => {
  assert.deepEqual(resolvePeriod({ from: '2026-08-15', to: '2026-09-14' }, '2026-09-09').period, {
    from: '2026-08-15',
    to: '2026-09-14'
  });
});

test('a malformed or backwards range is refused rather than guessed at', () => {
  assert.deepEqual(resolvePeriod({ from: '2026-09-30', to: '2026-09-01' }, '2026-09-09').errors, [
    'from must not be after to'
  ]);
  assert.deepEqual(resolvePeriod({ from: '2026-02-31', to: '2026-09-01' }, '2026-09-09').errors, [
    'from and to must both be YYYY-MM-DD dates'
  ]);
  assert.deepEqual(resolvePeriod({ from: '2026-09-01' }, '2026-09-09').errors, [
    'from and to must both be YYYY-MM-DD dates'
  ]);
  assert.deepEqual(resolvePeriod({ month: '2026-13' }, '2026-09-09').errors, [
    'month must be in YYYY-MM format'
  ]);
  assert.deepEqual(resolvePeriod({ from: '2020-01-01', to: '2026-09-01' }, '2026-09-09').errors, [
    'a range may cover at most three years'
  ]);
});

test('the previous period is the same length, ending the day before', () => {
  assert.deepEqual(previousPeriod({ from: '2026-09-01', to: '2026-09-30' }), {
    from: '2026-08-02',
    to: '2026-08-31'
  });
  assert.deepEqual(previousPeriod({ from: '2026-09-09', to: '2026-09-09' }), {
    from: '2026-09-08',
    to: '2026-09-08'
  });
});

test('a range is month-scoped only when it covers exactly one calendar month', () => {
  assert.equal(coveredMonth({ from: '2026-09-01', to: '2026-09-30' }), '2026-09');
  assert.equal(coveredMonth({ from: '2026-09-01', to: '2026-09-29' }), null);
  assert.equal(coveredMonth({ from: '2026-09-02', to: '2026-09-30' }), null);
  assert.equal(coveredMonth({ from: '2026-08-01', to: '2026-09-30' }), null);
});

test('a day count is inclusive of both ends', () => {
  assert.equal(daysBetween('2026-09-01', '2026-09-01'), 1);
  assert.equal(daysBetween('2026-09-01', '2026-09-30'), 30);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 2);
});

test('months in a range include both ends and cross a year boundary', () => {
  assert.deepEqual(monthsInRange({ from: '2026-11-20', to: '2027-02-03' }), [
    '2026-11',
    '2026-12',
    '2027-01',
    '2027-02'
  ]);
  assert.deepEqual(monthsInRange({ from: '2026-09-05', to: '2026-09-06' }), ['2026-09']);
});

test('day arithmetic crosses months and years', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
});
