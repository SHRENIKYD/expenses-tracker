const { Pool } = require('pg');

// The pool is created on first use rather than at import, so requiring this
// module (or anything that depends on it) does not need a live configuration.
// A missing DATABASE_URL still fails loudly, at the first query.
let realPool = null;

function getPool() {
  if (!realPool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    realPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
  }
  return realPool;
}

const pool = {
  query: (...args) => getPool().query(...args),
  connect: (...args) => getPool().connect(...args),
  end: (...args) => getPool().end(...args)
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     email TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     display_name TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash TEXT PRIMARY KEY,
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at TIMESTAMPTZ NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at)`,
  `CREATE TABLE IF NOT EXISTS receipts (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     mime_type TEXT NOT NULL,
     byte_size INTEGER NOT NULL CHECK (byte_size > 0),
     data BYTEA NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS settings (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS expenses (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     description TEXT NOT NULL,
     amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
     category TEXT NOT NULL,
     date DATE NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  // Added after the original release; idempotent so the live database migrates on boot.
  `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'expense'`,
  `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method TEXT`,
  `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_id UUID REFERENCES receipts(id) ON DELETE SET NULL`,
  `DO $$ BEGIN
     ALTER TABLE expenses ADD CONSTRAINT expenses_kind_check CHECK (kind IN ('income','expense'));
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
     ALTER TABLE expenses ADD CONSTRAINT expenses_payment_method_check
       CHECK (payment_method IS NULL OR payment_method IN ('upi','card','cash','bank_transfer'));
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses (date DESC)`,
  `CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses (category)`,
  `CREATE INDEX IF NOT EXISTS expenses_kind_idx ON expenses (kind)`,
  `CREATE TABLE IF NOT EXISTS recurring (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     description TEXT NOT NULL,
     amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
     category TEXT NOT NULL,
     day_of_month SMALLINT NOT NULL CHECK (day_of_month BETWEEN 1 AND 28),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `ALTER TABLE recurring ADD COLUMN IF NOT EXISTS payment_method TEXT`,
  `CREATE TABLE IF NOT EXISTS budgets (
     category TEXT PRIMARY KEY,
     monthly_limit NUMERIC(12,2) NOT NULL CHECK (monthly_limit >= 0),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,

  // Ownership. Nullable so the migration succeeds against rows that predate
  // accounts; the first account to register adopts them (see claimOrphanRows).
  `ALTER TABLE expenses  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE`,
  `ALTER TABLE recurring ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE`,
  `ALTER TABLE budgets   ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE`,
  `ALTER TABLE settings  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE`,
  `ALTER TABLE receipts  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE`,

  `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'`,
  `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS external_ref TEXT`,
  // A bank reference identifies a transaction uniquely, so the database itself
  // refuses a second import of the same statement row.
  `CREATE UNIQUE INDEX IF NOT EXISTS expenses_user_ref_idx
     ON expenses (user_id, external_ref) WHERE external_ref IS NOT NULL`,

  `CREATE INDEX IF NOT EXISTS expenses_user_idx ON expenses (user_id)`,
  `CREATE INDEX IF NOT EXISTS recurring_user_idx ON recurring (user_id)`,

  // budgets and settings were keyed globally; they are now unique per user.
  `DO $$ BEGIN ALTER TABLE budgets DROP CONSTRAINT budgets_pkey;
   EXCEPTION WHEN undefined_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE settings DROP CONSTRAINT settings_pkey;
   EXCEPTION WHEN undefined_object THEN NULL; END $$`,
  `CREATE TABLE IF NOT EXISTS accounts (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
     opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE(id, user_id)
   )`,
  `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS account_id UUID`,
  `DO $$ BEGIN ALTER TABLE expenses ADD CONSTRAINT expenses_account_owner
     FOREIGN KEY (account_id, user_id) REFERENCES accounts(id, user_id);
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE INDEX IF NOT EXISTS expenses_account_idx ON expenses(account_id)`,
  `CREATE TABLE IF NOT EXISTS goals (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES users(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     icon TEXT NOT NULL DEFAULT 'target',
     target_amount NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
     saved_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS goals_id_owner_idx ON goals(id, user_id)`,
  `CREATE TABLE IF NOT EXISTS goal_contributions (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     goal_id UUID NOT NULL,
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     FOREIGN KEY (goal_id, user_id) REFERENCES goals(id, user_id) ON DELETE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS goals_user_idx ON goals(user_id)`,
  `CREATE INDEX IF NOT EXISTS contributions_goal_idx ON goal_contributions(goal_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS budgets_user_category_idx ON budgets (user_id, category)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS settings_user_key_idx ON settings (user_id, key)`,

  // Password recovery without an email server: codes are shown once at
  // registration, stored only as hashes, and each one works a single time.
  `CREATE TABLE IF NOT EXISTS recovery_codes (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     code_hash TEXT NOT NULL,
     used_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS recovery_codes_user_idx ON recovery_codes (user_id)`
];

async function init() {
  for (const statement of SCHEMA) {
    await pool.query(statement);
  }
}

// Data created before accounts existed has no owner. The first account to
// register takes it, so an existing deployment does not silently lose its rows.
async function claimOrphanRows(userId) {
  const claimed = {};
  for (const table of ['expenses', 'recurring', 'budgets', 'settings', 'receipts']) {
    const { rowCount } = await pool.query(
      `UPDATE ${table} SET user_id = $1 WHERE user_id IS NULL`,
      [userId]
    );
    if (rowCount > 0) claimed[table] = rowCount;
  }
  return claimed;
}

function rowToExpense(row) {
  return {
    id: row.id,
    kind: row.kind || 'expense',
    description: row.description,
    amount: Number(row.amount),
    category: row.category,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date),
    paymentMethod: row.payment_method || null,
    accountId: row.account_id || null,
    note: row.note || '',
    receiptId: row.receipt_id || null,
    source: row.source || 'manual',
    externalRef: row.external_ref || null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function rowToGoal(row) {
  const target = Number(row.target_amount);
  const saved = Number(row.saved_amount);
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    target,
    saved,
    progress: target > 0 ? Math.min(saved / target, 1) : 0
  };
}

function rowToRecurring(row) {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    category: row.category,
    dayOfMonth: row.day_of_month,
    paymentMethod: row.payment_method || null
  };
}

module.exports = { pool, init, claimOrphanRows, rowToExpense, rowToRecurring, rowToGoal };
