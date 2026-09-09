import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { asUser, createUser, freshDatabase } from './harness.mjs';

// A migration that loads is not the same as a migration that is right. This
// takes the live database's own rows through the export and then asks the new
// one the questions the old one answers, expecting the same numbers.

const SOURCE = process.env.SOURCE_DATABASE_URL;

test('the exported data lands under the policies and still adds up', { skip: !SOURCE }, async () => {
  const db = await freshDatabase('supabase_migration_test');
  const owner = await createUser(db, 'moved@example.com');

  const sql = execFileSync(
    process.execPath,
    ['export-data.mjs', '--user', process.env.SOURCE_USER || 'demo@example.com', '--owner', owner],
    { cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, DATABASE_URL: SOURCE }, encoding: 'utf8' }
  );
  await db.query(sql);

  const source = new (await import('pg')).default.Client({ connectionString: SOURCE });
  await source.connect();

  const before = (
    await source.query(
      `select count(*)::int as rows,
              coalesce(sum(amount) filter (where kind = 'expense'), 0)::float as spent,
              coalesce(sum(amount) filter (where kind = 'income'), 0)::float as earned
       from expenses where user_id = (select id from users where email = $1)`,
      [process.env.SOURCE_USER || 'demo@example.com']
    )
  ).rows[0];
  await source.end();

  // Read it back as the migrated user, through row-level security.
  const after = await asUser(db, owner, async () =>
    (
      await db.query(
        `select count(*)::int as rows,
                coalesce(sum(amount) filter (where kind = 'expense'), 0)::float as spent,
                coalesce(sum(amount) filter (where kind = 'income'), 0)::float as earned
         from public.transactions`
      )
    ).rows[0]
  );

  assert.deepEqual(after, before, 'the moved rows do not reconcile with the originals');

  // And the dashboard's own figures agree across the move.
  const daily = await asUser(db, owner, async () =>
    (await db.query('select * from public.daily_series($1, $2)', ['2026-09-01', '2026-09-30'])).rows
  );
  const september = (
    await db.query(
      `select coalesce(sum(amount), 0)::float as spent from public.transactions
       where kind = 'expense' and date between '2026-09-01' and '2026-09-30'`
    )
  ).rows[0].spent;
  assert.equal(
    Number(daily[daily.length - 1].spent_to_date),
    september,
    'the running total disagrees with the rows it was built from'
  );

  await db.end();
});
