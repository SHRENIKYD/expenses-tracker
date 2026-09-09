const express = require('express');
const { pool } = require('../db');
const valid = require('../portfolioValidation');
const router = express.Router();
router.param('id', (req, res, next, id) =>
  valid.uuid(id) ? next() : res.status(404).json({ error: 'Account not found' })
);
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.name, a.opening_balance,
      a.opening_balance + COALESCE(SUM(CASE WHEN e.kind = 'income' THEN e.amount ELSE -e.amount END), 0) AS balance,
      COUNT(e.id) AS transactions
      FROM accounts a LEFT JOIN expenses e ON e.account_id = a.id AND e.user_id = a.user_id
      WHERE a.user_id = $1 GROUP BY a.id ORDER BY a.created_at`,
      [req.user.id]
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        openingBalance: Number(row.opening_balance),
        balance: Number(row.balance),
        transactions: Number(row.transactions)
      }))
    );
  } catch (err) {
    next(err);
  }
});
router.post('/', async (req, res, next) => {
  try {
    const { name, openingBalance = 0 } = req.body || {};
    if (!valid.name(name) || !valid.amount(openingBalance, false))
      return res.status(400).json({
        error: 'Enter an account name and a valid opening balance (up to two decimal places).'
      });
    const { rows } = await pool.query(
      'INSERT INTO accounts (user_id, name, opening_balance) VALUES ($1, $2, $3) RETURNING id',
      [req.user.id, name.trim(), openingBalance]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id
    ]);
    if (!result.rowCount) return res.status(404).json({ error: 'Account not found' });
    res.status(204).end();
  } catch (err) {
    if (err.code === '23503')
      return res.status(409).json({
        error: 'This account has transactions. Remove their account assignment before deleting it.'
      });
    next(err);
  }
});
module.exports = router;
