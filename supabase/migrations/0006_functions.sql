-- Every table reached through a function, and nothing else.
--
-- Until now the client built its own queries: `from('transactions').select()`
-- with filters attached in JavaScript. That works, but what the application can
-- do with a table is then spread across a dozen files and only the policies say
-- what is allowed. Here the answer is in one place — these functions are the
-- whole surface, and the client calls them by name.
--
-- All of them are `security invoker`, so the policies still decide: a function
-- runs as the caller and sees exactly the rows the caller may see. None of them
-- can widen access; they only name what is done with it.

/* ------------------------------------------------------------ transactions */

-- The window a page needs. Filtering by anything else happens in the browser,
-- because the columns it would filter on are encrypted.
create or replace function public.list_transactions(p_from date default null, p_to date default null)
returns setof public.transactions
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.transactions
  where user_id = auth.uid()
    and (p_from is null or date >= p_from)
    and (p_to is null or date <= p_to)
  order by date desc, created_at desc;
$$;

create or replace function public.get_transaction(p_id uuid)
returns public.transactions
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.transactions where id = p_id and user_id = auth.uid();
$$;

create or replace function public.create_transaction(
  p_id uuid,
  p_date date,
  p_account_id uuid default null,
  p_receipt_path text default null,
  p_secret text default null,
  p_iv text default null,
  p_key_version smallint default null,
  p_ref_hash text default null,
  p_kind text default null,
  p_description text default null,
  p_amount numeric default null,
  p_category text default null,
  p_payment_method text default null,
  p_note text default null,
  p_source text default null,
  p_external_ref text default null
)
returns public.transactions
language sql
volatile
security invoker
set search_path = public
as $$
  insert into public.transactions (
    id, user_id, date, account_id, receipt_path,
    secret, iv, key_version, ref_hash,
    kind, description, amount, category, payment_method, note, source, external_ref
  )
  values (
    coalesce(p_id, gen_random_uuid()), auth.uid(), p_date, p_account_id, p_receipt_path,
    p_secret, p_iv, p_key_version, p_ref_hash,
    p_kind, p_description, p_amount, p_category, p_payment_method, p_note, p_source, p_external_ref
  )
  returning *;
$$;

-- A sealed row is one blob, so an edit replaces the whole of it; the plaintext
-- columns are cleared in the same statement rather than left behind.
create or replace function public.update_transaction(
  p_id uuid,
  p_date date,
  p_account_id uuid default null,
  p_receipt_path text default null,
  p_secret text default null,
  p_iv text default null,
  p_key_version smallint default null,
  p_ref_hash text default null,
  p_kind text default null,
  p_description text default null,
  p_amount numeric default null,
  p_category text default null,
  p_payment_method text default null,
  p_note text default null,
  p_source text default null,
  p_external_ref text default null
)
returns public.transactions
language sql
volatile
security invoker
set search_path = public
as $$
  update public.transactions set
    date = coalesce(p_date, date),
    account_id = p_account_id,
    receipt_path = p_receipt_path,
    secret = p_secret,
    iv = p_iv,
    key_version = p_key_version,
    ref_hash = p_ref_hash,
    kind = p_kind,
    description = p_description,
    amount = p_amount,
    category = p_category,
    payment_method = p_payment_method,
    note = p_note,
    source = p_source,
    external_ref = p_external_ref
  where id = p_id and user_id = auth.uid()
  returning *;
$$;

create or replace function public.delete_transaction(p_id uuid)
returns integer
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.transactions where id = p_id and user_id = auth.uid();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Everything, at once, and nothing else: accounts, budgets, goals and the
-- profile are left standing. Returns how many rows went, so the confirmation
-- can say it rather than assume it.
create or replace function public.reset_transactions()
returns integer
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.transactions where user_id = auth.uid();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

create or replace function public.count_unassigned()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::int from public.transactions where user_id = auth.uid() and account_id is null;
$$;

-- Only the account moves here. A payment method lives inside the sealed blob,
-- so those rows are opened and sealed again one at a time by the client.
create or replace function public.assign_unassigned(p_account_id uuid)
returns integer
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  moved integer;
begin
  update public.transactions
  set account_id = p_account_id
  where user_id = auth.uid() and account_id is null;
  get diagnostics moved = row_count;
  return moved;
end;
$$;

/* ---------------------------------------------------------------- accounts */

create or replace function public.list_accounts()
returns setof public.accounts
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.accounts where user_id = auth.uid() order by name;
$$;

create or replace function public.create_account(p_name text, p_opening_balance numeric default 0)
returns public.accounts
language sql
volatile
security invoker
set search_path = public
as $$
  insert into public.accounts (user_id, name, opening_balance)
  values (auth.uid(), p_name, coalesce(p_opening_balance, 0))
  returning *;
$$;

create or replace function public.delete_account(p_id uuid)
returns integer
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.accounts where id = p_id and user_id = auth.uid();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

/* ----------------------------------------------------------------- budgets */

create or replace function public.list_budgets()
returns setof public.budgets
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.budgets where user_id = auth.uid() order by category;
$$;

-- A limit of zero is how a budget is cleared, so this is one function rather
-- than a set and a delete that could disagree.
create or replace function public.set_budget(p_category text, p_monthly_limit numeric)
returns integer
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  affected integer;
begin
  if coalesce(p_monthly_limit, 0) <= 0 then
    delete from public.budgets where user_id = auth.uid() and category = p_category;
  else
    insert into public.budgets (user_id, category, monthly_limit)
    values (auth.uid(), p_category, p_monthly_limit)
    on conflict (user_id, category) do update
      set monthly_limit = excluded.monthly_limit, updated_at = now();
  end if;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

/* --------------------------------------------------------------- recurring */

create or replace function public.list_recurring()
returns setof public.recurring
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.recurring where user_id = auth.uid() order by day_of_month;
$$;

create or replace function public.create_recurring(
  p_description text,
  p_amount numeric,
  p_category text,
  p_day_of_month smallint,
  p_payment_method text default null
)
returns public.recurring
language sql
volatile
security invoker
set search_path = public
as $$
  insert into public.recurring (user_id, description, amount, category, day_of_month, payment_method)
  values (auth.uid(), p_description, p_amount, p_category, p_day_of_month, p_payment_method)
  returning *;
$$;

create or replace function public.delete_recurring(p_id uuid)
returns integer
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.recurring where id = p_id and user_id = auth.uid();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

/* ------------------------------------------------------------------- goals */

create or replace function public.list_goals()
returns setof public.goal_progress
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.goal_progress where user_id = auth.uid() order by created_at;
$$;

create or replace function public.create_goal(
  p_name text,
  p_target_amount numeric,
  p_icon text default 'target',
  p_saved_amount numeric default 0
)
returns public.goals
language sql
volatile
security invoker
set search_path = public
as $$
  insert into public.goals (user_id, name, target_amount, icon, saved_amount)
  values (auth.uid(), p_name, p_target_amount, coalesce(p_icon, 'target'), coalesce(p_saved_amount, 0))
  returning *;
$$;

create or replace function public.update_goal(
  p_id uuid,
  p_name text default null,
  p_target_amount numeric default null,
  p_icon text default null
)
returns public.goals
language sql
volatile
security invoker
set search_path = public
as $$
  update public.goals set
    name = coalesce(p_name, name),
    target_amount = coalesce(p_target_amount, target_amount),
    icon = coalesce(p_icon, icon)
  where id = p_id and user_id = auth.uid()
  returning *;
$$;

create or replace function public.delete_goal(p_id uuid)
returns integer
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.goals where id = p_id and user_id = auth.uid();
  get diagnostics removed = row_count;
  return removed;
end;
$$;

create or replace function public.list_contributions(p_goal_id uuid)
returns setof public.goal_contributions
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.goal_contributions
  where goal_id = p_goal_id and user_id = auth.uid()
  order by created_at desc;
$$;

create or replace function public.add_contribution(p_goal_id uuid, p_amount numeric)
returns public.goal_contributions
language sql
volatile
security invoker
set search_path = public
as $$
  insert into public.goal_contributions (goal_id, user_id, amount)
  values (p_goal_id, auth.uid(), p_amount)
  returning *;
$$;

/* ---------------------------------------------------------------- profile */

create or replace function public.get_profile()
returns public.profiles
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.profiles where id = auth.uid();
$$;

create or replace function public.save_profile(
  p_display_name text default null,
  p_monthly_budget numeric default null
)
returns public.profiles
language sql
volatile
security invoker
set search_path = public
as $$
  update public.profiles set
    display_name = coalesce(p_display_name, display_name),
    monthly_budget = coalesce(p_monthly_budget, monthly_budget)
  where id = auth.uid()
  returning *;
$$;

/* --------------------------------------------------------- merchant rules */

create or replace function public.list_merchant_rules()
returns setof public.merchant_rules
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.merchant_rules where user_id = auth.uid();
$$;

-- The whole set at once: an import teaches several merchants in one go, and a
-- row at a time would be a round trip each.
create or replace function public.save_merchant_rules(p_rules jsonb)
returns integer
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  saved integer;
begin
  insert into public.merchant_rules (user_id, merchant, category, updated_at)
  select auth.uid(), rule ->> 'merchant', rule ->> 'category', now()
  from jsonb_array_elements(p_rules) as rule
  where coalesce(rule ->> 'merchant', '') <> ''
  on conflict (user_id, merchant) do update
    set category = excluded.category, updated_at = now();
  get diagnostics saved = row_count;
  return saved;
end;
$$;

create or replace function public.forget_merchant_rule(p_merchant text)
returns integer
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  removed integer;
begin
  delete from public.merchant_rules where user_id = auth.uid() and merchant = p_merchant;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

/* ----------------------------------------------------------------- vaults */

create or replace function public.get_vault()
returns public.vaults
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.vaults where user_id = auth.uid();
$$;

create or replace function public.create_vault(p_password jsonb, p_recovery jsonb, p_key_version smallint default 1)
returns public.vaults
language sql
volatile
security invoker
set search_path = public
as $$
  insert into public.vaults (user_id, key_version, password, recovery)
  values (auth.uid(), coalesce(p_key_version, 1), p_password, p_recovery)
  returning *;
$$;

-- Either wrapping can be replaced on its own: a password change rewraps one,
-- a new recovery key the other, and neither touches a row.
create or replace function public.rewrap_vault(p_password jsonb default null, p_recovery jsonb default null)
returns public.vaults
language sql
volatile
security invoker
set search_path = public
as $$
  update public.vaults set
    password = coalesce(p_password, password),
    recovery = coalesce(p_recovery, recovery)
  where user_id = auth.uid()
  returning *;
$$;

/* ------------------------------------------------------------ diagnostics */

-- `now()` is the transaction's clock, so two diagnostics written in one
-- transaction share a timestamp and have no order between them. A diagnostic is
-- an event: it takes the wall clock.
alter table public.diagnostics alter column at set default clock_timestamp();

create or replace function public.record_diagnostic(
  p_code text,
  p_row_id uuid default null,
  p_key_version smallint default null,
  p_app_version text default null,
  p_detail jsonb default '{}'::jsonb
)
returns uuid
language sql
volatile
security invoker
set search_path = public
as $$
  insert into public.diagnostics (user_id, code, row_id, key_version, app_version, detail)
  values (auth.uid(), p_code, p_row_id, p_key_version, p_app_version, coalesce(p_detail, '{}'::jsonb))
  returning id;
$$;

create or replace function public.recent_diagnostics(p_limit integer default 50)
returns setof public.diagnostics
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.diagnostics
  where user_id = auth.uid()
  order by at desc
  limit least(coalesce(p_limit, 50), 200);
$$;
