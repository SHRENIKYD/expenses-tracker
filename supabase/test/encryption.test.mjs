import test from 'node:test';
import assert from 'node:assert/strict';
import { asUser, createUser, freshDatabase } from './harness.mjs';

// The database can no longer read a transaction, so what is tested here is what
// it still has to guarantee: that a vault belongs to one account, that a row
// cannot be stored half-sealed, that the blind index still refuses a statement
// imported twice, and that a diagnostic cannot carry content.

const db = await freshDatabase('supabase_encryption_test');
const alice = await createUser(db, 'alice@example.com');
const bob = await createUser(db, 'bob@example.com');

test.after(() => db.end());

const VAULT = {
  password: { salt: 'c2FsdA==', iv: 'aXY=', wrapped: 'd3JhcHBlZA==' },
  recovery: { salt: 'c2FsdDI=', iv: 'aXYy', wrapped: 'd3JhcHBlZDI=' }
};

test('a vault is readable only by the account it belongs to', async () => {
  await db.query(
    'insert into public.vaults (user_id, password, recovery) values ($1, $2, $3)',
    [alice, VAULT.password, VAULT.recovery]
  );

  await asUser(db, bob, async () => {
    const seen = await db.query('select user_id from public.vaults');
    assert.equal(seen.rowCount, 0, 'another account read my vault');

    const stolen = await db.query(
      'update public.vaults set password = $1 where user_id = $2 returning user_id',
      [VAULT.recovery, alice]
    );
    assert.equal(stolen.rowCount, 0, 'another account rewrapped my key');
  });

  await asUser(db, alice, async () => {
    const seen = await db.query('select key_version from public.vaults');
    assert.equal(seen.rowCount, 1);
    assert.equal(seen.rows[0].key_version, 1);
  });
});

test('a transaction is either readable or sealed, never neither', async () => {
  await asUser(db, alice, async () => {
    await assert.rejects(
      db.query(
        `insert into public.transactions (user_id, date) values ($1, '2026-09-01')`,
        [alice]
      ),
      /transactions_readable_or_sealed/
    );
  });

  // A failed statement aborts its transaction, so the row that must be accepted
  // is written in one of its own.
  await asUser(db, alice, async () => {
    const sealed = await db.query(
      `insert into public.transactions (user_id, date, secret, iv, key_version)
       values ($1, '2026-09-01', 'Y2lwaGVy', 'aXY=', 1) returning id`,
      [alice]
    );
    assert.equal(sealed.rowCount, 1);
  });
});

test('a sealed row keeps nothing readable', async () => {
  const { rows } = await db.query(
    `select description, amount, category, kind, note, source, external_ref
     from public.transactions where user_id = $1 and secret is not null`,
    [alice]
  );

  for (const row of rows) {
    for (const [column, value] of Object.entries(row)) {
      assert.equal(value, null, `${column} was still stored in the clear`);
    }
  }
});

test('the blind index still refuses the same statement twice', async () => {
  await asUser(db, alice, async () => {
    await db.query(
      `insert into public.transactions (user_id, date, secret, iv, key_version, ref_hash)
       values ($1, '2026-09-02', 'Y2lwaGVy', 'aXY=', 1, 'ZGlnZXN0')`,
      [alice]
    );

    await assert.rejects(
      db.query(
        `insert into public.transactions (user_id, date, secret, iv, key_version, ref_hash)
         values ($1, '2026-09-03', 'Y2lwaGVy', 'aXY=', 1, 'ZGlnZXN0')`,
        [alice]
      ),
      /transactions_user_ref_hash_idx/
    );
  });
});

test('two accounts may hold the same digest as each other', async () => {
  await db.query(
    `insert into public.transactions (user_id, date, secret, iv, key_version, ref_hash)
     values ($1, '2026-09-02', 'Y2lwaGVy', 'aXY=', 1, 'ZGlnZXN0')`,
    [bob]
  );
});

test('a diagnostic cannot carry content', async () => {
  await asUser(db, alice, async () => {
    await db.query(
      `insert into public.diagnostics (user_id, code, detail) values ($1, 'row.decrypt_failed', $2)`,
      [alice, { rows: 3, failed: true }]
    );

  });

  // A string in `detail` is refused whatever its length: 'Rent' is as revealing
  // as a sentence.
  await asUser(db, alice, async () => {
    await assert.rejects(
      db.query(
        `insert into public.diagnostics (user_id, code, detail) values ($1, 'row.decrypt_failed', $2)`,
        [alice, { category: 'Rent' }]
      ),
      /diagnostic/
    );
  });

  // And a code is a code, not a message.
  await asUser(db, alice, async () => {
    await assert.rejects(
      db.query(
        `insert into public.diagnostics (user_id, code) values ($1, 'Rent 18500 to landlord')`,
        [alice]
      ),
      /diagnostics_code_check/
    );
  });
});

test('diagnostics are private too', async () => {
  await asUser(db, bob, async () => {
    const seen = await db.query('select code from public.diagnostics');
    assert.equal(seen.rowCount, 0);
  });
});

test('the aggregates that could no longer add are gone', async () => {
  const { rows } = await db.query(
    `select routine_name from information_schema.routines
     where routine_schema = 'public'
       and routine_name in ('daily_series','period_totals','category_totals','account_totals','monthly_trend')`
  );
  assert.deepEqual(rows, [], 'a function that reads an empty column is still callable');

  const views = await db.query(
    `select table_name from information_schema.views
     where table_schema = 'public' and table_name = 'account_balances'`
  );
  assert.equal(views.rowCount, 0);
});
