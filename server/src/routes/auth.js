const express = require('express');
const { pool, claimOrphanRows } = require('../db');
const {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  destroyOtherSessions,
  issueRecoveryCodes,
  spendRecoveryCode,
  countRecoveryCodes,
  requireUser,
  validateCredentials,
  validatePassword
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
    // Shown once, here and nowhere else: without an email server these codes
    // are the only way back into a locked-out account.
    const recoveryCodes = await issueRecoveryCodes(user.id);

    res.status(201).json({
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: { id: user.id, email: user.email, displayName: user.display_name },
      recoveryCodes,
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

router.post('/password', requireUser, async (req, res, next) => {
  try {
    const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const next_ = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    const invalid = validatePassword(next_);
    if (invalid) return res.status(400).json({ errors: [invalid] });

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!(await verifyPassword(current, rows[0].password_hash))) {
      return res.status(403).json({ error: 'Current password is incorrect' });
    }

    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      await hashPassword(next_),
      req.user.id
    ]);
    // A password change is how a lost device is locked out, so every other
    // session goes with it.
    await destroyOtherSessions(req.user.id, req.sessionToken);

    res.json({ changed: true });
  } catch (err) {
    next(err);
  }
});

router.get('/recovery-codes', requireUser, async (req, res, next) => {
  try {
    res.json(await countRecoveryCodes(req.user.id));
  } catch (err) {
    next(err);
  }
});

// Regenerating needs the password, so a borrowed session cannot mint itself a
// permanent way back in.
router.post('/recovery-codes', requireUser, async (req, res, next) => {
  try {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!(await verifyPassword(password, rows[0].password_hash))) {
      return res.status(403).json({ error: 'Password is incorrect' });
    }

    res.json({ recoveryCodes: await issueRecoveryCodes(req.user.id) });
  } catch (err) {
    next(err);
  }
});

// Recovery: email plus one unused code sets a new password. Wrong email, wrong
// code and unknown account all answer the same way.
router.post('/recover', async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const password = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    const invalid = validatePassword(password);
    if (invalid) return res.status(400).json({ errors: [invalid] });

    const { rows } = await pool.query('SELECT id, email, display_name FROM users WHERE email = $1', [
      email
    ]);
    const user = rows[0];
    const spent = user ? await spendRecoveryCode(user.id, code) : false;
    if (!spent) return res.status(401).json({ error: 'That recovery code is not valid' });

    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      await hashPassword(password),
      user.id
    ]);
    // Recovery implies the account may have been out of the owner's hands.
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);

    const session = await createSession(user.id);
    const remaining = await countRecoveryCodes(user.id);

    res.json({
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user: { id: user.id, email: user.email, displayName: user.display_name },
      codesRemaining: remaining.unused
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
