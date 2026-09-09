const express = require('express');
const { pool } = require('../db');
const { validateSetting } = require('../validate');

const router = express.Router();

const DEFAULTS = { displayName: '', monthlyBudget: '0' };

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings WHERE user_id = $1', [req.user.id]);
    const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    res.json({
      displayName: stored.displayName ?? DEFAULTS.displayName,
      monthlyBudget: Number(stored.monthlyBudget ?? DEFAULTS.monthlyBudget)
    });
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const input = req.body && typeof req.body === 'object' ? req.body : {};
    const keys = Object.keys(input);
    if (keys.length === 0) return res.status(400).json({ errors: ['no settings provided'] });

    const errors = [];
    const writes = [];

    for (const key of keys) {
      const { errors: settingErrors, value } = validateSetting(key, input[key]);
      if (settingErrors.length) errors.push(...settingErrors);
      else writes.push([key, value]);
    }

    if (errors.length) return res.status(400).json({ errors });

    for (const [key, value] of writes) {
      await pool.query(
        `INSERT INTO settings (user_id, key, value) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [req.user.id, key, value]
      );
    }

    const { rows } = await pool.query('SELECT key, value FROM settings WHERE user_id = $1', [req.user.id]);
    const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    res.json({
      displayName: stored.displayName ?? DEFAULTS.displayName,
      monthlyBudget: Number(stored.monthlyBudget ?? DEFAULTS.monthlyBudget)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
