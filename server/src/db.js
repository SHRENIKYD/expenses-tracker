const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS expenses (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     description TEXT NOT NULL,
     amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
     category TEXT NOT NULL,
     date DATE NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses (date DESC)`,
  `CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses (category)`,
  `CREATE TABLE IF NOT EXISTS recurring (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     description TEXT NOT NULL,
     amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
     category TEXT NOT NULL,
     day_of_month SMALLINT NOT NULL CHECK (day_of_month BETWEEN 1 AND 28),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS budgets (
     category TEXT PRIMARY KEY,
     monthly_limit NUMERIC(12,2) NOT NULL CHECK (monthly_limit >= 0),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`
];

async function init() {
  for (const statement of SCHEMA) {
    await pool.query(statement);
  }
}

function rowToExpense(row) {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    category: row.category,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function rowToRecurring(row) {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    category: row.category,
    dayOfMonth: row.day_of_month
  };
}

module.exports = { pool, init, rowToExpense, rowToRecurring };
