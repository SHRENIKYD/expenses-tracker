// The server hands back one row per day of the selected range. Summing those
// rows again for every bucket, every hover and every range tweak is O(n) each
// time; a prefix sum pays O(n) once and then answers any sub-range in constant
// time. Everything here is pure so the same functions serve the charts, the
// tiles and any future brush-to-zoom.

/**
 * prefix[i] is the total of the first i values, so prefix[0] is always 0 and
 * prefix[n] is the whole series.
 */
export function buildPrefix(values) {
  const prefix = new Float64Array(values.length + 1);
  for (let i = 0; i < values.length; i += 1) {
    prefix[i + 1] = prefix[i] + values[i];
  }
  return prefix;
}

/** Total of values[start…end], inclusive of start, exclusive of end. O(1). */
export function rangeSum(prefix, start, end) {
  const lo = Math.max(0, Math.min(start, prefix.length - 1));
  const hi = Math.max(lo, Math.min(end, prefix.length - 1));
  // Money is stored to two decimals; the addition is exact enough that this
  // only trims the float noise a long chain of additions leaves behind.
  return Math.round((prefix[hi] - prefix[lo]) * 100) / 100;
}

/**
 * Split a day series into at most `count` contiguous buckets of near-equal
 * length. Each bucket's totals come from the prefix sums, so bucketing a
 * three-year range costs the same per bucket as bucketing a week.
 */
export function bucketSeries(daily, count = 4) {
  if (daily.length === 0) return [];

  const buckets = Math.max(1, Math.min(count, daily.length));
  const spend = buildPrefix(daily.map((day) => day.total));
  const earn = buildPrefix(daily.map((day) => day.income));

  const edges = [0];
  for (let i = 1; i <= buckets; i += 1) {
    edges.push(Math.round((daily.length * i) / buckets));
  }

  return Array.from({ length: buckets }, (_, index) => {
    const start = edges[index];
    const end = edges[index + 1];
    return {
      index: index + 1,
      from: daily[start].date,
      to: daily[end - 1].date,
      days: end - start,
      expenses: rangeSum(spend, start, end),
      income: rangeSum(earn, start, end)
    };
  });
}

/**
 * A trailing mean over `window` days, computed by sliding the window one day at
 * a time — O(n) rather than the O(n·window) of re-summing at every point.
 */
export function rollingAverage(values, window = 7) {
  if (window < 1) return values.slice();

  const out = new Array(values.length);
  let running = 0;
  for (let i = 0; i < values.length; i += 1) {
    running += values[i];
    if (i >= window) running -= values[i - window];
    const span = Math.min(i + 1, window);
    out[i] = Math.round((running / span) * 100) / 100;
  }
  return out;
}

/**
 * The `window`-day stretch with the highest total — the "heaviest week" — found
 * in one pass with the same sliding window. When several stretches tie (easily
 * done, since a quiet day at either end changes nothing) the earliest wins, so
 * the answer does not drift between renders.
 */
export function heaviestWindow(daily, window = 7) {
  if (daily.length === 0 || window < 1) return null;

  const span = Math.min(window, daily.length);
  let running = 0;
  for (let i = 0; i < span; i += 1) running += daily[i].total;

  let best = { start: 0, total: running };
  for (let i = span; i < daily.length; i += 1) {
    running += daily[i].total - daily[i - span].total;
    if (running > best.total) best = { start: i - span + 1, total: running };
  }

  return {
    from: daily[best.start].date,
    to: daily[best.start + span - 1].date,
    total: Math.round(best.total * 100) / 100,
    days: span
  };
}

/** Where a date sits in the series, for turning a brush selection into indices. */
export function dayIndex(daily, date) {
  let lo = 0;
  let hi = daily.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (daily[mid].date === date) return mid;
    if (daily[mid].date < date) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
