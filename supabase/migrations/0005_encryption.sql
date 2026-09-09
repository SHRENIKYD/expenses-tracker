-- End-to-end encryption for transaction data.
--
-- The database stops being able to read what a transaction was for, which means
-- it also stops being able to add one up. The aggregate functions in
-- 0002_summary.sql are dropped here and their work moves into the browser,
-- where the key is. What stays readable is what the database still needs to do
-- its job: who owns a row, which account it belongs to, and when it happened.

-- ------------------------------------------------------------------ vaults
-- The data key, wrapped twice — once by the password, once by a recovery key
-- shown to the user at setup. The key itself is never here in the clear, so a
-- copy of this table is worth nothing without one of those two secrets.
create table if not exists public.vaults (
  user_id uuid primary key references auth.users (id) on delete cascade,
  key_version smallint not null default 1,
  -- Each is {salt, iv, wrapped}, all base64.
  password jsonb not null,
  recovery jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vaults enable row level security;

drop policy if exists "vaults are private" on public.vaults;
create policy "vaults are private" on public.vaults
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists vaults_touch_updated_at on public.vaults;
create trigger vaults_touch_updated_at
  before update on public.vaults
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------ transactions
alter table public.transactions
  add column if not exists secret text,
  add column if not exists iv text,
  add column if not exists key_version smallint,
  -- An HMAC of the bank reference under the same key: equal references give
  -- equal digests, so a re-imported statement is still refused, but the digest
  -- says nothing about the reference to anyone without the key.
  add column if not exists ref_hash text;

-- The columns that used to be required are empty on an encrypted row.
alter table public.transactions alter column description drop not null;
alter table public.transactions alter column amount drop not null;
alter table public.transactions alter column category drop not null;
alter table public.transactions alter column kind drop not null;
-- A note and a source are content too, so they empty out as well.
alter table public.transactions alter column note drop not null;
alter table public.transactions alter column source drop not null;

-- A row is one thing or the other, never neither.
alter table public.transactions drop constraint if exists transactions_readable_or_sealed;
alter table public.transactions add constraint transactions_readable_or_sealed check (
  (secret is not null and iv is not null and key_version is not null)
  or (description is not null and amount is not null and category is not null and kind is not null)
);

create unique index if not exists transactions_user_ref_hash_idx
  on public.transactions (user_id, ref_hash)
  where ref_hash is not null;

-- ------------------------------------------------------------- diagnostics
-- What is left to debug with once the data is unreadable: codes, counts and
-- identifiers, never content.
--
-- `detail` holds numbers and booleans and nothing else. A length limit was the
-- first attempt and it was wrong: a description can be short. Refusing strings
-- outright is a rule the database can actually enforce, and it leaves the
-- vocabulary — the code, the key version — in columns of their own where it
-- can be constrained.
create or replace function public.diagnostic_detail_is_safe(detail jsonb)
returns boolean
language sql
immutable
as $$
  select coalesce(bool_and(jsonb_typeof(value) in ('number', 'boolean')), true)
  from jsonb_each(detail);
$$;

create table if not exists public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  code text not null check (code ~ '^[a-z][a-z0-9_.]{1,59}$'),
  row_id uuid,
  key_version smallint,
  app_version text check (app_version is null or length(app_version) <= 40),
  detail jsonb not null default '{}'::jsonb
    check (length(detail::text) <= 2000 and public.diagnostic_detail_is_safe(detail))
);

create index if not exists diagnostics_user_at_idx on public.diagnostics (user_id, at desc);

alter table public.diagnostics enable row level security;

drop policy if exists "diagnostics are private" on public.diagnostics;
create policy "diagnostics are private" on public.diagnostics
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ------------------------------------- the aggregates that can no longer add
-- These read `amount`, `category` and `kind`, which are empty on an encrypted
-- row. Left in place they would answer zero rather than fail, which is the
-- worst thing a total can do.
drop view if exists public.account_balances;
drop function if exists public.daily_series(date, date);
drop function if exists public.period_totals(date, date);
drop function if exists public.category_totals(date, date);
drop function if exists public.account_totals(date, date);
drop function if exists public.monthly_trend(date);
