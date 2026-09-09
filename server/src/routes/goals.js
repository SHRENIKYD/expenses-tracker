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
      `SELECT g.id, g.name, g.icon, g.target_amount AS target, g.saved_amount + COALESCE(SUM(c.amount), 0) AS saved
      FROM goals g LEFT JOIN goal_contributions c ON c.goal_id = g.id AND c.user_id = g.user_id
      WHERE g.user_id = $1 GROUP BY g.id ORDER BY g.created_at`,
      [req.user.id]
    );
    res.json(
      rows.map((row) => ({
        ...row,
        target: Number(row.target),
        saved: Number(row.saved),
        progress: Math.min(Number(row.saved) / Number(row.target), 1)
      }))
    );
  } catch (err) {
    next(err);
  }
});
router.post('/', async (req, res, next) => {
  try {
    const { name, target, saved = 0, icon = 'target' } = req.body || {};
    if (!valid.name(name) || !valid.amount(target) || !valid.amount(saved, false) || Number(saved) < 0 || !require('../validate').GOAL_ICONS.includes(icon))
      return res.status(400).json({
        error: 'Enter a goal name and a positive target (up to two decimal places).'
      });
    const { rows } = await pool.query(
      'INSERT INTO goals (user_id, name, target_amount, saved_amount, icon) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.user.id, name.trim(), target, saved, icon]
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
router.post(['/:id/contributions', '/:id/add'], async (req, res, next) => {
  try {
    const { amount } = req.body || {};
    if (!valid.amount(amount))
      return res.status(400).json({
        error: 'Enter a positive contribution (up to two decimal places).'
      });
    const { rows } = await pool.query(
      `INSERT INTO goal_contributions (goal_id, user_id, amount)
      SELECT id, user_id, $3 FROM goals WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, req.user.id, amount]
    );
    if (!rows.length) return res.status(404).json({ error: 'Goal not found' });
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});
router.put('/:id', async (req, res, next) => {
  try {
    const { errors, value } = require('../validate').validateGoal(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ errors });
    if ('saved' in value) return res.status(400).json({ error: 'Record a contribution to change savings.' });
    if ('target' in value && !valid.amount(value.target)) return res.status(400).json({ error: 'Target must be at least ₹0.01.' });
    const columns = { name: 'name', target: 'target_amount', icon: 'icon' };
    const keys = Object.keys(value);
    if (!keys.length) return res.status(400).json({ error: 'No fields to update' });
    const args = [req.params.id, req.user.id, ...keys.map(key => value[key])];
    const result = await pool.query(`UPDATE goals SET ${keys.map((key, i) => `${columns[key]} = $${i + 3}`).join(', ')} WHERE id = $1 AND user_id = $2 RETURNING id`, args);
    if (!result.rowCount) return res.status(404).json({ error: 'Goal not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM goals WHERE id = $1 AND user_id = $2', [
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
