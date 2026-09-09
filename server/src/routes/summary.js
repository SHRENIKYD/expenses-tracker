const express = require('express');
const { pool } = require('../db');
const { isIsoMonth } = require('../validate');

const router = express.Router();

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
    const month = req.query.month ? String(req.query.month) : currentMonth();
    if (!isIsoMonth(month)) {
      return res.status(400).json({ errors: ['month must be in YYYY-MM format'] });
    }

    const previous = shiftMonth(month, -1);
    const trendStart = `${shiftMonth(month, -11)}-01`;

    const [totals, byCategory, daily, trend, budgets] = await Promise.all([
      pool.query(
        `SELECT to_char(date, 'YYYY-MM') AS month, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
         FROM expenses WHERE to_char(date, 'YYYY-MM') IN ($1, $2)
         GROUP BY 1`,
        [month, previous]
      ),
      pool.query(
        `SELECT category, SUM(amount) AS total, COUNT(*) AS count
         FROM expenses WHERE to_char(date, 'YYYY-MM') = $1
         GROUP BY category ORDER BY SUM(amount) DESC`,
        [month]
      ),
      pool.query(
        `SELECT to_char(date, 'YYYY-MM-DD') AS day, SUM(amount) AS total
         FROM expenses WHERE to_char(date, 'YYYY-MM') = $1
         GROUP BY 1 ORDER BY 1`,
        [month]
      ),
      pool.query(
        `SELECT to_char(date, 'YYYY-MM') AS month, SUM(amount) AS total
         FROM expenses WHERE date >= $1::date AND to_char(date, 'YYYY-MM') <= $2
         GROUP BY 1 ORDER BY 1`,
        [trendStart, month]
      ),
      pool.query('SELECT * FROM budgets')
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

    res.json({
      month,
      total,
      count: countFor(month),
      previousMonth: previous,
      previousTotal,
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
