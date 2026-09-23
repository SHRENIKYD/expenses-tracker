import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

// The user is in India. Between midnight and 05:30 IST the UTC date is still
// yesterday, and "today" was read from UTC: the add form defaulted to
// yesterday and would not let today be picked, a bank alert at 1 am was filed
// under the day before, and on the 1st the dashboard showed last month.
process.env.TZ = 'Asia/Kolkata';

const { currentMonth, todayIso, formatRelativeDay, localDay } = await import('../src/format.js');
const { PRESETS, monthSelection } = await import('../src/range.js');
const { resolvePeriod } = await import('../src/data/summary.js');
const { readMessage } = await import('../src/sms.js');

// 01:00 IST on 1 October 2026 is 19:30 UTC on 30 September.
const ONE_AM_IST_OCT_1 = Date.UTC(2026, 8, 30, 19, 30);

test.beforeEach(() => mock.timers.enable({ apis: ['Date'], now: ONE_AM_IST_OCT_1 }));
test.afterEach(() => mock.timers.reset());

test('today is the date on the calendar where the user is', () => {
  assert.equal(todayIso(), '2026-10-01');
  assert.equal(currentMonth(), '2026-10');
  assert.equal(localDay(new Date(Date.UTC(2026, 8, 30, 18, 29))), '2026-09-30', 'one minute before IST midnight');
  assert.equal(localDay(new Date(Date.UTC(2026, 8, 30, 18, 30))), '2026-10-01', 'IST midnight');
});

test('a row dated today reads as today, and yesterday as yesterday', () => {
  assert.equal(formatRelativeDay('2026-10-01'), 'Today');
  assert.equal(formatRelativeDay('2026-09-30'), 'Yesterday');
});

test('the period with nothing chosen is the month it is where the user is', () => {
  assert.deepEqual(resolvePeriod({}), { from: '2026-10-01', to: '2026-10-31' });
});

test('presets end today and count back from it', () => {
  const by = Object.fromEntries(PRESETS.map((preset) => [preset.id, preset.build()]));
  assert.deepEqual([by.month.from, by.month.to], ['2026-10-01', '2026-10-31']);
  assert.deepEqual([by.last7.from, by.last7.to], ['2026-09-25', '2026-10-01']);
  assert.deepEqual([by.last30.from, by.last30.to], ['2026-09-02', '2026-10-01']);
  assert.deepEqual([by.quarter.from, by.quarter.to], ['2026-10-01', '2026-10-01']);
  assert.deepEqual([by.year.from, by.year.to], ['2026-01-01', '2026-10-01']);
  assert.deepEqual(monthSelection('2026-02'), { mode: 'month', month: '2026-02', from: '2026-02-01', to: '2026-02-28' });
});

test('a bank alert is dated by when it arrived, where the user is', () => {
  const alert = readMessage({
    sender: 'AD-HDFCBK',
    body: 'Rs.450.00 debited from a/c **1234 on 01-10-26 to VPA swiggy@icici. UPI Ref 402512345678',
    at: ONE_AM_IST_OCT_1
  });
  assert.equal(alert.date, '2026-10-01');
});
