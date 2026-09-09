const express = require('express');
const { pool } = require('../db');
const { countDueSoon } = require('../upcoming');
const {
  coveredMonth,
  daysBetween,
  monthsInRange,
  previousPeriod,
  resolvePeriod
} = require('../period');

const router = express.Router();

function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + delta, 1)).toISOString().slice(0, 7);
}

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const todayIso = new Date().toISOString().slice(0, 10);

    const { errors, period } = resolvePeriod(req.query, todayIso);
    if (errors) return res.status(400).json({ errors });

    const { from, to } = period;
    const month = coveredMonth(period);
    const previous = previousPeriod(period);
    // The twelve-month trend is anchored on the month the range ends in, so it
    // stays comparable whatever window is selected.
    const anchorMonth = to.slice(0, 7);
    const trendStart = `${shiftMonth(anchorMonth, -11)}-01`;

    const [
      totals,
      byCategory,
      daily,
      trend,
      budgets,
      settingsRows,
      recurringRows,
      accountRows,
      applied
    ] = await Promise.all([
      // This period and the one before it, in one pass.
      pool.query(
        `SELECT date >= $2::date AS current,
                kind,
                COALESCE(SUM(amount), 0) AS total,
                COUNT(*) AS count
         FROM expenses
         WHERE user_id = $1 AND date BETWEEN $4::date AND $3::date
         GROUP BY 1, 2`,
        [userId, from, to, previous.from]
      ),
      pool.query(
        `SELECT category, SUM(amount) AS total, COUNT(*) AS count
         FROM expenses
         WHERE user_id = $1 AND kind = 'expense' AND date BETWEEN $2::date AND $3::date
         GROUP BY category ORDER BY SUM(amount) DESC`,
        [userId, from, to]
      ),
      // One row per day of the range, gaps filled with zeros, plus the running
      // total — a prefix sum computed where the data already lives, so the
      // client can answer "how much between these two days" without a re-query.
      pool.query(
        `WITH days AS (
           SELECT generate_series($2::date, $3::date, interval '1 day')::date AS day
         ),
         totals AS (
           SELECT date,
                  SUM(amount) FILTER (WHERE kind = 'expense') AS spent,
                  SUM(amount) FILTER (WHERE kind = 'income') AS earned
           FROM expenses
           WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date
           GROUP BY date
         )
         SELECT to_char(days.day, 'YYYY-MM-DD') AS day,
                COALESCE(totals.spent, 0) AS spent,
                COALESCE(totals.earned, 0) AS earned,
                SUM(COALESCE(totals.spent, 0)) OVER (ORDER BY days.day) AS spent_to_date,
                SUM(COALESCE(totals.earned, 0)) OVER (ORDER BY days.day) AS earned_to_date
         FROM days LEFT JOIN totals ON totals.date = days.day
         ORDER BY days.day`,
        [userId, from, to]
      ),
      pool.query(
        `SELECT to_char(date, 'YYYY-MM') AS month, SUM(amount) AS total
         FROM expenses
         WHERE user_id = $1 AND kind = 'expense' AND date >= $2::date AND to_char(date, 'YYYY-MM') <= $3
         GROUP BY 1 ORDER BY 1`,
        [userId, trendStart, anchorMonth]
      ),
      pool.query('SELECT * FROM budgets WHERE user_id = $1', [userId]),
      pool.query('SELECT key, value FROM settings WHERE user_id = $1', [userId]),
      pool.query('SELECT * FROM recurring WHERE user_id = $1 ORDER BY day_of_month', [userId]),
      pool.query(
        `SELECT COALESCE(payment_method, 'unassigned') AS method, kind,
                SUM(amount) AS total, COUNT(*) AS count
         FROM expenses
         WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date
         GROUP BY 1, 2`,
        [userId, from, to]
      ),
      pool.query(
        `SELECT description, category, to_char(date, 'YYYY-MM-DD') AS day
         FROM expenses WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date`,
        [userId, from, to]
      )
    ]);

    const sum = (current, kind, field = 'total') => {
      const row = totals.rows.find((entry) => entry.current === current && entry.kind === kind);
      return row ? Number(row[field]) : 0;
    };

    const total = sum(true, 'expense');
    const income = sum(true, 'income');
    const previousTotal = sum(false, 'expense');
    const count = sum(true, 'expense', 'count') + sum(true, 'income', 'count');

    // Budgets are monthly, so they only apply when the range is a whole month.
    const limits = month
      ? new Map(budgets.rows.map((row) => [row.category, Number(row.monthly_limit)]))
      : new Map();
    const categories = byCategory.rows.map((row) => {
      const spent = Number(row.total);
      const limit = limits.has(row.category) ? limits.get(row.category) : null;
      return {
        category: row.category,
        total: spent,
        count: Number(row.count),
        budget: limit,
        overBudget: limit !== null && spent > limit
      };
    });
    for (const [category, limit] of limits) {
      if (!categories.some((entry) => entry.category === category)) {
        categories.push({ category, total: 0, count: 0, budget: limit, overBudget: false });
      }
    }

    const trendMonths = [];
    for (let offset = 11; offset >= 0; offset -= 1) {
      const key = shiftMonth(anchorMonth, -offset);
      const row = trend.rows.find((entry) => entry.month === key);
      trendMonths.push({ month: key, total: row ? Number(row.total) : 0 });
    }

    const settings = Object.fromEntries(settingsRows.rows.map((row) => [row.key, row.value]));
    // The budget is a monthly figure, so it only means something when the range
    // is exactly one month. A custom window reports no budget rather than a
    // number that quietly compares a fortnight against a month.
    const overallBudget = month ? Number(settings.monthlyBudget ?? 0) : 0;

    const totalDays = daysBetween(from, to);
    const elapsedDays =
      todayIso < from ? 0 : todayIso > to ? totalDays : daysBetween(from, todayIso);
    const inProgress = todayIso >= from && todayIso < to;
    const projected = inProgress && elapsedDays > 0 ? (total / elapsedDays) * totalDays : null;

    const appliedDates = new Set(
      applied.rows.map((row) => `${row.description}|${row.category}|${row.day}`)
    );

    // A recurring bill can fall in the range more than once when the range spans
    // months, so each month it touches is expanded and then clipped to it.
    const upcoming = monthsInRange(period)
      .flatMap((key) =>
        recurringRows.rows.map((row) => ({
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
      .filter((entry) => !appliedDates.has(`${entry.description}|${entry.category}|${entry.date}`))
      .sort((a, b) => a.date.localeCompare(b.date));

    const methods = [...new Set(accountRows.rows.map((row) => row.method))].sort();
    const accounts = methods.map((method) => {
      const forMethod = accountRows.rows.filter((row) => row.method === method);
      const of = (kind) => {
        const row = forMethod.find((entry) => entry.kind === kind);
        return row ? { total: Number(row.total), count: Number(row.count) } : { total: 0, count: 0 };
      };
      const received = of('income');
      const spend = of('expense');
      return {
        method,
        income: received.total,
        expenses: spend.total,
        count: received.count + spend.count
      };
    });

    res.json({
      // `month` stays for the callers that think in months; it is null when the
      // range is not one.
      month,
      range: { from, to, days: totalDays, label: month ? 'month' : 'custom' },
      previousRange: previous,
      accounts,
      dueSoon: countDueSoon(upcoming, todayIso),
      income,
      remaining: income - total,
      overallBudget,
      budgetUsed: overallBudget > 0 ? total / overallBudget : null,
      budgetLeft: overallBudget > 0 ? overallBudget - total : null,
      upcoming,
      total,
      count,
      previousMonth: previous.from.slice(0, 7),
      previousTotal,
      elapsedDays,
      totalDays,
      dailyAverage: elapsedDays > 0 ? total / elapsedDays : 0,
      projected,
      change: previousTotal === 0 ? null : (total - previousTotal) / previousTotal,
      categories,
      // Every day of the range, in order, with its running total. The client
      // builds prefix sums from this and answers any sub-range in constant time.
      daily: daily.rows.map((row) => ({
        date: row.day,
        total: Number(row.spent),
        income: Number(row.earned),
        spentToDate: Number(row.spent_to_date),
        earnedToDate: Number(row.earned_to_date)
      })),
      trend: trendMonths
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
