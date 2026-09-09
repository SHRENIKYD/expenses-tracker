const { scrypt, randomBytes, timingSafeEqual, createHash } = require('crypto');
const { promisify } = require('util');
const { pool } = require('./db');

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SESSION_DAYS = 30;

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;

  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, 'hex');
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

// Only the hash of a token is stored, so a database leak cannot be replayed as a session.
const fingerprint = (token) => createHash('sha256').update(token).digest('hex');

async function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
    fingerprint(token),
    userId,
    expiresAt
  ]);
  return { token, expiresAt };
}

async function destroySession(token) {
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [fingerprint(token)]);
}

function bearerToken(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

async function requireUser(req, res, next) {
  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: 'Sign in required' });

    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.display_name
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [fingerprint(token)]
    );

    if (rows.length === 0) return res.status(401).json({ error: 'Session expired' });

    req.user = { id: rows[0].id, email: rows[0].email, displayName: rows[0].display_name };
    req.sessionToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

function validateCredentials(body) {
  const errors = [];
  const value = {};
  const input = body && typeof body === 'object' ? body : {};

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    errors.push('a valid email address is required');
  } else {
    value.email = email;
  }

  const password = typeof input.password === 'string' ? input.password : '';
  if (password.length < 8) errors.push('password must be at least 8 characters');
  else if (password.length > 200) errors.push('password must be 200 characters or fewer');
  else value.password = password;

  if (input.displayName !== undefined) {
    value.displayName =
      typeof input.displayName === 'string' ? input.displayName.trim().slice(0, 60) : '';
  }

  return { errors, value };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  requireUser,
  validateCredentials,
  SESSION_DAYS
};
