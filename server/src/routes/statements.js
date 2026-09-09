const express = require('express');
const { pool, rowToExpense } = require('../db');
const { extractText, detectBank, parseStatement } = require('../statement');
const { validateExpense } = require('../validate');

const router = express.Router();

const MAX_BYTES = 5 * 1024 * 1024;
const NEAR_DAYS = 3;

// Compare narrations loosely: statement text and a hand-typed description
// rarely match exactly, but they share their distinctive words.
function tokens(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3)
  );
}

function similarity(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

const daysApart = (a, b) =>
  Math.abs((new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`)) / 86400000);

function findDuplicate(candidate, existing) {
  if (candidate.reference) {
    const byRef = existing.find((row) => row.external_ref === candidate.reference);
    if (byRef) return { reason: 'same bank reference', existingId: byRef.id };
  }

  const near = existing.find(
    (row) =>
      Number(row.amount) === candidate.amount &&
      row.kind === candidate.kind &&
      daysApart(row.date, candidate.date) <= NEAR_DAYS &&
      similarity(row.description, candidate.description) >= 0.5
  );
  if (near) {
    return {
      reason: `matches “${near.description}” on ${near.date}`,
      existingId: near.id
    };
  }

  return null;
}

router.post('/preview', async (req, res, next) => {
  try {
    const data = req.body;
    if (!Buffer.isBuffer(data) || data.length === 0) {
      return res.status(400).json({ errors: ['upload a PDF statement'] });
    }
    if (data.length > MAX_BYTES) {
      return res.status(413).json({ errors: ['statement must be 5MB or smaller'] });
    }

    const { lines, text, pages } = await extractText(data, req.get('x-statement-password'));
    const bank = detectBank(text);
    const { transactions, skipped } = parseStatement(lines);

    if (transactions.length === 0) {
      return res.status(422).json({
        error:
          'No transactions could be read from this statement. Bank layouts differ; if this is a scanned or image-only PDF the text cannot be extracted at all.',
        bank,
        pages,
        skipped: skipped.slice(0, 8)
      });
    }

    const dates = transactions.map((entry) => entry.date).sort();
    const { rows: existing } = await pool.query(
      `SELECT id, kind, description, amount, date::text, external_ref
       FROM expenses
       WHERE user_id = $1 AND date BETWEEN $2::date - $4::int AND $3::date + $4::int`,
      [req.user.id, dates[0], dates[dates.length - 1], NEAR_DAYS]
    );

    const rows = transactions.map((entry) => {
      const duplicate = findDuplicate(entry, existing);
      return { ...entry, duplicate: Boolean(duplicate), duplicateReason: duplicate?.reason ?? null };
    });

    res.json({
      bank,
      pages,
      count: rows.length,
      duplicates: rows.filter((row) => row.duplicate).length,
      transactions: rows,
      skipped
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
    next(err);
  }
});

router.post('/import', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const incoming = Array.isArray(req.body?.transactions) ? req.body.transactions : [];
    if (incoming.length === 0) return res.status(400).json({ errors: ['no transactions selected'] });
    if (incoming.length > 2000) return res.status(400).json({ errors: ['too many rows (max 2000)'] });

    const accepted = [];
    const rejected = [];

    incoming.forEach((entry, position) => {
      const { errors, value } = validateExpense(entry);
      if (errors.length) rejected.push({ row: position + 1, errors });
      else accepted.push({ ...value, reference: entry.reference || null });
    });

    if (accepted.length === 0) return res.status(400).json({ errors: ['no valid rows'], rejected });

    // The unique index only protects rows that carry a bank reference, so rows
    // without one are checked here; otherwise a repeated import duplicates them.
    const dates = accepted.map((entry) => entry.date).sort();
    const { rows: existing } = await client.query(
      `SELECT id, kind, description, amount, date::text, external_ref
       FROM expenses
       WHERE user_id = $1 AND date BETWEEN $2::date - $4::int AND $3::date + $4::int`,
      [req.user.id, dates[0], dates[dates.length - 1], NEAR_DAYS]
    );

    await client.query('BEGIN');
    const created = [];
    let duplicates = 0;

    for (const entry of accepted) {
      if (!entry.reference && findDuplicate(entry, existing)) {
        duplicates += 1;
        continue;
      }

      // ON CONFLICT covers the partial unique index on (user_id, external_ref),
      // so a re-import of the same statement inserts nothing rather than doubling up.
      const { rows } = await client.query(
        `INSERT INTO expenses
           (user_id, kind, description, amount, category, date, source, external_ref)
         VALUES ($1, $2, $3, $4, $5, $6, 'statement', $7)
         ON CONFLICT (user_id, external_ref) WHERE external_ref IS NOT NULL DO NOTHING
         RETURNING *`,
        [
          req.user.id,
          entry.kind,
          entry.description,
          entry.amount,
          entry.category,
          entry.date,
          entry.reference
        ]
      );
      if (rows.length > 0) created.push(rowToExpense(rows[0]));
      else duplicates += 1;
    }
    await client.query('COMMIT');

    res.status(201).json({ imported: created.length, duplicates, rejected });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
