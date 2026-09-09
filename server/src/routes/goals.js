const express = require('express');
const { pool, rowToGoal } = require('../db');
const { validateGoal, validateContribution } = require('../validate');

const router = express.Router();

const NOT_FOUND = { error: 'Goal not found' };

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at',
      [req.user.id]
    );
    res.json(rows.map(rowToGoal));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { errors, value } = validateGoal(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const { rows } = await pool.query(
      `INSERT INTO goals (user_id, name, icon, target_amount, saved_amount)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, value.name, value.icon, value.target, value.saved ?? 0]
    );
    res.status(201).json(rowToGoal(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { errors, value } = validateGoal(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ errors });
    if (Object.keys(value).length === 0) {
      return res.status(400).json({ errors: ['no fields to update'] });
    }

    const columns = { name: 'name', icon: 'icon', target: 'target_amount', saved: 'saved_amount' };
    const sets = [];
    const params = [req.params.id, req.user.id];

    for (const [key, column] of Object.entries(columns)) {
      if (value[key] !== undefined) {
        params.push(value[key]);
        sets.push(`${column} = $${params.length}`);
      }
    }

    const { rows } = await pool.query(
      `UPDATE goals SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
      params
    );
    if (rows.length === 0) return res.status(404).json(NOT_FOUND);
    res.json(rowToGoal(rows[0]));
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json(NOT_FOUND);
    next(err);
  }
});

// Contributing never takes the goal past its target, so the progress bar and
// the percentage cannot read over 100%.
router.post('/:id/add', async (req, res, next) => {
  try {
    const { errors, amount } = validateContribution(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const { rows } = await pool.query(
      `UPDATE goals
       SET saved_amount = LEAST(saved_amount + $3, target_amount)
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id, amount]
    );
    if (rows.length === 0) return res.status(404).json(NOT_FOUND);
    res.json(rowToGoal(rows[0]));
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json(NOT_FOUND);
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM goals WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id
    ]);
    if (rowCount === 0) return res.status(404).json(NOT_FOUND);
    res.status(204).end();
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json(NOT_FOUND);
    next(err);
  }
});

module.exports = router;
