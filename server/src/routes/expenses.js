const express = require('express');
const { pool, rowToExpense } = require('../db');
const {
  CATEGORIES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  validateExpense,
  parseFilters
} = require('../validate');
const { toCsv, csvToExpenses } = require('../csv');

const router = express.Router();

function buildWhere(filters, userId) {
  const params = [userId];
  const clauses = ['user_id = $1'];

  if (filters.kind) {
    params.push(filters.kind);
    clauses.push(`kind = $${params.length}`);
  }
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
    const like = `$${params.length}`;
    const numeric = Number(filters.q);
    if (Number.isFinite(numeric)) {
      params.push(numeric);
      clauses.push(
        `(description ILIKE ${like} OR category ILIKE ${like} OR amount = $${params.length})`
      );
    } else {
      clauses.push(`(description ILIKE ${like} OR category ILIKE ${like})`);
    }
  }

  return { text: `WHERE ${clauses.join(' AND ')}`, params };
}

async function queryExpenses(filters, userId) {
  const where = buildWhere(filters, userId);
  const { rows } = await pool.query(
    `SELECT * FROM expenses ${where.text}
     ORDER BY ${filters.sort} ${filters.order}, created_at DESC`,
    where.params
  );
  return rows.map(rowToExpense);
}

router.get('/categories', (req, res) =>
  res.json({
    expense: EXPENSE_CATEGORIES,
    income: INCOME_CATEGORIES,
    paymentMethods: PAYMENT_METHODS
  })
);

router.get('/export', async (req, res, next) => {
  try {
    const { errors, filters } = parseFilters(req.query);
    if (errors.length) return res.status(400).json({ errors });

    const expenses = await queryExpenses(filters, req.user.id);
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
    if (records.length > 5000)
      return res.status(400).json({ errors: ['too many rows (max 5000)'] });

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
        `INSERT INTO expenses (user_id, description, amount, category, date) VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, expense.description, expense.amount, expense.category, expense.date]
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
    res.json(await queryExpenses(filters, req.user.id));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { errors, value } = validateExpense(req.body);
    if (errors.length) return res.status(400).json({ errors });
    if (
      value.accountId &&
      !(
        await pool.query('SELECT id FROM accounts WHERE id = $1 AND user_id = $2', [
          value.accountId,
          req.user.id
        ])
      ).rowCount
    )
      return res.status(400).json({ error: 'Account not found' });

    const { rows } = await pool.query(
      `INSERT INTO expenses (user_id, kind, description, amount, category, date, payment_method, note, receipt_id, account_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        req.user.id,
        value.kind,
        value.description,
        value.amount,
        value.category,
        value.date,
        value.paymentMethod ?? null,
        value.note ?? '',
        value.receiptId ?? null,
        value.accountId ?? null
      ]
    );
    res.status(201).json(rowToExpense(rows[0]));
  } catch (err) {
    if (err.code === '23503')
      return res.status(400).json({ error: 'The selected account is no longer available.' });
    next(err);
  }
});

const COLUMN_FOR = {
  accountId: 'account_id',
  kind: 'kind',
  description: 'description',
  amount: 'amount',
  category: 'category',
  date: 'date',
  paymentMethod: 'payment_method',
  note: 'note',
  receiptId: 'receipt_id'
};

router.put('/:id', async (req, res, next) => {
  try {
    const current = await pool.query('SELECT kind FROM expenses WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id
    ]);
    if (current.rowCount === 0) return res.status(404).json({ error: 'Expense not found' });

    const { errors, value } = validateExpense(req.body, {
      partial: true,
      existingKind: current.rows[0].kind
    });
    if (errors.length) return res.status(400).json({ errors });

    if (
      value.accountId &&
      !(
        await pool.query('SELECT id FROM accounts WHERE id = $1 AND user_id = $2', [
          value.accountId,
          req.user.id
        ])
      ).rowCount
    )
      return res.status(400).json({ error: 'Account not found' });
    const fields = Object.keys(value);
    if (fields.length === 0) {
      return res.status(400).json({ errors: ['no updatable fields provided'] });
    }

    const assignments = fields.map((field, position) => `${COLUMN_FOR[field]} = $${position + 1}`);
    const params = fields.map((field) => value[field]);
    params.push(req.params.id, req.user.id);

    const { rows } = await pool.query(
      `UPDATE expenses SET ${assignments.join(', ')}, updated_at = now()
       WHERE id = $${params.length - 1} AND user_id = $${params.length} RETURNING *`,
      params
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
    res.json(rowToExpense(rows[0]));
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Expense not found' });
    if (err.code === '23503')
      return res.status(400).json({ error: 'The selected account is no longer available.' });
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM expenses WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id
    ]);
    if (rowCount === 0) return res.status(404).json({ error: 'Expense not found' });
    res.status(204).end();
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Expense not found' });
    next(err);
  }
});

module.exports = router;
