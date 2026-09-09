import { createClient } from '@supabase/supabase-js';
import { assembleSummary, resolvePeriod } from './summary.js';
import { detectBank, parseStatement } from '../statement.js';
import { NEAR_DAYS, findDuplicate } from '../duplicates.js';
import { merchantKey } from '../merchant.js';
import { csvToExpenses, toCsv } from '../csv.js';
import * as vault from './vault.js';
import {
  accountBalances,
  accountTotals,
  categoryTotals,
  dailySeries,
  monthlyTrend,
  periodTotals,
  summaryWindow
} from './aggregate.js';
import { makeReporter } from '../diagnostics.js';
import {
  fromTransaction,
  toAccount,
  toBudget,
  toContribution,
  toGoal,
  toRecurring,
  toTransaction
} from './rows.js';

// The same functions api.js exposes, answered by Supabase instead of the
// Express API. Ownership is no longer a WHERE clause the client can forget:
// the policies decide, and a query for someone else's row simply returns
// nothing.

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

function client() {
  if (!supabase) {
    throw new Error('Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  }
  return supabase;
}

// PostgREST reports failures in the payload rather than by throwing.
function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// The only way this file reaches the database. Every table is behind a function
// in supabase/migrations/0006_functions.sql — `security invoker`, so the
// policies still decide — and nothing here builds a query of its own.
const call = async (name, args = {}) => unwrap(await client().rpc(name, args));

// create_transaction and update_transaction take the same columns, so the row
// is shaped once. Everything absent is written as null: an update replaces the
// whole row, which is what sealing a plaintext row needs.
const write = (name, row) =>
  call(name, {
    p_id: row.id,
    p_date: row.date,
    p_account_id: row.account_id ?? null,
    p_receipt_path: row.receipt_path ?? null,
    p_secret: row.secret ?? null,
    p_iv: row.iv ?? null,
    p_key_version: row.key_version ?? null,
    p_ref_hash: row.ref_hash ?? null,
    p_kind: row.kind ?? null,
    p_description: row.description ?? null,
    p_amount: row.amount ?? null,
    p_category: row.category ?? null,
    p_payment_method: row.payment_method ?? null,
    p_note: row.note ?? null,
    p_source: row.source ?? null,
    p_external_ref: row.external_ref ?? null
  });

// A function returning one row answers with a row of nulls when there is none,
// because SQL has no way to return nothing from a scalar-shaped result.
const one = (rows) => {
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row && (row.id || row.user_id) ? row : null;
};

// Diagnostics carry codes and counts, never content — see ../diagnostics.js.
const report = makeReporter({
  appVersion: import.meta.env.VITE_APP_VERSION || 'dev',
  insert: (entry) =>
    call('record_diagnostic', {
      p_code: entry.code,
      p_row_id: entry.row_id,
      p_key_version: entry.key_version,
      p_app_version: entry.app_version,
      p_detail: entry.detail
    })
});

// A row is either sealed or from before the vault existed. Both are read here,
// so no page has to know which it is looking at.
async function toDomain(row) {
  if (!row.secret) return toTransaction(row);

  const fields = await vault.open(row);
  return toTransaction({
    ...row,
    kind: fields.kind,
    description: fields.description,
    amount: fields.amount,
    category: fields.category,
    payment_method: fields.paymentMethod ?? null,
    note: fields.note ?? '',
    source: fields.source ?? 'manual',
    external_ref: fields.externalRef ?? null
  });
}

// One unreadable row must not blank the page: it is reported and left out, and
// the Data health panel in Settings lists what was left out and why.
async function openAll(rows) {
  const opened = [];
  for (const row of rows) {
    try {
      opened.push(await toDomain(row));
    } catch (err) {
      report(err.code === 'locked' ? 'row.sealed_without_key' : 'row.decrypt_failed', {
        rowId: row.id,
        keyVersion: row.key_version,
        bytes: row.secret ? row.secret.length : 0
      });
      if (err.code === 'locked') throw err;
    }
  }
  return opened;
}

// Written rows carry the plaintext columns only while there is no vault; once
// there is one, they carry ciphertext and nothing else.
async function forStorage(entry) {
  if (!vault.isUnlocked()) return fromTransaction(entry);

  const sealed = await vault.seal(entry);
  return {
    id: sealed.id,
    date: entry.date,
    account_id: entry.accountId ?? null,
    receipt_path: entry.receiptId ?? null,
    secret: sealed.secret,
    iv: sealed.iv,
    key_version: sealed.key_version,
    ref_hash: sealed.ref_hash
  };
}

async function currentUserId() {
  const { data } = await client().auth.getUser();
  if (!data?.user) throw new Error('Sign in required');
  return data.user.id;
}

/* ------------------------------------------------------------------ auth */

let onUnauthorised = () => {};
export const setUnauthorisedHandler = (handler) => {
  onUnauthorised = handler || (() => {});
  client().auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') onUnauthorised();
  });
};

const session = (data, profile = {}) => ({
  token: data.session?.access_token ?? '',
  expiresAt: data.session?.expires_at
    ? new Date(data.session.expires_at * 1000).toISOString()
    : new Date(Date.now() + 3600_000).toISOString(),
  user: {
    id: data.user.id,
    email: data.user.email,
    displayName: profile.display_name ?? data.user.user_metadata?.display_name ?? ''
  }
});

export async function register({ email, password, displayName }) {
  const data = unwrap(
    await client().auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || '' } }
    })
  );
  if (!data.session) {
    // The project has email confirmation on, so there is no session to return.
    throw new Error('Check your email to confirm the account, then sign in.');
  }

  // The vault is made here, in the browser, and only its wrapped form is sent.
  const { vault: envelope, recoveryKey } = await vault.create(password);
  await call('create_vault', {
    p_password: envelope.password,
    p_recovery: envelope.recovery,
    p_key_version: envelope.keyVersion
  });

  return { ...session(data), recoveryKey };
}

export async function login({ email, password }) {
  const data = unwrap(await client().auth.signInWithPassword({ email, password }));
  const [profile] = await Promise.all([call('get_profile'), loadVault(password)]);
  return session(data, one(profile) || {});
}

/** Fetch the vault row and, given the password, open it. */
export async function loadVault(password) {
  const stored = one(await call('get_vault'));
  if (!stored) {
    // An account from before encryption existed. Its rows are still readable;
    // Settings offers to seal them.
    await vault.adopt(null);
    report('vault.missing');
    return { exists: false, unlocked: false };
  }

  const envelope = {
    keyVersion: stored.key_version,
    password: stored.password,
    recovery: stored.recovery
  };
  const cached = await vault.adopt(envelope);
  if (cached || !password) return { exists: true, unlocked: cached };

  try {
    await vault.unlock(password);
  } catch {
    report('vault.unlock_failed', { keyVersion: stored.key_version });
    return { exists: true, unlocked: false };
  }
  return { exists: true, unlocked: true };
}

/** Turn encryption on for an account that predates it, and seal what it holds. */
export async function protectData(password) {
  if (vault.currentEnvelope()) throw new Error('Your data is already protected.');

  const { vault: envelope, recoveryKey } = await vault.create(password);
  await call('create_vault', {
    p_password: envelope.password,
    p_recovery: envelope.recovery,
    p_key_version: envelope.keyVersion
  });

  return { recoveryKey, ...(await sealExisting()) };
}

/**
 * Seal every row still held in the clear. Written one row at a time so an
 * interruption leaves a half-sealed account that this can simply finish, rather
 * than a batch that half-applied.
 */
export async function sealExisting() {
  const rows = (await call('list_transactions')).filter((row) => !row.secret);

  let sealed = 0;
  for (const row of rows) {
    // update_transaction writes every column it is given and clears the rest,
    // so the plaintext goes in the same statement that stores the ciphertext.
    await write('update_transaction', await forStorage(toTransaction(row)));
    sealed += 1;
  }

  return { sealed };
}

/**
 * What can be said about the data without reading it: how much is sealed, how
 * much is not, and which rows will not open. Run in the browser, where the key
 * is, so it can actually check rather than assume.
 */
export async function dataHealth() {
  const rows = await call('list_transactions');

  const failures = [];
  let sealed = 0;
  let readable = 0;

  for (const row of rows) {
    if (!row.secret) {
      readable += 1;
      continue;
    }
    sealed += 1;
    try {
      await vault.open(row);
    } catch (err) {
      failures.push({ id: row.id, keyVersion: row.key_version, code: err.code || 'decrypt_failed' });
      report('row.decrypt_failed', { rowId: row.id, keyVersion: row.key_version });
    }
  }

  return { total: rows.length, sealed, readable, failures };
}

export const recentDiagnostics = (limit = 50) => call('recent_diagnostics', { p_limit: limit });

export const vaultState = () => ({ exists: Boolean(vault.currentEnvelope()), unlocked: vault.isUnlocked() });
export const unlockVault = (password) => vault.unlock(password);
export const unlockVaultWithRecoveryKey = (key) => vault.unlockWithKey(key);
export const onLockChange = vault.onLockChange;

export const logout = async () => {
  vault.forget();
  unwrap(await client().auth.signOut());
};

// Supabase sends a reset link by email, so the recovery codes the API needed
// are not part of this path.
export const requestPasswordReset = async (email) =>
  unwrap(await client().auth.resetPasswordForEmail(email));

export const changePassword = async (currentPassword, newPassword) => {
  const { data } = await client().auth.getUser();
  // Re-authenticating first means a borrowed session cannot change the password.
  unwrap(await client().auth.signInWithPassword({ email: data.user.email, password: currentPassword }));

  // The data key is rewrapped, not replaced: no row is touched, and a password
  // change cannot lose anything. It is written before the password changes, so
  // a failure here leaves the old password still opening the vault.
  if (vault.isUnlocked()) {
    const envelope = await vault.rewrap(newPassword);
    await call('rewrap_vault', { p_password: envelope.password });
  }

  unwrap(await client().auth.updateUser({ password: newPassword }));
  return { changed: true };
};

/** A fresh recovery key, replacing the old one. Shown once. */
export async function reissueRecoveryKey() {
  const { vault: envelope, recoveryKey } = await vault.newRecovery();
  await call('rewrap_vault', { p_recovery: envelope.recovery });
  return { recoveryKey };
}

/* ---------------------------------------------------------- transactions */

export async function listExpenses(filters = {}) {
  // The window is the only thing the database can still narrow.
  const rows = await openAll(
    await call('list_transactions', { p_from: filters.from || null, p_to: filters.to || null })
  );

  // The rest is decided here, because the database cannot read it.
  const term = filters.q ? String(filters.q).toLowerCase() : '';
  const matching = rows.filter(
    (row) =>
      (!filters.kind || row.kind === filters.kind) &&
      (!filters.category || row.category === filters.category) &&
      (!filters.paymentMethod || row.paymentMethod === filters.paymentMethod) &&
      (!term ||
        row.description.toLowerCase().includes(term) ||
        row.category.toLowerCase().includes(term) ||
        (row.note || '').toLowerCase().includes(term))
  );

  const column = ['date', 'amount', 'description', 'category'].includes(filters.sort)
    ? filters.sort
    : 'date';
  const direction = String(filters.order).toLowerCase() === 'asc' ? 1 : -1;
  return matching.sort((a, b) => {
    const left = a[column];
    const right = b[column];
    if (left === right) return 0;
    return (left > right ? 1 : -1) * direction;
  });
}

export async function createExpense(expense) {
  return toDomain(one(await write('create_transaction', await forStorage(expense))));
}

// A transaction is replaced rather than patched: sealed, it is one blob, so a
// partial edit means opening it, merging, and sealing it again under the same
// id — and the same path unsealed keeps one code path instead of two.
export async function updateExpense(id, patch) {
  const stored = one(await call('get_transaction', { p_id: id }));
  if (!stored) throw new Error('That transaction no longer exists.');

  const merged = { ...(await toDomain(stored)), ...patch, id };
  return toDomain(one(await write('update_transaction', await forStorage(merged))));
}

export const deleteExpense = (id) => call('delete_transaction', { p_id: id });

/** Every transaction, gone. Accounts, budgets, goals and the profile remain. */
export const deleteAllTransactions = () => call('reset_transactions');

/* -------------------------------------------------------------- accounts */

export async function listAccounts() {
  // account_balances summed a column the database can no longer read, so the
  // balances are worked out here from the decrypted rows.
  const [accounts, rows] = await Promise.all([call('list_accounts'), listExpenses({})]);
  return accountBalances(accounts.map(toAccount), rows);
}

export const createAccount = async ({ name, openingBalance }) =>
  toAccount(
    one(
      await call('create_account', {
        p_name: String(name).trim(),
        p_opening_balance: Number(openingBalance) || 0
      })
    )
  );

export const removeAccount = async (id) => {
  await call('delete_account', { p_id: id });
};

/* --------------------------------------------------------------- budgets */

export const listBudgets = async () => (await call('list_budgets')).map(toBudget);

// Setting a limit and clearing one are the same call: zero means gone, and the
// function decides which, so the two cannot drift apart.
export async function setBudget(category, monthlyLimit) {
  await call('set_budget', { p_category: category, p_monthly_limit: Number(monthlyLimit) });
  return { category, monthlyLimit: Number(monthlyLimit) };
}

/* ------------------------------------------------------------- recurring */

export const listRecurring = async () => (await call('list_recurring')).map(toRecurring);

export const createRecurring = async (template) =>
  toRecurring(
    one(
      await call('create_recurring', {
        p_description: template.description.trim(),
        p_amount: Number(template.amount),
        p_category: template.category,
        p_day_of_month: Number(template.dayOfMonth),
        p_payment_method: template.paymentMethod || null
      })
    )
  );

export const deleteRecurring = (id) => call('delete_recurring', { p_id: id });

// Creating this month's transaction for each template that has not been applied.
export async function applyRecurring(month) {
  const templates = await call('list_recurring');
  // Which bills are already recorded is decided here: the description and the
  // category it compares are inside the sealed blob.
  const existing = await listExpenses({ from: `${month}-01`, to: `${month}-31` });

  const already = new Set(
    existing.map((row) => `${row.description}|${row.category}|${row.date}`)
  );

  const due = templates
    .map((row) => ({
      description: row.description,
      amount: Number(row.amount),
      category: row.category,
      paymentMethod: row.payment_method,
      kind: 'expense',
      source: 'recurring',
      date: `${month}-${String(row.day_of_month).padStart(2, '0')}`
    }))
    .filter((row) => !already.has(`${row.description}|${row.category}|${row.date}`));

  if (due.length === 0) return { created: 0, skipped: templates.length, expenses: [] };

  const created = [];
  for (const row of due) created.push(await createExpense(row));

  return {
    created: created.length,
    skipped: templates.length - created.length,
    expenses: created
  };
}

/* ----------------------------------------------------------------- goals */

export const listGoals = async () => (await call('list_goals')).map(toGoal);

export const createGoal = async (goal) =>
  toGoal(
    one(
      await call('create_goal', {
        p_name: goal.name.trim(),
        p_target_amount: Number(goal.target),
        p_icon: goal.icon || 'target',
        p_saved_amount: Number(goal.saved) || 0
      })
    )
  );

export const updateGoal = async (id, patch) =>
  toGoal(
    one(
      await call('update_goal', {
        p_id: id,
        p_name: patch.name === undefined ? null : patch.name.trim(),
        p_target_amount: patch.target === undefined ? null : Number(patch.target),
        p_icon: patch.icon === undefined ? null : patch.icon
      })
    )
  );

export const deleteGoal = (id) => call('delete_goal', { p_id: id });

export const removeGoal = deleteGoal;

export const addToGoal = async (id, amount) => {
  await call('add_contribution', { p_goal_id: id, p_amount: Number(amount) });
  const goals = await listGoals();
  return goals.find((goal) => goal.id === id);
};

export const contributeGoal = addToGoal;

export const listContributions = async (id) =>
  (await call('list_contributions', { p_goal_id: id })).map(toContribution);

/* -------------------------------------------------------------- settings */

const toSettings = (row) => ({
  displayName: row.display_name,
  monthlyBudget: Number(row.monthly_budget)
});

export const getSettings = async () => toSettings(one(await call('get_profile')));

export const saveSettings = async (settings) =>
  toSettings(
    one(
      await call('save_profile', {
        p_display_name:
          settings.displayName === undefined ? null : String(settings.displayName).slice(0, 60),
        p_monthly_budget:
          settings.monthlyBudget === undefined ? null : Number(settings.monthlyBudget) || 0
      })
    )
  );

const CATEGORIES = {
  expense: ['food', 'transport', 'housing', 'utilities', 'health', 'entertainment', 'education', 'shopping', 'other'],
  income: ['salary', 'freelance', 'interest', 'refund', 'other income']
};

export const listCategories = async () => ({
  expense: CATEGORIES.expense,
  income: CATEGORIES.income,
  paymentMethods: ['upi', 'card', 'cash', 'bank_transfer']
});

/* --------------------------------------------------------------- summary */

// The Express route answered this in one request; here the pieces come from the
// SQL functions in supabase/migrations/0002_summary.sql, in parallel, and are
// assembled into the same shape so no page has to know the difference.
export async function getSummary(period) {
  const query = typeof period === 'string' ? { month: period } : period || {};
  const { from, to } = resolvePeriod(query);

  // One window covers the range, the period before it and the twelve-month
  // trend, so the rows are fetched and decrypted once.
  const start = summaryWindow(from, to);

  const [rows, budgets, profile, recurring] = await Promise.all([
    listExpenses({ from: start, to }),
    call('list_budgets'),
    call('get_profile'),
    call('list_recurring')
  ]);

  const inRange = rows.filter((row) => row.date >= from && row.date <= to);

  return assembleSummary({
    from,
    to,
    daily: dailySeries(rows, from, to),
    totals: periodTotals(rows, from, to),
    categories: categoryTotals(rows, from, to),
    accounts: accountTotals(rows, from, to),
    trend: monthlyTrend(rows, to),
    budgets,
    profile: one(profile),
    recurring,
    applied: inRange.map((row) => ({
      description: row.description,
      category: row.category,
      date: row.date
    })),
    today: new Date().toISOString().slice(0, 10)
  });
}

/* -------------------------------------------------------------- receipts */

// The file lives in a private bucket under a folder named for its owner, and
// the transaction keeps the path. That path is the id every caller already
// passes around, so nothing above this layer changes.

const RECEIPT_BUCKET = 'receipts';
const RECEIPT_MAX_BYTES = 2 * 1024 * 1024;
const RECEIPT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf'
};

export async function uploadReceipt(file) {
  const type = (file.type || '').split(';')[0].trim().toLowerCase();
  if (!RECEIPT_TYPES[type]) {
    throw new Error(`Receipts must be one of: ${Object.keys(RECEIPT_TYPES).join(', ')}`);
  }
  if (!file.size) throw new Error('That file is empty.');
  if (file.size > RECEIPT_MAX_BYTES) throw new Error('Receipt must be 2MB or smaller.');

  // The extension records what the file is, so the viewer can show it; the
  // bytes themselves are sealed, so the store holds nothing viewable.
  const path = `${await currentUserId()}/${crypto.randomUUID()}.${RECEIPT_TYPES[type]}${
    vault.isUnlocked() ? '.enc' : ''
  }`;

  const body = vault.isUnlocked()
    ? new Blob([await vault.sealBytes(path, await file.arrayBuffer())])
    : file;

  const { error } = await client()
    .storage.from(RECEIPT_BUCKET)
    .upload(path, body, {
      contentType: vault.isUnlocked() ? 'application/octet-stream' : type,
      upsert: false
    });
  if (error) {
    report('storage.upload_failed', { bytes: file.size });
    throw new Error(error.message);
  }

  return { id: path, mimeType: type, byteSize: file.size };
}

const MIME_BY_EXTENSION = Object.fromEntries(
  Object.entries(RECEIPT_TYPES).map(([type, extension]) => [extension, type])
);

export async function fetchReceipt(id) {
  const { data, error } = await client().storage.from(RECEIPT_BUCKET).download(id);
  if (error) {
    report('storage.fetch_failed');
    throw new Error(/not found/i.test(error.message) ? 'Receipt not found' : error.message);
  }

  if (!id.endsWith('.enc')) return { url: URL.createObjectURL(data), type: data.type };

  const extension = id.slice(0, -4).split('.').pop();
  const type = MIME_BY_EXTENSION[extension] || 'application/octet-stream';
  const plain = await vault.openBytes(id, await data.arrayBuffer());
  return { url: URL.createObjectURL(new Blob([plain], { type })), type };
}

export async function deleteReceipt(id) {
  const { error } = await client().storage.from(RECEIPT_BUCKET).remove([id]);
  if (error) throw new Error(error.message);
  // A storage object has no foreign key, so the ON DELETE SET NULL the API
  // relied on is done here: the transactions that carried it stop pointing at
  // a file that is gone.
  const carrying = (await call('list_transactions')).filter((row) => row.receipt_path === id);
  for (const row of carrying) await updateExpense(row.id, { receiptId: null });
}

export async function receiptUsage() {
  const files = unwrap(
    await client().storage.from(RECEIPT_BUCKET).list(await currentUserId(), { limit: 1000 })
  );
  return {
    count: files.length,
    bytes: files.reduce((total, file) => total + (file.metadata?.size ?? 0), 0)
  };
}

/* ------------------------------------------------------------ statements */

// The PDF is read on this device and only the rows it yields are sent anywhere.
// Everything the Express route did — detect the bank, parse, flag duplicates,
// insert what was chosen — happens here instead.

const STATEMENT_MAX_BYTES = 5 * 1024 * 1024;

const shiftDays = (day, days) =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

// The rows already in the ledger around the statement's dates, which is all the
// comparison needs — not the whole history.
async function neighbours(dates) {
  const sorted = [...dates].sort();
  const rows = await listExpenses({
    from: shiftDays(sorted[0], -NEAR_DAYS),
    to: shiftDays(sorted[sorted.length - 1], NEAR_DAYS)
  });
  // findDuplicate reads rows as the database used to return them.
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    description: row.description,
    amount: row.amount,
    date: row.date,
    external_ref: row.externalRef
  }));
}

export async function previewStatement(file, password) {
  if (!file || !file.size) throw new Error('Upload a PDF statement.');
  if (file.size > STATEMENT_MAX_BYTES) throw new Error('Statement must be 5MB or smaller.');

  // pdf.js and its worker are a large dependency; loading them only when a
  // statement is actually opened keeps them out of the initial bundle.
  const { extractText } = await import('../pdf.js');
  const { lines, text, pages } = await extractText(await file.arrayBuffer(), password);

  const bank = detectBank(text);
  const { transactions, skipped } = parseStatement(lines);

  if (transactions.length === 0) {
    const words = lines.filter((line) => line.trim()).length;
    const error = new Error(
      words === 0
        ? `No text at all could be read from these ${pages} page${pages === 1 ? '' : 's'}. This is a scanned or image-only PDF, so there is nothing to parse.`
        : `No transactions could be read from these ${pages} page${pages === 1 ? '' : 's'}, though ${words} lines of text were found. The layout is one this parser does not recognise yet.`
    );
    // The extracted lines say which of the two it is, and what the rows look
    // like. They stay on this device, in the page that read the file.
    error.details = {
      bank,
      pages,
      lines: words,
      skipped: skipped.slice(0, 8),
      sample: lines.filter((line) => line.trim()).slice(0, 8)
    };
    throw error;
  }

  const [existing, rules] = await Promise.all([
    neighbours(transactions.map((entry) => entry.date)),
    listMerchantRules()
  ]);

  const rows = await Promise.all(transactions.map(async (entry) => {
    const duplicate = findDuplicate(entry, existing);
    // A rule you set yourself outranks the keyword list that guessed.
    const remembered = rules.get(await ruleKey(entry.description));
    return {
      ...entry,
      category: remembered && CATEGORIES[entry.kind].includes(remembered) ? remembered : entry.category,
      remembered: Boolean(remembered),
      duplicate: Boolean(duplicate),
      duplicateReason: duplicate?.reason ?? null
    };
  }));

  return {
    bank,
    pages,
    count: rows.length,
    duplicates: rows.filter((row) => row.duplicate).length,
    transactions: rows,
    skipped
  };
}

const KINDS = ['income', 'expense'];

function rowErrors(entry) {
  const errors = [];
  const categories = CATEGORIES[entry.kind] || [];

  if (!KINDS.includes(entry.kind)) errors.push('kind must be income or expense');
  if (typeof entry.description !== 'string' || !entry.description.trim()) {
    errors.push('description is required');
  } else if (entry.description.length > 200) {
    errors.push('description is too long');
  }

  const amount = Number(entry.amount);
  if (!Number.isFinite(amount) || amount <= 0) errors.push('amount must be positive');
  else if (amount > 9999999999) errors.push('amount is too large');
  else if (Math.round(amount * 100) !== amount * 100) errors.push('amount has too many decimals');

  if (!categories.includes(entry.category)) errors.push('category is not one of the known ones');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date || '')) errors.push('date must be YYYY-MM-DD');

  return errors;
}

export async function importStatement(transactions, options = {}) {
  const incoming = Array.isArray(transactions) ? transactions : [];
  if (incoming.length === 0) throw new Error('No transactions selected.');
  if (incoming.length > 2000) throw new Error('Too many rows (max 2000).');

  const accepted = [];
  const rejected = [];
  incoming.forEach((entry, position) => {
    const errors = rowErrors(entry);
    if (errors.length) rejected.push({ row: position + 1, errors });
    else accepted.push(entry);
  });

  if (accepted.length === 0) {
    const error = new Error('No valid rows.');
    error.details = { rejected };
    throw error;
  }

  const existing = await neighbours(accepted.map((entry) => entry.date));

  let duplicates = 0;
  const rows = [];
  for (const entry of accepted) {
    // A reference matches by reference, everything else by amount, direction,
    // date and narration — the same test the preview showed the user.
    if (findDuplicate(entry, existing)) {
      duplicates += 1;
      continue;
    }
    rows.push({
      ...(await forStorage({
        kind: entry.kind,
        description: entry.description,
        amount: entry.amount,
        category: entry.category,
        date: entry.date,
        source: 'statement',
        externalRef: entry.reference || null,
        // One statement belongs to one account, so the whole batch carries it.
        accountId: options.accountId || null,
        paymentMethod: options.paymentMethod || null
      }))
    });
  }

  // Every imported row teaches the merchant its category, whether that came
  // from the keyword list or from a correction made in the preview.
  await saveMerchantRules(accepted.map((entry) => ({ description: entry.description, category: entry.category })));

  if (rows.length === 0) return { imported: 0, duplicates, rejected };

  // Row by row, because one clash must not lose the rest: the unique index on
  // the blind reference refuses a statement imported twice, and that refusal is
  // counted rather than thrown.
  let imported = 0;
  for (const row of rows) {
    try {
      await write('create_transaction', row);
      imported += 1;
    } catch (err) {
      if (/duplicate key|23505/.test(err.message)) duplicates += 1;
      else throw err;
    }
  }
  return { imported, duplicates, rejected };
}

/* -------------------------------------------------------- merchant rules */

// The merchant is stored as a digest under the user's own key, so the rules say
// nothing about where they shop to anyone who can read the table.
const ruleKey = async (description) => {
  const merchant = merchantKey(description);
  if (!merchant) return '';
  return vault.isUnlocked() ? vault.referenceDigest(`merchant:${merchant}`) : merchant;
};

export async function listMerchantRules() {
  const rows = await call('list_merchant_rules');
  return new Map(rows.map((row) => [row.merchant, row.category]));
}

export async function saveMerchantRules(entries) {
  const rules = new Map();
  for (const entry of entries) {
    const merchant = await ruleKey(entry.description);
    // The last word on a merchant wins, which is the correction just made.
    if (merchant) rules.set(merchant, entry.category);
  }
  if (rules.size === 0) return { saved: 0 };

  // The whole set in one call: an import teaches several merchants at once.
  await call('save_merchant_rules', {
    p_rules: [...rules].map(([merchant, category]) => ({ merchant, category }))
  });
  return { saved: rules.size };
}

export const forgetMerchantRule = (merchant) =>
  call('forget_merchant_rule', { p_merchant: merchant });

/* ------------------------------------------------- rows without an account */

// Statements imported before this existed, and anything added without picking
// an account, sit outside the Accounts page until they are claimed.
export const unassignedCount = () => call('count_unassigned');

export async function assignUnassigned({ accountId, paymentMethod }) {
  if (!accountId && !paymentMethod) return { updated: 0 };

  // The account is a column the database still owns, so it moves in one call.
  // The payment method is inside the sealed blob, so those rows are opened and
  // sealed again one at a time.
  if (!paymentMethod) return { updated: await call('assign_unassigned', { p_account_id: accountId }) };

  const pending = (await call('list_transactions')).filter((row) => !row.account_id);
  for (const row of pending) await updateExpense(row.id, { accountId, paymentMethod });
  return { updated: pending.length };
}

/* ------------------------------------------------------------------- csv */

export async function exportCsv(filters = {}) {
  const rows = await listExpenses(filters);
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'expenses.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function importCsv(text) {
  const { errors, records } = csvToExpenses(text);
  if (errors.length) throw new Error(errors.join(', '));
  if (records.length === 0) throw new Error('No rows to import.');
  if (records.length > 5000) throw new Error('Too many rows (max 5000).');

  const accepted = [];
  const rejected = [];

  records.forEach((record, position) => {
    // A file without a kind column is read by its category, which is how the
    // categories are split in the first place.
    const kind =
      record.kind || (CATEGORIES.income.includes(record.category) ? 'income' : 'expense');
    const entry = { ...record, kind, amount: Number(record.amount) };
    const rowIssues = rowErrors(entry);
    // The header is row one, so a record's own row number is its index plus two.
    if (rowIssues.length) rejected.push({ row: position + 2, errors: rowIssues });
    else accepted.push(entry);
  });

  if (accepted.length === 0) {
    const error = new Error('No valid rows.');
    error.details = { rejected };
    throw error;
  }

  let imported = 0;
  for (const entry of accepted) {
    await write(
      'create_transaction',
      await forStorage({
        kind: entry.kind,
        description: entry.description,
        amount: entry.amount,
        category: entry.category,
        date: entry.date,
        source: 'csv'
      })
    );
    imported += 1;
  }

  return { imported, rejected };
}
