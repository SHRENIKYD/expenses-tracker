-- Expense Tracker on Supabase: schema and row-level security.
--
-- This migration is a move, not a redesign: the tables mirror what the Express
-- API already stores, so data can be carried over row for row and the client
-- keeps the same shapes. What changes is who enforces ownership — every table
-- is closed by default and opened only to the row's own user, which is the job
-- `requireUser` and a `WHERE user_id = $1` on every query used to do.

-- ---------------------------------------------------------------- profiles
-- auth.users belongs to Supabase; this holds what the app needs beside it.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  monthly_budget numeric(12, 2) not null default 0 check (monthly_budget >= 0),
  created_at timestamptz not null default now()
);

-- A row appears the moment someone signs up, so the app never has to cope with
-- a signed-in user who has no profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- accounts
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  opening_balance numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

-- ------------------------------------------------------------ transactions
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid,
  kind text not null default 'expense' check (kind in ('income', 'expense')),
  description text not null check (length(description) between 1 and 200),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  date date not null,
  payment_method text check (payment_method in ('upi', 'card', 'cash', 'bank_transfer')),
  note text not null default '',
  receipt_path text,
  source text not null default 'manual',
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- An account can only be one of your own.
  foreign key (account_id, user_id) references public.accounts (id, user_id) on delete set null
);

create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);
create index if not exists transactions_user_category_idx on public.transactions (user_id, category);
create index if not exists transactions_account_idx on public.transactions (account_id);
-- A bank reference identifies a row uniquely, so importing a statement twice
-- cannot duplicate it — the same guard the API relies on today.
create unique index if not exists transactions_user_ref_idx
  on public.transactions (user_id, external_ref)
  where external_ref is not null;

-- ----------------------------------------------------------------- budgets
create table if not exists public.budgets (
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  monthly_limit numeric(12, 2) not null check (monthly_limit >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

-- --------------------------------------------------------------- recurring
create table if not exists public.recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null check (length(description) between 1 and 200),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null,
  day_of_month smallint not null check (day_of_month between 1 and 28),
  payment_method text check (payment_method in ('upi', 'card', 'cash', 'bank_transfer')),
  created_at timestamptz not null default now()
);

create index if not exists recurring_user_idx on public.recurring (user_id);

-- ------------------------------------------------------------------- goals
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  icon text not null default 'target',
  target_amount numeric(12, 2) not null check (target_amount > 0),
  saved_amount numeric(12, 2) not null default 0 check (saved_amount >= 0),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade
);

create index if not exists goals_user_idx on public.goals (user_id);
create index if not exists contributions_goal_idx on public.goal_contributions (goal_id);

-- ------------------------------------------------------- row-level security
-- Every table is closed until a policy opens it, and each policy says the same
-- thing: a row belongs to whoever is asking, or it does not exist for them.
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.recurring enable row level security;
alter table public.goals enable row level security;
alter table public.goal_contributions enable row level security;

drop policy if exists "profiles are private" on public.profiles;
create policy "profiles are private" on public.profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "accounts are private" on public.accounts;
create policy "accounts are private" on public.accounts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "transactions are private" on public.transactions;
create policy "transactions are private" on public.transactions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "budgets are private" on public.budgets;
create policy "budgets are private" on public.budgets
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "recurring is private" on public.recurring;
create policy "recurring is private" on public.recurring
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "goals are private" on public.goals;
create policy "goals are private" on public.goals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "contributions are private" on public.goal_contributions;
create policy "contributions are private" on public.goal_contributions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Keeping updated_at honest without asking the client to remember.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transactions_touch_updated_at on public.transactions;
create trigger transactions_touch_updated_at
  before update on public.transactions
  for each row execute function public.touch_updated_at();
