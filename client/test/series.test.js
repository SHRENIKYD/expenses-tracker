import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPrefix,
  rangeSum,
  bucketSeries,
  rollingAverage,
  heaviestWindow,
  dayIndex
} from '../src/series.js';

const day = (date, total, income = 0) => ({ date, total, income });

function series(values) {
  return values.map((value, index) => day(`2026-09-${String(index + 1).padStart(2, '0')}`, value));
}

test('a prefix sum starts at zero and ends at the whole series', () => {
  const prefix = buildPrefix([5, 3, 2]);
  assert.equal(prefix[0], 0);
  assert.equal(prefix[3], 10);
  assert.equal(prefix.length, 4);
  assert.deepEqual(buildPrefix([]).length, 1);
});

test('any sub-range read from the prefix matches adding the values up', () => {
  const values = Array.from({ length: 120 }, (_, i) => Math.round(Math.sin(i) * 500 + 600) / 10);
  const prefix = buildPrefix(values);

  for (let start = 0; start < values.length; start += 7) {
    for (let end = start; end <= values.length; end += 11) {
      const naive = Math.round(values.slice(start, end).reduce((a, b) => a + b, 0) * 100) / 100;
      assert.equal(rangeSum(prefix, start, end), naive, `range ${start}..${end}`);
    }
  }
});

test('a range read outside the series is clamped rather than returning NaN', () => {
  const prefix = buildPrefix([1, 2, 3]);
  assert.equal(rangeSum(prefix, -5, 99), 6);
  assert.equal(rangeSum(prefix, 2, 1), 0);
});

test('buckets cover every day exactly once', () => {
  const daily = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const buckets = bucketSeries(daily, 4);

  assert.equal(buckets.length, 4);
  assert.equal(
    buckets.reduce((sum, bucket) => sum + bucket.days, 0),
    daily.length
  );
  assert.equal(
    buckets.reduce((sum, bucket) => sum + bucket.expenses, 0),
    55
  );
  assert.equal(buckets[0].from, '2026-09-01');
  assert.equal(buckets[3].to, '2026-09-10');
});

test('bucketing never asks for more buckets than there are days', () => {
  assert.equal(bucketSeries(series([1, 2]), 4).length, 2);
  assert.deepEqual(bucketSeries([], 4), []);
  assert.equal(bucketSeries(series([1, 2, 3]), 1)[0].expenses, 6);
});

test('a month of days splits into four near-equal buckets', () => {
  const daily = series(Array.from({ length: 30 }, () => 10));
  const buckets = bucketSeries(daily, 4);
  const lengths = buckets.map((bucket) => bucket.days);

  assert.equal(lengths.reduce((a, b) => a + b, 0), 30);
  assert.ok(Math.max(...lengths) - Math.min(...lengths) <= 1, `uneven split: ${lengths}`);
  assert.equal(
    buckets.reduce((sum, bucket) => sum + bucket.expenses, 0),
    300
  );
  // buckets run end to end with no gap and no overlap
  buckets.slice(1).forEach((bucket, index) => {
    const previousEnd = Number(buckets[index].to.slice(8));
    assert.equal(Number(bucket.from.slice(8)), previousEnd + 1);
  });
});

test('a rolling average matches the mean of its own window', () => {
  const values = [10, 20, 30, 40, 50, 60, 70, 80];
  const rolled = rollingAverage(values, 3);

  assert.equal(rolled[0], 10);
  assert.equal(rolled[1], 15);
  assert.equal(rolled[2], 20);
  assert.equal(rolled[7], 70);
  assert.equal(rolled.length, values.length);
});

test('the sliding rolling average agrees with recomputing each window', () => {
  const values = Array.from({ length: 200 }, (_, i) => (i * 37) % 91);
  const window = 7;
  const rolled = rollingAverage(values, window);

  values.forEach((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    const mean = Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 100) / 100;
    assert.equal(rolled[i], mean, `index ${i}`);
  });
});

test('the heaviest window is the highest-spending stretch, not merely the last', () => {
  const daily = series([1, 1, 1, 90, 90, 1, 1, 1, 1, 1]);
  const heaviest = heaviestWindow(daily, 3);

  assert.equal(heaviest.total, 181);
  assert.equal(heaviest.from, '2026-09-03');
  assert.equal(heaviest.to, '2026-09-05');
  assert.equal(heaviest.days, 3);
});

test('the heaviest window copes with a series shorter than the window', () => {
  assert.equal(heaviestWindow(series([5, 5]), 7).days, 2);
  assert.equal(heaviestWindow([], 7), null);
});

test('a date is found by binary search, and a missing one reports -1', () => {
  const daily = series([1, 2, 3, 4, 5]);
  assert.equal(dayIndex(daily, '2026-09-01'), 0);
  assert.equal(dayIndex(daily, '2026-09-04'), 3);
  assert.equal(dayIndex(daily, '2026-10-01'), -1);
});

test('when two stretches tie, the earliest is reported so the answer is stable', () => {
  //  a quiet day either side of the same spending makes two equal windows
  const daily = series([0, 50, 50, 0, 0, 0, 0, 0]);
  const first = heaviestWindow(daily, 3);
  assert.equal(first.total, 100);
  assert.equal(first.from, '2026-09-01');
  assert.equal(heaviestWindow(daily, 3).from, first.from);
});
