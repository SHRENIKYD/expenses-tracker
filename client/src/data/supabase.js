import { createClient } from '@supabase/supabase-js';
import { assembleSummary, resolvePeriod } from './summary.js';
import { detectBank, parseStatement } from '../statement.js';
import { NEAR_DAYS, findDuplicate } from '../duplicates.js';
import { merchantKey } from '../merchant.js';
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
  return session(data);
}

export async function login({ email, password }) {
  const data = unwrap(await client().auth.signInWithPassword({ email, password }));
  const profile = unwrap(
    await client().from('profiles').select('display_name').eq('id', data.user.id).maybeSingle()
  );
  return session(data, profile || {});
}

export const logout = async () => {
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
  unwrap(await client().auth.updateUser({ password: newPassword }));
  return { changed: true };
};

/* ---------------------------------------------------------- transactions */

export async function listExpenses(filters = {}) {
  let query = client().from('transactions').select('*');

  if (filters.kind) query = query.eq('kind', filters.kind);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.paymentMethod) query = query.eq('payment_method', filters.paymentMethod);
  if (filters.from) query = query.gte('date', filters.from);
  if (filters.to) query = query.lte('date', filters.to);
  if (filters.q) {
    const term = `%${filters.q}%`;
    query = query.or(`description.ilike.${term},category.ilike.${term},note.ilike.${term}`);
  }

  const column = { date: 'date', amount: 'amount', description: 'description', category: 'category' }[
    filters.sort
  ] || 'date';
  query = query.order(column, { ascending: String(filters.order).toLowerCase() === 'asc' });

  return unwrap(await query).map(toTransaction);
}

export const createExpense = async (expense) =>
  toTransaction(
    unwrap(
      await client()
        .from('transactions')
        .insert({ ...fromTransaction(expense), user_id: await currentUserId() })
        .select()
        .single()
    )
  );

export const updateExpense = async (id, patch) =>
  toTransaction(
    unwrap(await client().from('transactions').update(fromTransaction(patch)).eq('id', id).select().single())
  );

export const deleteExpense = async (id) => {
  unwrap(await client().from('transactions').delete().eq('id', id));
};

/* -------------------------------------------------------------- accounts */

export const listAccounts = async () =>
  unwrap(await client().from('account_balances').select('*').order('name')).map(toAccount);

export const createAccount = async ({ name, openingBalance }) =>
  toAccount(
    unwrap(
      await client()
        .from('accounts')
        .insert({
          name: String(name).trim(),
          opening_balance: Number(openingBalance) || 0,
          user_id: await currentUserId()
        })
        .select()
        .single()
    )
  );

export const removeAccount = async (id) => {
  unwrap(await client().from('accounts').delete().eq('id', id));
};

/* --------------------------------------------------------------- budgets */

export const listBudgets = async () =>
  unwrap(await client().from('budgets').select('*').order('category')).map(toBudget);

export async function setBudget(category, monthlyLimit) {
  const userId = await currentUserId();
  if (Number(monthlyLimit) === 0) {
    unwrap(await client().from('budgets').delete().eq('category', category));
    return { category, monthlyLimit: 0 };
  }
  return toBudget(
    unwrap(
      await client()
        .from('budgets')
        .upsert(
          { user_id: userId, category, monthly_limit: Number(monthlyLimit), updated_at: new Date().toISOString() },
          { onConflict: 'user_id,category' }
        )
        .select()
        .single()
    )
  );
}

/* ------------------------------------------------------------- recurring */

export const listRecurring = async () =>
  unwrap(await client().from('recurring').select('*').order('day_of_month')).map(toRecurring);

export const createRecurring = async (template) =>
  toRecurring(
    unwrap(
      await client()
        .from('recurring')
        .insert({
          description: template.description.trim(),
          amount: Number(template.amount),
          category: template.category,
          day_of_month: Number(template.dayOfMonth),
          payment_method: template.paymentMethod || null,
          user_id: await currentUserId()
        })
        .select()
        .single()
    )
  );

export const deleteRecurring = async (id) => {
  unwrap(await client().from('recurring').delete().eq('id', id));
};

// Creating this month's transaction for each template that has not been applied.
export async function applyRecurring(month) {
  const userId = await currentUserId();
  const templates = unwrap(await client().from('recurring').select('*'));
  const existing = unwrap(
    await client()
      .from('transactions')
      .select('description,category,date')
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`)
  );

  const already = new Set(existing.map((row) => `${row.description}|${row.category}|${row.date}`));
  const due = templates
    .map((row) => ({
      user_id: userId,
      description: row.description,
      amount: Number(row.amount),
      category: row.category,
      payment_method: row.payment_method,
      date: `${month}-${String(row.day_of_month).padStart(2, '0')}`
    }))
    .filter((row) => !already.has(`${row.description}|${row.category}|${row.date}`));

  if (due.length === 0) return { created: 0, skipped: templates.length, expenses: [] };

  const created = unwrap(await client().from('transactions').insert(due).select());
  return {
    created: created.length,
    skipped: templates.length - created.length,
    expenses: created.map(toTransaction)
  };
}

/* ----------------------------------------------------------------- goals */

export const listGoals = async () =>
  unwrap(await client().from('goal_progress').select('*').order('created_at')).map(toGoal);

export const createGoal = async (goal) =>
  toGoal(
    unwrap(
      await client()
        .from('goals')
        .insert({
          name: goal.name.trim(),
          icon: goal.icon || 'target',
          target_amount: Number(goal.target),
          saved_amount: Number(goal.saved) || 0,
          user_id: await currentUserId()
        })
        .select()
        .single()
    )
  );

export const updateGoal = async (id, patch) => {
  const row = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.icon !== undefined) row.icon = patch.icon;
  if (patch.target !== undefined) row.target_amount = Number(patch.target);
  return toGoal(unwrap(await client().from('goals').update(row).eq('id', id).select().single()));
};

export const deleteGoal = async (id) => {
  unwrap(await client().from('goals').delete().eq('id', id));
};

export const removeGoal = deleteGoal;

export const addToGoal = async (id, amount) => {
  unwrap(
    await client()
      .from('goal_contributions')
      .insert({ goal_id: id, amount: Number(amount), user_id: await currentUserId() })
  );
  const goals = await listGoals();
  return goals.find((goal) => goal.id === id);
};

export const contributeGoal = addToGoal;

export const listContributions = async (id) =>
  unwrap(
    await client().from('goal_contributions').select('*').eq('goal_id', id).order('created_at', { ascending: false })
  ).map(toContribution);

/* -------------------------------------------------------------- settings */

export async function getSettings() {
  const row = unwrap(
    await client().from('profiles').select('display_name,monthly_budget').eq('id', await currentUserId()).single()
  );
  return { displayName: row.display_name, monthlyBudget: Number(row.monthly_budget) };
}

export async function saveSettings(settings) {
  const row = {};
  if (settings.displayName !== undefined) row.display_name = String(settings.displayName).slice(0, 60);
  if (settings.monthlyBudget !== undefined) row.monthly_budget = Number(settings.monthlyBudget) || 0;

  const saved = unwrap(
    await client().from('profiles').update(row).eq('id', await currentUserId()).select().single()
  );
  return { displayName: saved.display_name, monthlyBudget: Number(saved.monthly_budget) };
}

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

  const db = client();
  const [daily, totals, categories, accounts, trend, budgets, profile, recurring, applied] =
    await Promise.all([
      db.rpc('daily_series', { from_date: from, to_date: to }),
      db.rpc('period_totals', { from_date: from, to_date: to }),
      db.rpc('category_totals', { from_date: from, to_date: to }),
      db.rpc('account_totals', { from_date: from, to_date: to }),
      db.rpc('monthly_trend', { anchor: to }),
      db.from('budgets').select('*'),
      db.from('profiles').select('display_name,monthly_budget').single(),
      db.from('recurring').select('*'),
      db.from('transactions').select('description,category,date').gte('date', from).lte('date', to)
    ]);

  return assembleSummary({
    from,
    to,
    daily: unwrap(daily),
    totals: unwrap(totals),
    categories: unwrap(categories),
    accounts: unwrap(accounts),
    trend: unwrap(trend),
    budgets: unwrap(budgets),
    profile: unwrap(profile),
    recurring: unwrap(recurring),
    applied: unwrap(applied),
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

  const path = `${await currentUserId()}/${crypto.randomUUID()}.${RECEIPT_TYPES[type]}`;
  const { error } = await client()
    .storage.from(RECEIPT_BUCKET)
    .upload(path, file, { contentType: type, upsert: false });
  if (error) throw new Error(error.message);

  return { id: path, mimeType: type, byteSize: file.size };
}

export async function fetchReceipt(id) {
  const { data, error } = await client().storage.from(RECEIPT_BUCKET).download(id);
  if (error) throw new Error(/not found/i.test(error.message) ? 'Receipt not found' : error.message);
  return { url: URL.createObjectURL(data), type: data.type };
}

export async function deleteReceipt(id) {
  const { error } = await client().storage.from(RECEIPT_BUCKET).remove([id]);
  if (error) throw new Error(error.message);
  // A storage object has no foreign key, so the ON DELETE SET NULL the API
  // relied on is done here: the transactions that carried it stop pointing at
  // a file that is gone.
  unwrap(await client().from('transactions').update({ receipt_path: null }).eq('receipt_path', id));
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
  return unwrap(
    await client()
      .from('transactions')
      .select('id,kind,description,amount,date,external_ref')
      .gte('date', shiftDays(sorted[0], -NEAR_DAYS))
      .lte('date', shiftDays(sorted[sorted.length - 1], NEAR_DAYS))
  );
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

  const rows = transactions.map((entry) => {
    const duplicate = findDuplicate(entry, existing);
    // A rule you set yourself outranks the keyword list that guessed.
    const remembered = rules.get(merchantKey(entry.description));
    return {
      ...entry,
      category: remembered && CATEGORIES[entry.kind].includes(remembered) ? remembered : entry.category,
      remembered: Boolean(remembered),
      duplicate: Boolean(duplicate),
      duplicateReason: duplicate?.reason ?? null
    };
  });

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

  const userId = await currentUserId();
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
      ...fromTransaction({
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
      }),
      user_id: userId
    });
  }

  // Every imported row teaches the merchant its category, whether that came
  // from the keyword list or from a correction made in the preview.
  await saveMerchantRules(accepted.map((entry) => ({ description: entry.description, category: entry.category })));

  if (rows.length === 0) return { imported: 0, duplicates, rejected };

  const batch = await client().from('transactions').insert(rows).select();
  if (!batch.error) return { imported: batch.data.length, duplicates, rejected };

  // 23505 is the partial unique index on (user_id, external_ref): the same
  // statement was imported before. One bad row must not lose the rest, so the
  // batch is retried row by row and the clashes are counted.
  if (batch.error.code !== '23505') throw new Error(batch.error.message);

  let imported = 0;
  for (const row of rows) {
    const one = await client().from('transactions').insert(row);
    if (!one.error) imported += 1;
    else if (one.error.code === '23505') duplicates += 1;
    else throw new Error(one.error.message);
  }
  return { imported, duplicates, rejected };
}

/* -------------------------------------------------------- merchant rules */

export async function listMerchantRules() {
  const rows = unwrap(await client().from('merchant_rules').select('merchant,category'));
  return new Map(rows.map((row) => [row.merchant, row.category]));
}

export async function saveMerchantRules(entries) {
  const userId = await currentUserId();
  const rules = new Map();
  for (const entry of entries) {
    const merchant = merchantKey(entry.description);
    // The last word on a merchant wins, which is the correction just made.
    if (merchant) rules.set(merchant, entry.category);
  }
  if (rules.size === 0) return { saved: 0 };

  unwrap(
    await client()
      .from('merchant_rules')
      .upsert(
        [...rules].map(([merchant, category]) => ({ user_id: userId, merchant, category, updated_at: new Date().toISOString() })),
        { onConflict: 'user_id,merchant' }
      )
  );
  return { saved: rules.size };
}

export async function forgetMerchantRule(merchant) {
  unwrap(await client().from('merchant_rules').delete().eq('merchant', merchant));
}

/* ------------------------------------------------- rows without an account */

// Statements imported before this existed, and anything added without picking
// an account, sit outside the Accounts page until they are claimed.
export async function unassignedCount() {
  const { count, error } = await client()
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .is('account_id', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function assignUnassigned({ accountId, paymentMethod }) {
  const patch = {};
  if (accountId) patch.account_id = accountId;
  if (paymentMethod) patch.payment_method = paymentMethod;
  if (Object.keys(patch).length === 0) return { updated: 0 };

  const rows = unwrap(
    await client().from('transactions').update(patch).is('account_id', null).select('id')
  );
  return { updated: rows.length };
}
