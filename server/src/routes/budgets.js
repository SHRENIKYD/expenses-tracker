const express = require('express');
const { pool } = require('../db');
const { CATEGORIES, validateBudget } = require('../validate');

const router = express.Router();

function rowToBudget(row) {
  return { category: row.category, monthlyLimit: Number(row.monthly_limit) };
}

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM budgets WHERE user_id = $1 ORDER BY category', [req.user.id]);
    res.json(rows.map(rowToBudget));
  } catch (err) {
    next(err);
  }
});

router.put('/:category', async (req, res, next) => {
  try {
    if (!CATEGORIES.includes(req.params.category)) {
      return res.status(404).json({ error: 'Unknown category' });
    }

    const { errors, value } = validateBudget(req.body);
    if (errors.length) return res.status(400).json({ errors });

    if (value.monthlyLimit === 0) {
      await pool.query('DELETE FROM budgets WHERE category = $1 AND user_id = $2', [
        req.params.category,
        req.user.id
      ]);
      return res.status(204).end();
    }

    const { rows } = await pool.query(
      `INSERT INTO budgets (user_id, category, monthly_limit) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, category)
       DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit, updated_at = now()
       RETURNING *`,
      [req.user.id, req.params.category, value.monthlyLimit]
    );
    res.json(rowToBudget(rows[0]));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
