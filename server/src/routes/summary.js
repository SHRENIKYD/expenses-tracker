const express = require('express');
const { pool } = require('../db');
const { isIsoMonth } = require('../validate');

const router = express.Router();

function totalDaysIn(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month, delta) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const month = req.query.month ? String(req.query.month) : currentMonth();
    if (!isIsoMonth(month)) {
      return res.status(400).json({ errors: ['month must be in YYYY-MM format'] });
    }

    const previous = shiftMonth(month, -1);
    const trendStart = `${shiftMonth(month, -11)}-01`;

    const [
      totals,
      byCategory,
      daily,
      trend,
      budgets,
      incomeRows,
      settingsRows,
      recurringRows,
      weeklyRows
    ] = await Promise.all([
      pool.query(
        `SELECT to_char(date, 'YYYY-MM') AS month, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
         FROM expenses WHERE user_id = $1 AND kind = 'expense' AND to_char(date, 'YYYY-MM') IN ($2, $3)
         GROUP BY 1`,
        [userId, month, previous]
      ),
      pool.query(
        `SELECT category, SUM(amount) AS total, COUNT(*) AS count
         FROM expenses WHERE user_id = $1 AND kind = 'expense' AND to_char(date, 'YYYY-MM') = $2
         GROUP BY category ORDER BY SUM(amount) DESC`,
        [userId, month]
      ),
      pool.query(
        `SELECT to_char(date, 'YYYY-MM-DD') AS day, SUM(amount) AS total
         FROM expenses WHERE user_id = $1 AND kind = 'expense' AND to_char(date, 'YYYY-MM') = $2
         GROUP BY 1 ORDER BY 1`,
        [userId, month]
      ),
      pool.query(
        `SELECT to_char(date, 'YYYY-MM') AS month, SUM(amount) AS total
         FROM expenses
         WHERE user_id = $1 AND kind = 'expense' AND date >= $2::date AND to_char(date, 'YYYY-MM') <= $3
         GROUP BY 1 ORDER BY 1`,
        [userId, trendStart, month]
      ),
      pool.query('SELECT * FROM budgets WHERE user_id = $1', [userId]),
      pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
         FROM expenses WHERE user_id = $1 AND kind = 'income' AND to_char(date, 'YYYY-MM') = $2`,
        [userId, month]
      ),
      pool.query('SELECT key, value FROM settings WHERE user_id = $1', [userId]),
      pool.query('SELECT * FROM recurring WHERE user_id = $1 ORDER BY day_of_month', [userId]),
      // Weekly buckets for the cash-flow chart: days 1-7, 8-14, 15-21, then the
      // rest of the month, so a 28 to 31 day month always yields four columns.
      pool.query(
        `SELECT LEAST(((EXTRACT(DAY FROM date)::int - 1) / 7) + 1, 4) AS week,
                kind,
                SUM(amount) AS total
         FROM expenses
         WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2
         GROUP BY 1, 2
         ORDER BY 1`,
        [userId, month]
      )
    ]);

    const totalFor = (target) => {
      const row = totals.rows.find((entry) => entry.month === target);
      return row ? Number(row.total) : 0;
    };
    const countFor = (target) => {
      const row = totals.rows.find((entry) => entry.month === target);
      return row ? Number(row.count) : 0;
    };

    const limits = new Map(budgets.rows.map((row) => [row.category, Number(row.monthly_limit)]));

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
      const key = shiftMonth(month, -offset);
      const row = trend.rows.find((entry) => entry.month === key);
      trendMonths.push({ month: key, total: row ? Number(row.total) : 0 });
    }

    const total = totalFor(month);
    const previousTotal = totalFor(previous);

    // Project month-end only while the month is still running.
    const [year, monthNumber] = month.split('-').map(Number);
    const totalDays = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const todayIso = new Date().toISOString().slice(0, 10);
    const isCurrentMonth = todayIso.slice(0, 7) === month;
    const elapsedDays = isCurrentMonth ? Number(todayIso.slice(8, 10)) : totalDays;
    const projected = isCurrentMonth && elapsedDays > 0 ? (total / elapsedDays) * totalDays : null;

    const income = Number(incomeRows.rows[0].total);

    const weekEnds = [7, 14, 21, totalDaysIn(month)];
    const weekly = [1, 2, 3, 4].map((week, index) => {
      const forWeek = weeklyRows.rows.filter((row) => Number(row.week) === week);
      const of = (kind) => {
        const row = forWeek.find((entry) => entry.kind === kind);
        return row ? Number(row.total) : 0;
      };
      return {
        week,
        label: `W${week}`,
        from: index === 0 ? 1 : weekEnds[index - 1] + 1,
        to: weekEnds[index],
        income: of('income'),
        expenses: of('expense')
      };
    });
    const settings = Object.fromEntries(settingsRows.rows.map((row) => [row.key, row.value]));
    const overallBudget = Number(settings.monthlyBudget ?? 0);

    // Recurring templates whose expense for this month has not been created yet.
    const appliedDates = new Set(
      (
        await pool.query(
          `SELECT description, category, to_char(date, 'YYYY-MM-DD') AS day
           FROM expenses WHERE user_id = $1 AND to_char(date, 'YYYY-MM') = $2`,
          [userId, month]
        )
      ).rows.map((row) => `${row.description}|${row.category}|${row.day}`)
    );

    const upcoming = recurringRows.rows
      .map((row) => ({
        id: row.id,
        description: row.description,
        amount: Number(row.amount),
        category: row.category,
        dayOfMonth: row.day_of_month,
        date: `${month}-${String(row.day_of_month).padStart(2, '0')}`
      }))
      .filter((entry) => !appliedDates.has(`${entry.description}|${entry.category}|${entry.date}`))
      .sort((a, b) => a.dayOfMonth - b.dayOfMonth);

    res.json({
      month,
      income,
      remaining: income - total,
      overallBudget,
      budgetUsed: overallBudget > 0 ? total / overallBudget : null,
      budgetLeft: overallBudget > 0 ? overallBudget - total : null,
      upcoming,
      weekly,
      total,
      count: countFor(month),
      previousMonth: previous,
      previousTotal,
      elapsedDays,
      totalDays,
      dailyAverage: elapsedDays > 0 ? total / elapsedDays : 0,
      projected,
      change: previousTotal === 0 ? null : (total - previousTotal) / previousTotal,
      categories,
      daily: daily.rows.map((row) => ({ date: row.day, total: Number(row.total) })),
      trend: trendMonths
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
