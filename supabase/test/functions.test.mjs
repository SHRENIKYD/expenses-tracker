import test from 'node:test';
import assert from 'node:assert/strict';
import { asUser, createUser, freshDatabase } from './harness.mjs';

// The functions are the whole surface the client has, so what matters is that
// each one does its job for its own caller and nothing for anybody else. They
// are `security invoker`, so the policies still decide — these tests prove the
// functions did not find a way around them.

const db = await freshDatabase('supabase_function_test');
const alice = await createUser(db, 'alice@example.com');
const bob = await createUser(db, 'bob@example.com');

test.after(() => db.end());

const sealed = (date, ref = null) => [date, 'Y2lwaGVy', 'aXY=', 1, ref];

async function seed(owner, rows) {
  for (const [date, secret, iv, version, ref] of rows.map((row) => sealed(...row))) {
    await db.query(
      `insert into public.transactions (user_id, date, secret, iv, key_version, ref_hash)
       values ($1, $2, $3, $4, $5, $6)`,
      [owner, date, secret, iv, version, ref]
    );
  }
}

test('a listing answers with the caller’s rows, in its window', async () => {
  await seed(alice, [['2026-09-01'], ['2026-09-15'], ['2026-10-02']]);
  await seed(bob, [['2026-09-10']]);

  await asUser(db, alice, async () => {
    const all = await db.query('select * from public.list_transactions()');
    assert.equal(all.rowCount, 3, 'the caller sees their own rows and no others');

    const september = await db.query(
      'select date from public.list_transactions($1, $2)',
      ['2026-09-01', '2026-09-30']
    );
    assert.equal(september.rowCount, 2);
  });
});

test('a transaction is created for whoever calls, whatever it claims', async () => {
  await asUser(db, alice, async () => {
    const { rows } = await db.query(
      `select * from public.create_transaction(
         gen_random_uuid(), '2026-09-20'::date, null, null, 'Y2lwaGVy', 'aXY=', 1::smallint
       )`
    );
    assert.equal(rows[0].user_id, alice);
    assert.equal(rows[0].secret, 'Y2lwaGVy');
  });
});

test('another account’s row cannot be read, changed or deleted through the functions', async () => {
  const { rows } = await db.query(
    'select id from public.transactions where user_id = $1 limit 1',
    [alice]
  );
  const mine = rows[0].id;

  await asUser(db, bob, async () => {
    const seen = await db.query('select * from public.get_transaction($1)', [mine]);
    assert.equal(seen.rows[0].id, null, 'a row belonging to someone else came back');

    const changed = await db.query(
      `select id from public.update_transaction($1, '2026-01-01'::date)`,
      [mine]
    );
    assert.equal(changed.rows[0].id, null);

    const removed = await db.query('select public.delete_transaction($1) as removed', [mine]);
    assert.equal(removed.rows[0].removed, 0);
  });
});

test('the reset removes every transaction of the caller and nothing else', async () => {
  await db.query(
    `insert into public.accounts (user_id, name, opening_balance) values ($1, 'Bank', 100)`,
    [alice]
  );
  await db.query(
    `insert into public.goals (user_id, name, target_amount) values ($1, 'Camera', 40000)`,
    [alice]
  );

  const before = await db.query('select count(*)::int as rows from public.transactions where user_id = $1', [bob]);

  await asUser(db, alice, async () => {
    const { rows } = await db.query('select public.reset_transactions() as removed');
    assert.ok(rows[0].removed >= 3, 'it reported what it removed');

    const left = await db.query('select * from public.list_transactions()');
    assert.equal(left.rowCount, 0);

    // Everything that is not a transaction is still there.
    assert.equal((await db.query('select * from public.list_accounts()')).rowCount, 1);
    assert.equal((await db.query('select * from public.list_goals()')).rowCount, 1);
  });

  const after = await db.query('select count(*)::int as rows from public.transactions where user_id = $1', [bob]);
  assert.equal(after.rows[0].rows, before.rows[0].rows, 'another account lost rows');
});

test('a budget of nothing is a budget removed', async () => {
  await asUser(db, alice, async () => {
    await db.query(`select public.set_budget('food', 4000)`);
    assert.equal((await db.query('select * from public.list_budgets()')).rowCount, 1);

    await db.query(`select public.set_budget('food', 6000)`);
    const one = await db.query('select monthly_limit from public.list_budgets()');
    assert.equal(one.rowCount, 1, 'setting it twice made two budgets');
    assert.equal(Number(one.rows[0].monthly_limit), 6000);

    await db.query(`select public.set_budget('food', 0)`);
    assert.equal((await db.query('select * from public.list_budgets()')).rowCount, 0);
  });
});

test('merchant rules are written as a set, and the last word wins', async () => {
  await asUser(db, alice, async () => {
    await db.query(`select public.save_merchant_rules($1::jsonb)`, [
      JSON.stringify([
        { merchant: 'swiggy order', category: 'food' },
        { merchant: 'amazonmumbai', category: 'other' },
        { merchant: '', category: 'ignored' }
      ])
    ]);
    assert.equal((await db.query('select * from public.list_merchant_rules()')).rowCount, 2);

    await db.query(`select public.save_merchant_rules($1::jsonb)`, [
      JSON.stringify([{ merchant: 'amazonmumbai', category: 'shopping' }])
    ]);
    const rules = await db.query(
      `select category from public.list_merchant_rules() where merchant = 'amazonmumbai'`
    );
    assert.equal(rules.rows[0].category, 'shopping');

    await db.query(`select public.forget_merchant_rule('swiggy order')`);
    assert.equal((await db.query('select * from public.list_merchant_rules()')).rowCount, 1);
  });
});

test('a vault is created once and rewrapped in halves', async () => {
  const password = { salt: 'c2E=', iv: 'aXY=', wrapped: 'dzE=' };
  const recovery = { salt: 'c2I=', iv: 'aXcy', wrapped: 'dzI=' };

  await asUser(db, alice, async () => {
    await db.query('select * from public.create_vault($1::jsonb, $2::jsonb)', [
      JSON.stringify(password),
      JSON.stringify(recovery)
    ]);

    // A password change replaces one wrapping and leaves the other alone.
    await db.query('select * from public.rewrap_vault($1::jsonb, null)', [
      JSON.stringify({ ...password, wrapped: 'dzM=' })
    ]);

    const { rows } = await db.query('select password, recovery from public.get_vault()');
    assert.equal(rows[0].password.wrapped, 'dzM=');
    assert.equal(rows[0].recovery.wrapped, 'dzI=');
  });

  await asUser(db, bob, async () => {
    const { rows } = await db.query('select user_id from public.get_vault()');
    assert.equal(rows[0].user_id, null, 'another account read my vault through a function');
  });
});

test('a diagnostic records under the caller and reads back newest first', async () => {
  await asUser(db, alice, async () => {
    await db.query(`select public.record_diagnostic('row.decrypt_failed', null, 1::smallint, 'test', '{"rows": 2}'::jsonb)`);
    await db.query(`select public.record_diagnostic('vault.missing')`);

    const { rows } = await db.query('select code from public.recent_diagnostics(10)');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].code, 'vault.missing');
  });

  await asUser(db, bob, async () => {
    assert.equal((await db.query('select * from public.recent_diagnostics()')).rowCount, 0);
  });
});
