const express = require('express');
const { pool } = require('../db');

const router = express.Router();

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

router.post('/', async (req, res, next) => {
  try {
    const mimeType = (req.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED.includes(mimeType)) {
      return res.status(415).json({ errors: [`content-type must be one of: ${ALLOWED.join(', ')}`] });
    }

    const data = req.body;
    if (!Buffer.isBuffer(data) || data.length === 0) {
      return res.status(400).json({ errors: ['request body must be the file contents'] });
    }
    if (data.length > MAX_BYTES) {
      return res.status(413).json({ errors: ['receipt must be 2MB or smaller'] });
    }

    const { rows } = await pool.query(
      `INSERT INTO receipts (user_id, mime_type, byte_size, data)
       VALUES ($1, $2, $3, $4) RETURNING id, mime_type, byte_size`,
      [req.user.id, mimeType, data.length, data]
    );
    res.status(201).json({ id: rows[0].id, mimeType: rows[0].mime_type, byteSize: rows[0].byte_size });
  } catch (err) {
    next(err);
  }
});

router.get('/usage', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS count, COALESCE(SUM(byte_size), 0)::bigint AS bytes FROM receipts WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ count: rows[0].count, bytes: Number(rows[0].bytes) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT mime_type, data FROM receipts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Receipt not found' });

    res.setHeader('Content-Type', rows[0].mime_type);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(rows[0].data);
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Receipt not found' });
    next(err);
  }
});

// Deleting the file leaves the transaction: expenses.receipt_id is ON DELETE
// SET NULL, so the row simply stops carrying an attachment.
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM receipts WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id
    ]);
    if (rowCount === 0) return res.status(404).json({ error: 'Receipt not found' });
    res.status(204).end();
  } catch (err) {
    if (err.code === '22P02') return res.status(404).json({ error: 'Receipt not found' });
    next(err);
  }
});

module.exports = router;
