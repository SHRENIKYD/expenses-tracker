const express = require('express');
const { pool } = require('../db');
const valid = require('../portfolioValidation');
const router = express.Router();
router.param('id', (req, res, next, id) =>
  valid.uuid(id) ? next() : res.status(404).json({ error: 'Goal not found' })
);
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT g.id, g.name, g.target, COALESCE(SUM(c.amount), 0) AS saved
      FROM savings_goals g LEFT JOIN goal_contributions c ON c.goal_id = g.id AND c.user_id = g.user_id
      WHERE g.user_id = $1 GROUP BY g.id ORDER BY g.created_at`,
      [req.user.id]
    );
    res.json(
      rows.map((row) => ({
        ...row,
        target: Number(row.target),
        saved: Number(row.saved)
      }))
    );
  } catch (err) {
    next(err);
  }
});
router.post('/', async (req, res, next) => {
  try {
    const { name, target } = req.body || {};
    if (!valid.name(name) || !valid.amount(target))
      return res.status(400).json({
        error: 'Enter a goal name and a positive target (up to two decimal places).'
      });
    const { rows } = await pool.query(
      'INSERT INTO savings_goals (user_id, name, target) VALUES ($1, $2, $3) RETURNING id',
      [req.user.id, name.trim(), target]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});
router.get('/:id/contributions', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, amount, created_at FROM goal_contributions WHERE goal_id = $1 AND user_id = $2 ORDER BY created_at DESC',
      [req.params.id, req.user.id]
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        date: row.created_at
      }))
    );
  } catch (err) {
    next(err);
  }
});
router.post('/:id/contributions', async (req, res, next) => {
  try {
    const { amount } = req.body || {};
    if (!valid.amount(amount))
      return res.status(400).json({
        error: 'Enter a positive contribution (up to two decimal places).'
      });
    const { rows } = await pool.query(
      `INSERT INTO goal_contributions (goal_id, user_id, amount)
      SELECT id, user_id, $3 FROM savings_goals WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user.id, amount]
    );
    if (!rows.length) return res.status(404).json({ error: 'Goal not found' });
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM savings_goals WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id
    ]);
    if (!result.rowCount) return res.status(404).json({ error: 'Goal not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
module.exports = router;
