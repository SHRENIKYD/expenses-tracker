const express = require('express');
const { pool, rowToRecurring, rowToExpense } = require('../db');
const { validateRecurring, isIsoMonth } = require('../validate');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM recurring WHERE user_id = $1 ORDER BY day_of_month, description',
      [req.user.id]
    );
    res.json(rows.map(rowToRecurring));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { errors, value } = validateRecurring(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const { rows } = await pool.query(
      `INSERT INTO recurring (user_id, description, amount, category, day_of_month)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, value.description, value.amount, value.category, value.dayOfMonth]
    );
    res.status(201).json(rowToRecurring(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM recurring WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id
    ]);
    if (rowCount === 0) return res.status(404).json({ error: 'Recurring expense not found' });
    res.status(204).end();
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Recurring expense not found' });
    next(err);
  }
});

// Create this month's expense for every template that has not been applied yet.
router.post('/apply', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const month = req.body && req.body.month ? String(req.body.month) : '';
    if (!isIsoMonth(month)) {
      return res.status(400).json({ errors: ['month must be in YYYY-MM format'] });
    }

    await client.query('BEGIN');
    const templates = await client.query('SELECT * FROM recurring WHERE user_id = $1', [req.user.id]);

    const created = [];
    let skipped = 0;

    for (const template of templates.rows) {
      const date = `${month}-${String(template.day_of_month).padStart(2, '0')}`;

      const existing = await client.query(
        `SELECT 1 FROM expenses
         WHERE user_id = $1 AND description = $2 AND category = $3 AND date = $4 LIMIT 1`,
        [req.user.id, template.description, template.category, date]
      );
      if (existing.rowCount > 0) {
        skipped += 1;
        continue;
      }

      const inserted = await client.query(
        `INSERT INTO expenses (user_id, description, amount, category, date)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.user.id, template.description, Number(template.amount), template.category, date]
      );
      created.push(rowToExpense(inserted.rows[0]));
    }

    await client.query('COMMIT');
    res.status(201).json({ created: created.length, skipped, expenses: created });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
