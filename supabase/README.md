# Supabase backend

The schema, the policies that replace the API's ownership checks, the SQL that
replaces its summary route, and the tests for all three.

## Layout

```
migrations/0001_schema.sql    tables, indexes, row-level security
migrations/0002_summary.sql   the dashboard's aggregates as SQL functions
export-data.mjs               moves an existing account's rows across
test/                         policies and functions, run against real Postgres
```

## What changes, and what does not

The tables mirror what the Express API already stores, so rows move across
unchanged and the client keeps its shapes. `expenses` becomes `transactions`,
`users` + `settings` become `profiles`, and receipts move from database bytes to
Supabase Storage.

What changes is who enforces ownership. Today every query carries
`WHERE user_id = $1` behind a `requireUser` middleware; there, every table is
closed by default and a policy opens each row to its owner alone. That is the
riskiest part of the move — a policy that is too generous is a data leak, not a
wrong number — so it is the part with the most tests.

The summary route's queries become `security invoker` SQL functions: they run as
the caller, so the policies still apply, and the aggregation stays in the
database rather than pulling a period's rows into the browser to add up.

## Running the tests

They need a PostgreSQL you can create databases on. Supabase's own pieces are
not required: the harness recreates `auth.users` and `auth.uid()`, then runs the
real migrations and the real policies.

```bash
cd supabase
npm install
ADMIN_URL=postgres://user:pass@localhost:5432/postgres npm test
```

To also check a data move, point it at the database being moved:

```bash
SOURCE_DATABASE_URL=postgres://…/expenses \
ADMIN_URL=postgres://…/postgres npm test
```

## Moving the data

1. Sign up on the new Supabase project with the same email; note the user id
   from **Authentication → Users**.
2. `DATABASE_URL=<old database> node export-data.mjs --user you@example.com --owner <that id> > data.sql`
3. Read `data.sql` — it is plain inserts, and the trailing comment counts what it
   carried and what it left behind.
4. Run it in the Supabase SQL editor.

Receipts are not carried: they are bytes in the old database and belong in
Storage. The script says how many exist rather than dropping them silently.

## Parity

`test/parity.test.mjs` is the test that matters most for the move: it loads the
live rows into the Supabase schema, asks the SQL functions and the client's
assembler for a month, and compares every figure with what the Express API
answers for the same month — totals, count, the previous period, the category
split, all thirty days of the series with their running totals, the twelve-month
trend, upcoming bills and per-account sums.

```bash
SOURCE_DATABASE_URL=postgres://…/expenses \
ADMIN_URL=postgres://…/postgres npm test     # with the API running locally
```

It skips itself when either the source database or the API is unreachable, so
the suite still runs anywhere.

## Pointing the app at Supabase

The client reads three variables. `VITE_DATA_BACKEND` chooses the backend;
the other two configure it:

| Variable | Where it lives | Value |
| --- | --- | --- |
| `VITE_DATA_BACKEND` | repository variable | `supabase`, or anything else for the API |
| `VITE_SUPABASE_URL` | repository variable | the project URL |
| `VITE_SUPABASE_ANON_KEY` | repository variable | the publishable (`sb_publishable_…`) key |

The publishable key is meant to reach the browser — it identifies the project,
it does not grant anything. Row-level security is what keeps one account out of
another's rows, which is why the policies carry the most tests here. The secret
key (`sb_secret_…`) bypasses those policies and must never reach the client or
the repository.

Locally, `client/.env.local` holds the same three names; it is gitignored.

### The cutover

1. Run `migrations/0001_schema.sql`, then `migrations/0002_summary.sql`, in the
   Supabase SQL editor.
2. Sign up in the app once so `auth.users` has a row and the `handle_new_user`
   trigger creates the profile.
3. Move the data with `export-data.mjs` (above) and run the result in the SQL
   editor.
4. Set the three variables, then set `VITE_DATA_BACKEND=supabase` and re-run the
   Pages workflow. The build fails rather than deploys if the project URL is
   missing from the bundle.

Going back is the same switch: clear `VITE_DATA_BACKEND` and re-run the
workflow. Nothing in the Express API is removed until the Supabase side has been
running on real use.
