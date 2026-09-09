const express = require('express');
const { pool, rowToExpense } = require('../db');
const { CATEGORIES, validateExpense, parseFilters } = require('../validate');
const { toCsv, csvToExpenses } = require('../csv');

const router = express.Router();

function buildWhere(filters) {
  const clauses = [];
  const params = [];

  if (filters.category) {
    params.push(filters.category);
    clauses.push(`category = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    clauses.push(`date >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    clauses.push(`date <= $${params.length}`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    clauses.push(`description ILIKE $${params.length}`);
  }

  return { text: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function queryExpenses(filters) {
  const where = buildWhere(filters);
  const { rows } = await pool.query(
    `SELECT * FROM expenses ${where.text}
     ORDER BY ${filters.sort} ${filters.order}, created_at DESC`,
    where.params
  );
  return rows.map(rowToExpense);
}

router.get('/categories', (req, res) => res.json(CATEGORIES));

router.get('/export', async (req, res, next) => {
  try {
    const { errors, filters } = parseFilters(req.query);
    if (errors.length) return res.status(400).json({ errors });

    const expenses = await queryExpenses(filters);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
    res.send(toCsv(expenses));
  } catch (err) {
    next(err);
  }
});

router.post('/import', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const text = typeof req.body === 'string' ? req.body : '';
    const { errors, records } = csvToExpenses(text);
    if (errors.length) return res.status(400).json({ errors });
    if (records.length === 0) return res.status(400).json({ errors: ['no rows to import'] });
    if (records.length > 5000) return res.status(400).json({ errors: ['too many rows (max 5000)'] });

    const rejected = [];
    const accepted = [];

    records.forEach((record, position) => {
      const { errors: rowErrors, value } = validateExpense(record);
      if (rowErrors.length) rejected.push({ row: position + 2, errors: rowErrors });
      else accepted.push(value);
    });

    if (accepted.length === 0) {
      return res.status(400).json({ errors: ['no valid rows'], rejected });
    }

    await client.query('BEGIN');
    for (const expense of accepted) {
      await client.query(
        `INSERT INTO expenses (description, amount, category, date) VALUES ($1, $2, $3, $4)`,
        [expense.description, expense.amount, expense.category, expense.date]
      );
    }
    await client.query('COMMIT');

    res.status(201).json({ imported: accepted.length, rejected });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    next(err);
  } finally {
    client.release();
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { errors, filters } = parseFilters(req.query);
    if (errors.length) return res.status(400).json({ errors });
    res.json(await queryExpenses(filters));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { errors, value } = validateExpense(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const { rows } = await pool.query(
      `INSERT INTO expenses (description, amount, category, date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [value.description, value.amount, value.category, value.date]
    );
    res.status(201).json(rowToExpense(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { errors, value } = validateExpense(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ errors });

    const fields = Object.keys(value);
    if (fields.length === 0) {
      return res.status(400).json({ errors: ['no updatable fields provided'] });
    }

    const assignments = fields.map((field, position) => `${field} = $${position + 1}`);
    const params = fields.map((field) => value[field]);
    params.push(req.params.id);

    const { rows } = await pool.query(
      `UPDATE expenses SET ${assignments.join(', ')}, updated_at = now()
       WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
    res.json(rowToExpense(rows[0]));
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Expense not found' });
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Expense not found' });
    res.status(204).end();
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Expense not found' });
    next(err);
  }
});

module.exports = router;
