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

// Ten groups of four from an unambiguous alphabet: no O/0 or I/1 to mistype.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_COUNT = 8;

function newRecoveryCode() {
  const bytes = randomBytes(12);
  const chars = [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
}

const normaliseCode = (code) => String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');

// Codes are high-entropy, so a fast hash is enough and keeps recovery quick.
const codeFingerprint = (code) => createHash('sha256').update(normaliseCode(code)).digest('hex');

// Replaces any existing codes: a fresh set invalidates the old printout.
async function issueRecoveryCodes(userId, count = CODE_COUNT) {
  const codes = Array.from({ length: count }, newRecoveryCode);
  await pool.query('DELETE FROM recovery_codes WHERE user_id = $1', [userId]);
  for (const code of codes) {
    await pool.query('INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, $2)', [
      userId,
      codeFingerprint(code)
    ]);
  }
  return codes;
}

// Marks the code used inside the same statement, so a code cannot be spent twice.
async function spendRecoveryCode(userId, code) {
  const { rowCount } = await pool.query(
    `UPDATE recovery_codes SET used_at = now()
     WHERE id = (
       SELECT id FROM recovery_codes
       WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
       LIMIT 1
     )`,
    [userId, codeFingerprint(code)]
  );
  return rowCount === 1;
}

async function countRecoveryCodes(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE used_at IS NULL) AS unused, COUNT(*) AS total
     FROM recovery_codes WHERE user_id = $1`,
    [userId]
  );
  return { unused: Number(rows[0].unused), total: Number(rows[0].total) };
}

// Signing out everywhere is what makes a password change meaningful after a
// device is lost; the session doing the change is kept.
async function destroyOtherSessions(userId, keepToken) {
  await pool.query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [
    userId,
    fingerprint(keepToken)
  ]);
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'password must be at least 8 characters';
  }
  if (password.length > 200) return 'password must be 200 characters or fewer';
  return null;
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
  newRecoveryCode,
  normaliseCode,
  issueRecoveryCodes,
  spendRecoveryCode,
  countRecoveryCodes,
  destroyOtherSessions,
  validatePassword,
  createSession,
  destroySession,
  requireUser,
  validateCredentials,
  SESSION_DAYS
};
