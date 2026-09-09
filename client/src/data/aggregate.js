// The dashboard's arithmetic, moved out of SQL.
//
// These produce exactly the rows the aggregate functions in
// 0002_summary.sql used to return, so `assembleSummary` is unchanged: the only
// difference is that the adding up happens where the key is.

const asDate = (day) => new Date(`${day}T00:00:00Z`);
const iso = (date) => date.toISOString().slice(0, 10);
export const addDays = (day, days) => iso(new Date(asDate(day).getTime() + days * 86400000));
export const daysBetween = (from, to) => Math.round((asDate(to) - asDate(from)) / 86400000) + 1;

export function shiftMonth(month, delta) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7);
}

const within = (rows, from, to) => rows.filter((row) => row.date >= from && row.date <= to);

// One row per day of the range, gaps filled, with the running total alongside:
// the prefix sum the charts are built from.
export function dailySeries(rows, from, to) {
  const spent = new Map();
  const earned = new Map();
  for (const row of within(rows, from, to)) {
    const target = row.kind === 'income' ? earned : spent;
    target.set(row.date, (target.get(row.date) || 0) + row.amount);
  }

  const series = [];
  let spentToDate = 0;
  let earnedToDate = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    spentToDate += spent.get(day) || 0;
    earnedToDate += earned.get(day) || 0;
    series.push({
      day,
      spent: spent.get(day) || 0,
      earned: earned.get(day) || 0,
      spent_to_date: spentToDate,
      earned_to_date: earnedToDate
    });
  }
  return series;
}

// This period and the equally long one before it, in the shape the assembler
// reads: one row per period and kind.
export function periodTotals(rows, from, to) {
  const previousFrom = addDays(from, -daysBetween(from, to));
  const buckets = new Map();

  for (const row of within(rows, previousFrom, to)) {
    const period = row.date >= from ? 'current' : 'previous';
    const key = `${period}|${row.kind}`;
    const bucket = buckets.get(key) || { period, kind: row.kind, total: 0, transactions: 0 };
    bucket.total += row.amount;
    bucket.transactions += 1;
    buckets.set(key, bucket);
  }

  return [...buckets.values()];
}

export function categoryTotals(rows, from, to) {
  const buckets = new Map();
  for (const row of within(rows, from, to)) {
    if (row.kind !== 'expense') continue;
    const bucket = buckets.get(row.category) || { category: row.category, total: 0, transactions: 0 };
    bucket.total += row.amount;
    bucket.transactions += 1;
    buckets.set(row.category, bucket);
  }
  return [...buckets.values()].sort((a, b) => b.total - a.total);
}

export function accountTotals(rows, from, to) {
  const buckets = new Map();
  for (const row of within(rows, from, to)) {
    const method = row.paymentMethod || 'unassigned';
    const key = `${method}|${row.kind}`;
    const bucket = buckets.get(key) || { method, kind: row.kind, total: 0, transactions: 0 };
    bucket.total += row.amount;
    bucket.transactions += 1;
    buckets.set(key, bucket);
  }
  return [...buckets.values()];
}

/** Twelve months of expense totals, ending with the month the range ends in. */
export function monthlyTrend(rows, anchorDay) {
  const anchor = anchorDay.slice(0, 7);
  const months = [];
  for (let offset = 11; offset >= 0; offset -= 1) months.push(shiftMonth(anchor, -offset));

  const totals = new Map(months.map((month) => [month, 0]));
  for (const row of rows) {
    if (row.kind !== 'expense') continue;
    const month = row.date.slice(0, 7);
    if (totals.has(month)) totals.set(month, totals.get(month) + row.amount);
  }

  return months.map((month) => ({ month, total: totals.get(month) }));
}

/** The earliest day a summary for this range needs, so one query covers it. */
export function summaryWindow(from, to) {
  const previousFrom = addDays(from, -daysBetween(from, to));
  const trendStart = `${shiftMonth(to.slice(0, 7), -11)}-01`;
  return previousFrom < trendStart ? previousFrom : trendStart;
}

/** An account's balance is its opening balance plus what it has seen since. */
export function accountBalances(accounts, rows) {
  const totals = new Map();
  for (const row of rows) {
    if (!row.accountId) continue;
    const bucket = totals.get(row.accountId) || { delta: 0, transactions: 0 };
    bucket.delta += row.kind === 'income' ? row.amount : -row.amount;
    bucket.transactions += 1;
    totals.set(row.accountId, bucket);
  }

  return accounts.map((account) => {
    const seen = totals.get(account.id) || { delta: 0, transactions: 0 };
    return {
      ...account,
      balance: account.openingBalance + seen.delta,
      transactions: seen.transactions
    };
  });
}
