import { createClient } from '@supabase/supabase-js';
import { assembleSummary, resolvePeriod } from './summary.js';
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

// Rows a statement import produced: inserted in one go, with the unique index on
// (user_id, external_ref) refusing anything already imported.
export async function importStatement(transactions) {
  const userId = await currentUserId();
  const rows = transactions.map((row) => ({
    ...fromTransaction({ ...row, source: 'statement' }),
    user_id: userId
  }));
  const inserted = unwrap(
    await client().from('transactions').upsert(rows, {
      onConflict: 'user_id,external_ref',
      ignoreDuplicates: true
    }).select()
  );
  return { imported: inserted.length, skipped: rows.length - inserted.length };
}

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

export const listCategories = async () => ({
  expense: ['food', 'transport', 'housing', 'utilities', 'health', 'entertainment', 'education', 'shopping', 'other'],
  income: ['salary', 'freelance', 'interest', 'refund', 'other income'],
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
