import test from 'node:test';
import assert from 'node:assert/strict';
import { asUser, createUser, freshDatabase } from './harness.mjs';

// The Express API kept accounts apart with `WHERE user_id = $1` on every query.
// On Supabase that job belongs to these policies, so they are worth testing
// harder than the queries ever were: a mistake here is not a wrong number, it
// is one person reading another person's money.

const db = await freshDatabase('supabase_policy_test');
const alice = await createUser(db, 'alice@example.com');
const bob = await createUser(db, 'bob@example.com');

// Seeded as the table owner, bypassing RLS, so the fixtures exist regardless.
await db.query(
  `insert into public.transactions (user_id, description, amount, category, date, kind)
   values ($1, 'Alice rent', 18500, 'housing', '2026-09-01', 'expense'),
          ($1, 'Alice salary', 85000, 'salary', '2026-09-01', 'income'),
          ($2, 'Bob coffee', 250, 'food', '2026-09-02', 'expense')`,
  [alice, bob]
);
await db.query(
  `insert into public.accounts (user_id, name, opening_balance) values ($1, 'Alice bank', 1000), ($2, 'Bob bank', 500)`,
  [alice, bob]
);
await db.query(
  `insert into public.goals (user_id, name, target_amount) values ($1, 'Alice laptop', 75000), ($2, 'Bob bike', 25000)`,
  [alice, bob]
);
await db.query(
  `insert into public.budgets (user_id, category, monthly_limit) values ($1, 'food', 12000), ($2, 'food', 3000)`,
  [alice, bob]
);
await db.query(
  `insert into public.recurring (user_id, description, amount, category, day_of_month)
   values ($1, 'Alice broadband', 1299, 'utilities', 26), ($2, 'Bob gym', 999, 'health', 5)`,
  [alice, bob]
);

test.after(() => db.end());

test('a signed-in user sees only their own rows, in every table', async () => {
  const mine = await asUser(db, alice, async () => ({
    transactions: (await db.query('select description from public.transactions order by description')).rows,
    accounts: (await db.query('select name from public.accounts')).rows,
    goals: (await db.query('select name from public.goals')).rows,
    budgets: (await db.query('select category, monthly_limit from public.budgets')).rows,
    recurring: (await db.query('select description from public.recurring')).rows
  }));

  assert.deepEqual(mine.transactions.map((r) => r.description), ['Alice rent', 'Alice salary']);
  assert.deepEqual(mine.accounts.map((r) => r.name), ['Alice bank']);
  assert.deepEqual(mine.goals.map((r) => r.name), ['Alice laptop']);
  assert.equal(mine.budgets.length, 1);
  assert.equal(Number(mine.budgets[0].monthly_limit), 12000);
  assert.deepEqual(mine.recurring.map((r) => r.description), ['Alice broadband']);
});

test('another account’s row cannot be read even when its id is known', async () => {
  const { rows } = await db.query('select id from public.transactions where user_id = $1', [bob]);
  const bobRow = rows[0].id;

  const seen = await asUser(db, alice, async () =>
    (await db.query('select * from public.transactions where id = $1', [bobRow])).rowCount
  );
  assert.equal(seen, 0);
});

test('another account’s row cannot be updated or deleted', async () => {
  const { rows } = await db.query('select id from public.transactions where user_id = $1', [bob]);
  const bobRow = rows[0].id;

  const changed = await asUser(db, alice, async () =>
    (await db.query('update public.transactions set amount = 1 where id = $1', [bobRow])).rowCount
  );
  const deleted = await asUser(db, alice, async () =>
    (await db.query('delete from public.transactions where id = $1', [bobRow])).rowCount
  );

  assert.equal(changed, 0, 'update reached across accounts');
  assert.equal(deleted, 0, 'delete reached across accounts');

  const { rows: after } = await db.query('select amount from public.transactions where id = $1', [bobRow]);
  assert.equal(Number(after[0].amount), 250);
});

test('a row cannot be written into someone else’s account', async () => {
  await assert.rejects(
    () =>
      asUser(db, alice, () =>
        db.query(
          `insert into public.transactions (user_id, description, amount, category, date)
           values ($1, 'Planted', 100, 'food', '2026-09-03')`,
          [bob]
        )
      ),
    /row-level security/i
  );
});

test('a row cannot be handed to another account by updating its owner', async () => {
  await assert.rejects(
    () =>
      asUser(db, alice, () =>
        db.query('update public.transactions set user_id = $1 where user_id = $2', [bob, alice])
      ),
    /row-level security/i
  );
});

test('a signed-out visitor reads nothing at all', async () => {
  const counts = await asUser(db, null, async () => ({
    transactions: (await db.query('select * from public.transactions')).rowCount,
    accounts: (await db.query('select * from public.accounts')).rowCount,
    profiles: (await db.query('select * from public.profiles')).rowCount
  }));

  assert.deepEqual(counts, { transactions: 0, accounts: 0, profiles: 0 });
});

test('a transaction cannot point at an account belonging to someone else', async () => {
  const { rows } = await db.query('select id from public.accounts where user_id = $1', [bob]);
  const bobAccount = rows[0].id;

  await assert.rejects(
    () =>
      asUser(db, alice, () =>
        db.query(
          `insert into public.transactions (user_id, account_id, description, amount, category, date)
           values ($1, $2, 'Borrowed account', 100, 'food', '2026-09-03')`,
          [alice, bobAccount]
        )
      ),
    /foreign key|violates/i
  );
});

test('the same bank reference cannot be imported twice', async () => {
  await asUser(db, alice, async () => {
    await db.query(
      `insert into public.transactions (user_id, description, amount, category, date, external_ref)
       values ($1, 'Statement row', 500, 'food', '2026-09-04', 'UTR123')`,
      [alice]
    );
    await assert.rejects(
      () =>
        db.query(
          `insert into public.transactions (user_id, description, amount, category, date, external_ref)
           values ($1, 'Statement row again', 500, 'food', '2026-09-04', 'UTR123')`,
          [alice]
        ),
      /duplicate key/i
    );
  });
});

test('two accounts may hold the same reference as each other', async () => {
  await db.query(
    `insert into public.transactions (user_id, description, amount, category, date, external_ref)
     values ($1, 'Alice ref', 100, 'food', '2026-09-05', 'SHARED-REF'),
            ($2, 'Bob ref', 100, 'food', '2026-09-05', 'SHARED-REF')`,
    [alice, bob]
  );
  const { rows } = await db.query(
    `select count(*)::int as count from public.transactions where external_ref = 'SHARED-REF'`
  );
  assert.equal(rows[0].count, 2);
});

test('a receipt in Storage is readable only by the account that owns its folder', async () => {
  const mine = await createUser(db, 'receipt-owner@example.com');
  const theirs = await createUser(db, 'receipt-stranger@example.com');

  // Seeded as the table owner, so the object exists to be looked for.
  await db.query(
    `insert into storage.objects (bucket_id, name, metadata)
     values ('receipts', $1, '{"size": 2048}'::jsonb)`,
    [`${mine}/statement.pdf`]
  );

  await asUser(db, theirs, async () => {
    const seen = await db.query(`select name from storage.objects where bucket_id = 'receipts'`);
    assert.equal(seen.rowCount, 0, 'another account listed my receipts');

    const stolen = await db.query('delete from storage.objects where name = $1 returning name', [
      `${mine}/statement.pdf`
    ]);
    assert.equal(stolen.rowCount, 0, 'another account deleted my receipt');
  });

  await asUser(db, mine, async () => {
    const seen = await db.query(`select name from storage.objects where bucket_id = 'receipts'`);
    assert.equal(seen.rowCount, 1);
    assert.equal(seen.rows[0].name, `${mine}/statement.pdf`);
  });
});

test('a receipt cannot be written into another account’s folder', async () => {
  const mine = await createUser(db, 'receipt-writer@example.com');
  const theirs = await createUser(db, 'receipt-target@example.com');

  await asUser(db, mine, async () => {
    await assert.rejects(
      db.query(`insert into storage.objects (bucket_id, name) values ('receipts', $1)`, [
        `${theirs}/planted.pdf`
      ]),
      /row-level security/
    );
  });

  // The refusal must be about the folder, not about writing at all.
  await asUser(db, mine, async () => {
    const written = await db.query(
      `insert into storage.objects (bucket_id, name) values ('receipts', $1) returning name`,
      [`${mine}/mine.pdf`]
    );
    assert.equal(written.rowCount, 1);
  });
});
