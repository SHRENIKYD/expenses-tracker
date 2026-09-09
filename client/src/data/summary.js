// Assembling the summary from its parts, kept separate from the network calls
// so the arithmetic can be tested without a database.

const iso = (date) => date.toISOString().slice(0, 10);
// PostgREST sends a date column as a string; a direct driver sends a Date. The
// rest of the app works in 'YYYY-MM-DD', so both arrive as that.
const isoDay = (value) =>
  typeof value === 'string' ? value.slice(0, 10) : new Date(value).toISOString().slice(0, 10);
const asDate = (value) => new Date(`${value}T00:00:00Z`);
const addDays = (value, days) => iso(new Date(asDate(value).getTime() + days * 86400000));
const daysBetween = (from, to) => Math.round((asDate(to) - asDate(from)) / 86400000) + 1;
const monthEnd = (month) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return iso(new Date(Date.UTC(year, monthNumber, 0)));
};

export function resolvePeriod(query = {}) {
  if (query.from && query.to) return { from: query.from, to: query.to };
  const month = query.month || new Date().toISOString().slice(0, 7);
  return { from: `${month}-01`, to: monthEnd(month) };
}

// A range covering exactly one calendar month can carry month-scoped figures —
// the monthly budget, the month-end projection. An arbitrary window cannot.
export function coveredMonth({ from, to }) {
  const month = from.slice(0, 7);
  return from === `${month}-01` && to === monthEnd(month) ? month : null;
}

export function assembleSummary({
  from,
  to,
  daily,
  totals,
  categories,
  accounts,
  trend,
  budgets,
  profile,
  recurring,
  applied,
  today
}) {
  const period = { from, to };
  const month = coveredMonth(period);
  const totalDays = daysBetween(from, to);

  const figure = (which, kind, field = 'total') => {
    const row = totals.find((entry) => entry.period === which && entry.kind === kind);
    return row ? Number(row[field]) : 0;
  };

  const total = figure('current', 'expense');
  const income = figure('current', 'income');
  const previousTotal = figure('previous', 'expense');
  const count =
    figure('current', 'expense', 'transactions') + figure('current', 'income', 'transactions');

  // Budgets are monthly, so they only apply when the range is a whole month.
  const limits = new Map(
    month ? budgets.map((row) => [row.category, Number(row.monthly_limit)]) : []
  );
  const withBudgets = categories.map((row) => {
    const spent = Number(row.total);
    const limit = limits.has(row.category) ? limits.get(row.category) : null;
    return {
      category: row.category,
      total: spent,
      count: Number(row.transactions),
      budget: limit,
      overBudget: limit !== null && spent > limit
    };
  });
  for (const [category, limit] of limits) {
    if (!withBudgets.some((entry) => entry.category === category)) {
      withBudgets.push({ category, total: 0, count: 0, budget: limit, overBudget: false });
    }
  }

  const methods = [...new Set(accounts.map((row) => row.method))].sort();
  const byMethod = methods.map((method) => {
    const rows = accounts.filter((row) => row.method === method);
    const of = (kind) => rows.find((row) => row.kind === kind) || { total: 0, transactions: 0 };
    return {
      method,
      income: Number(of('income').total),
      expenses: Number(of('expense').total),
      count: Number(of('income').transactions) + Number(of('expense').transactions)
    };
  });

  const alreadyRecorded = new Set(
    applied.map((row) => `${row.description}|${row.category}|${row.date}`)
  );
  const upcoming = monthsBetween(from, to)
    .flatMap((key) =>
      recurring.map((row) => ({
        id: `${row.id}:${key}`,
        recurringId: row.id,
        description: row.description,
        amount: Number(row.amount),
        category: row.category,
        dayOfMonth: row.day_of_month,
        date: `${key}-${String(row.day_of_month).padStart(2, '0')}`
      }))
    )
    .filter((entry) => entry.date >= from && entry.date <= to)
    .filter((entry) => !alreadyRecorded.has(`${entry.description}|${entry.category}|${entry.date}`))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weekAhead = addDays(today, 7);
  const dueSoon = upcoming.filter((entry) => entry.date >= today && entry.date <= weekAhead).length;

  const overallBudget = month ? Number(profile?.monthly_budget ?? 0) : 0;
  const elapsedDays = today < from ? 0 : today > to ? totalDays : daysBetween(from, today);
  const inProgress = today >= from && today < to;

  return {
    month,
    range: { from, to, days: totalDays, label: month ? 'month' : 'custom' },
    previousRange: { from: addDays(from, -totalDays), to: addDays(from, -1) },
    accounts: byMethod,
    dueSoon,
    income,
    remaining: income - total,
    overallBudget,
    budgetUsed: overallBudget > 0 ? total / overallBudget : null,
    budgetLeft: overallBudget > 0 ? overallBudget - total : null,
    upcoming,
    total,
    count,
    previousMonth: addDays(from, -1).slice(0, 7),
    previousTotal,
    elapsedDays,
    totalDays,
    dailyAverage: elapsedDays > 0 ? total / elapsedDays : 0,
    projected: inProgress && elapsedDays > 0 ? (total / elapsedDays) * totalDays : null,
    change: previousTotal === 0 ? null : (total - previousTotal) / previousTotal,
    categories: withBudgets,
    daily: daily.map((row) => ({
      date: isoDay(row.day),
      total: Number(row.spent),
      income: Number(row.earned),
      spentToDate: Number(row.spent_to_date),
      earnedToDate: Number(row.earned_to_date)
    })),
    trend: trend.map((row) => ({ month: row.month, total: Number(row.total) }))
  };
}

function monthsBetween(from, to) {
  const months = [];
  let [year, month] = from.split('-').map(Number);
  const last = to.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    months.push(key);
    if (key >= last) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}
