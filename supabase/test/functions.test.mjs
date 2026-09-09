import test from 'node:test';
import assert from 'node:assert/strict';
import { asUser, createUser, freshDatabase } from './harness.mjs';

// The Express summary route is being replaced by these functions. They have to
// produce the same figures — and, because they run as the caller, they must not
// see anyone else's rows while doing it.

const db = await freshDatabase('supabase_function_test');
const alice = await createUser(db, 'alice@example.com');
const bob = await createUser(db, 'bob@example.com');

const rows = [
  [alice, 'Salary', 85000, 'salary', '2026-09-01', 'income', 'bank_transfer'],
  [alice, 'Rent', 18500, 'housing', '2026-09-01', 'expense', 'bank_transfer'],
  [alice, 'Groceries', 1800, 'food', '2026-09-03', 'expense', 'upi'],
  [alice, 'Coffee', 200, 'food', '2026-09-05', 'expense', 'cash'],
  [alice, 'August rent', 18000, 'housing', '2026-08-15', 'expense', 'bank_transfer'],
  // A day before the previous window starts: the comparison must not reach it.
  [alice, 'July leftovers', 4000, 'food', '2026-08-01', 'expense', 'cash'],
  [bob, 'Bob rent', 9000, 'housing', '2026-09-02', 'expense', 'upi']
];
for (const row of rows) {
  await db.query(
    `insert into public.transactions (user_id, description, amount, category, date, kind, payment_method)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    row
  );
}

test.after(() => db.end());

test('the daily series covers every day of the range, gaps filled', async () => {
  const days = await asUser(db, alice, async () =>
    (await db.query('select * from public.daily_series($1, $2)', ['2026-09-01', '2026-09-05'])).rows
  );

  assert.equal(days.length, 5);
  assert.deepEqual(
    days.map((d) => Number(d.spent)),
    [18500, 0, 1800, 0, 200]
  );
  assert.deepEqual(
    days.map((d) => Number(d.earned)),
    [85000, 0, 0, 0, 0]
  );
});

test('the running total is a prefix sum of the days before it', async () => {
  const days = await asUser(db, alice, async () =>
    (await db.query('select * from public.daily_series($1, $2)', ['2026-09-01', '2026-09-05'])).rows
  );

  let running = 0;
  for (const day of days) {
    running += Number(day.spent);
    assert.equal(Number(day.spent_to_date), running, `running total at ${day.day}`);
  }
  assert.equal(Number(days[days.length - 1].spent_to_date), 20500);
});

test('the daily series shows the caller their own days only', async () => {
  const bobDays = await asUser(db, bob, async () =>
    (await db.query('select * from public.daily_series($1, $2)', ['2026-09-01', '2026-09-05'])).rows
  );

  assert.equal(bobDays.length, 5);
  assert.equal(
    bobDays.reduce((sum, day) => sum + Number(day.spent), 0),
    9000,
    'Alice’s spending leaked into Bob’s series'
  );
});

test('period totals separate this window from the one before it', async () => {
  const totals = await asUser(db, alice, async () =>
    (await db.query('select * from public.period_totals($1, $2)', ['2026-09-01', '2026-09-30'])).rows
  );

  const find = (period, kind) =>
    totals.find((row) => row.period === period && row.kind === kind) || { total: 0, transactions: 0 };

  assert.equal(Number(find('current', 'expense').total), 20500);
  assert.equal(Number(find('current', 'income').total), 85000);
  // The previous window is the same length, ending the day before September —
  // for a 30-day September that is 2 to 31 August, so 1 August is outside it.
  assert.equal(Number(find('previous', 'expense').total), 18000);
  assert.equal(Number(find('current', 'expense').transactions), 3);
});

test('category totals rank spending and ignore income', async () => {
  const categories = await asUser(db, alice, async () =>
    (await db.query('select * from public.category_totals($1, $2)', ['2026-09-01', '2026-09-30'])).rows
  );

  assert.deepEqual(
    categories.map((row) => [row.category, Number(row.total)]),
    [
      ['housing', 18500],
      ['food', 2000]
    ]
  );
});

test('account totals group by payment method, both directions', async () => {
  const methods = await asUser(db, alice, async () =>
    (await db.query('select * from public.account_totals($1, $2)', ['2026-09-01', '2026-09-30'])).rows
  );

  const bank = methods.filter((row) => row.method === 'bank_transfer');
  assert.equal(Number(bank.find((row) => row.kind === 'income').total), 85000);
  assert.equal(Number(bank.find((row) => row.kind === 'expense').total), 18500);
  assert.equal(Number(methods.find((row) => row.method === 'cash').total), 200);
});

test('the trend covers twelve months ending on the anchor, zeros included', async () => {
  const trend = await asUser(db, alice, async () =>
    (await db.query('select * from public.monthly_trend($1)', ['2026-09-15'])).rows
  );

  assert.equal(trend.length, 12);
  assert.equal(trend[11].month, '2026-09');
  assert.equal(trend[0].month, '2025-10');
  assert.equal(Number(trend[11].total), 20500);
  assert.equal(Number(trend[10].total), 22000);
  assert.equal(Number(trend[0].total), 0);
});

test('an account balance follows from its opening balance and its transactions', async () => {
  const { rows } = await db.query(
    `insert into public.accounts (user_id, name, opening_balance) values ($1, 'Bank', 5000) returning id`,
    [alice]
  );
  const account = rows[0].id;
  await db.query(
    `update public.transactions set account_id = $1 where user_id = $2 and date >= '2026-09-01'`,
    [account, alice]
  );

  const balances = await asUser(db, alice, async () =>
    (await db.query('select * from public.account_balances')).rows
  );

  assert.equal(balances.length, 1);
  // 5000 opening + 85000 in − 20500 out
  assert.equal(Number(balances[0].balance), 69500);
  assert.equal(Number(balances[0].transactions), 4);

  const bobSees = await asUser(db, bob, async () =>
    (await db.query('select * from public.account_balances')).rowCount
  );
  assert.equal(bobSees, 0, 'balances leaked across accounts');
});

test('a goal’s saved amount is its seed plus its contributions', async () => {
  const { rows } = await db.query(
    `insert into public.goals (user_id, name, target_amount, saved_amount)
     values ($1, 'Laptop', 75000, 45000) returning id`,
    [alice]
  );
  const goal = rows[0].id;
  await db.query(
    `insert into public.goal_contributions (goal_id, user_id, amount) values ($1, $2, 3000), ($1, $2, 2000)`,
    [goal, alice]
  );

  const progress = await asUser(db, alice, async () =>
    (await db.query('select * from public.goal_progress')).rows
  );

  assert.equal(Number(progress[0].saved), 50000);
  assert.equal(Number(progress[0].target_amount), 75000);
});
