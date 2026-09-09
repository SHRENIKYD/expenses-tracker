import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { asUser, createUser, freshDatabase } from './harness.mjs';
import { request } from 'node:http';
import { assembleSummary } from '../../client/src/data/summary.js';

// The question this migration has to answer is not "does it run" but "does it
// say the same thing". This loads the live rows into the Supabase schema, asks
// the SQL functions and the client's assembler for a month's figures, and
// compares them with what the Express API answers for the same month.

const SOURCE = process.env.SOURCE_DATABASE_URL;
const API = process.env.API_URL || 'http://localhost:4000/api';
const EMAIL = process.env.SOURCE_USER || 'demo@example.com';
const PASSWORD = process.env.SOURCE_PASSWORD || 'demo-password-123';
const MONTH = process.env.PARITY_MONTH || '2026-09';

// Plain http rather than fetch: undici's keep-alive pool holds the event loop
// open after the assertions, which leaves the test runner waiting on nothing.
function call(path, { method = 'GET', body, token } = {}) {
  const url = new URL(API + path);
  return new Promise((resolve) => {
    const req = request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        agent: false,
        headers: {
          ...(body ? { 'content-type': 'application/json' } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {})
        }
      },
      (res) => {
        let text = '';
        res.on('data', (chunk) => (text += chunk));
        res.on('end', () => {
          try {
            resolve(res.statusCode < 400 ? JSON.parse(text) : null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function apiSummary() {
  const auth = await call('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
  if (!auth?.token) return null;
  return call(`/summary?month=${MONTH}`, { token: auth.token });
}

const reachable = SOURCE && (await apiSummary().catch(() => null));

// Held outside the test so a failed assertion still releases the connection —
// otherwise the runner waits on an open handle instead of reporting the failure.
let db = null;
test.after(async () => {
  if (db) await db.end();
});

test('Supabase reports the same month as the API it replaces', { skip: !reachable }, async () => {
  const expected = await apiSummary();

  db = await freshDatabase('supabase_parity_test');
  const owner = await createUser(db, EMAIL);
  const sql = execFileSync(
    process.execPath,
    ['export-data.mjs', '--user', EMAIL, '--owner', owner],
    { cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, DATABASE_URL: SOURCE }, encoding: 'utf8' }
  );
  await db.query(sql);

  const from = `${MONTH}-01`;
  const to = expected.range.to;

  const actual = await asUser(db, owner, async () => {
    const call = async (sqlText, params) => (await db.query(sqlText, params)).rows;
    return assembleSummary({
      from,
      to,
      daily: await call('select * from public.daily_series($1, $2)', [from, to]),
      totals: await call('select * from public.period_totals($1, $2)', [from, to]),
      categories: await call('select * from public.category_totals($1, $2)', [from, to]),
      accounts: await call('select * from public.account_totals($1, $2)', [from, to]),
      trend: await call('select * from public.monthly_trend($1)', [to]),
      budgets: await call('select * from public.budgets'),
      profile: (await call('select display_name, monthly_budget from public.profiles'))[0],
      recurring: await call('select * from public.recurring'),
      applied: await call(
        'select description, category, to_char(date, $3) as date from public.transactions where date between $1 and $2',
        [from, to, 'YYYY-MM-DD']
      ),
      today: new Date().toISOString().slice(0, 10)
    });
  });

  const money = (value) => Math.round(Number(value) * 100) / 100;

  assert.equal(money(actual.total), money(expected.total), 'expenses differ');
  assert.equal(money(actual.income), money(expected.income), 'income differs');
  assert.equal(actual.count, expected.count, 'transaction count differs');
  assert.equal(money(actual.previousTotal), money(expected.previousTotal), 'previous period differs');
  assert.equal(money(actual.remaining), money(expected.remaining), 'net differs');
  assert.equal(money(actual.overallBudget), money(expected.overallBudget), 'budget differs');
  assert.equal(actual.month, expected.month);
  assert.deepEqual(actual.range, expected.range, 'range differs');

  assert.deepEqual(
    actual.categories.map((row) => [row.category, money(row.total), row.overBudget]).sort(),
    expected.categories.map((row) => [row.category, money(row.total), row.overBudget]).sort(),
    'category split differs'
  );

  assert.equal(actual.daily.length, expected.daily.length, 'daily series length differs');
  assert.deepEqual(
    actual.daily.map((day) => [day.date, money(day.total), money(day.spentToDate)]),
    expected.daily.map((day) => [day.date, money(day.total), money(day.spentToDate)]),
    'daily series differs'
  );

  assert.deepEqual(
    actual.trend.map((row) => [row.month, money(row.total)]),
    expected.trend.map((row) => [row.month, money(row.total)]),
    'twelve-month trend differs'
  );

  assert.deepEqual(
    actual.upcoming.map((row) => [row.description, row.date, money(row.amount)]),
    expected.upcoming.map((row) => [row.description, row.date, money(row.amount)]),
    'upcoming bills differ'
  );

  assert.deepEqual(
    actual.accounts.map((row) => [row.method, money(row.income), money(row.expenses), row.count]),
    expected.accounts.map((row) => [row.method, money(row.income), money(row.expenses), row.count]),
    'per-account totals differ'
  );
});
