const express = require('express');
const { pool, claimOrphanRows } = require('../db');
const {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  requireUser,
  validateCredentials
} = require('../auth');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { errors, value } = validateCredentials(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const existing = await pool.query('SELECT 1 FROM users WHERE email = $1', [value.email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'That email is already registered' });
    }

    const isFirstUser = (await pool.query('SELECT 1 FROM users LIMIT 1')).rowCount === 0;

    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3) RETURNING id, email, display_name`,
      [value.email, await hashPassword(value.password), value.displayName || '']
    );

    const user = rows[0];
    const claimed = isFirstUser ? await claimOrphanRows(user.id) : {};
    const session = await createSession(user.id);

    res.status(201).json({
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: { id: user.id, email: user.email, displayName: user.display_name },
      claimed
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    const { rows } = await pool.query(
      'SELECT id, email, password_hash, display_name FROM users WHERE email = $1',
      [email]
    );

    // Same response whether the email is unknown or the password is wrong,
    // so the endpoint cannot be used to discover which emails are registered.
    const user = rows[0];
    const ok = user ? await verifyPassword(password, user.password_hash) : false;
    if (!ok) return res.status(401).json({ error: 'Email or password is incorrect' });

    const session = await createSession(user.id);
    res.json({
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: { id: user.id, email: user.email, displayName: user.display_name }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireUser, async (req, res, next) => {
  try {
    await destroySession(req.sessionToken);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireUser, (req, res) => res.json({ user: req.user }));

module.exports = router;
