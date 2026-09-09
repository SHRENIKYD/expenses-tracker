-- The dashboard's figures, computed where the data is.
--
-- Without an API server, the client would otherwise pull every row of a period
-- and add it up in the browser. These functions keep the aggregation in the
-- database — the same queries the Express route ran — and RLS still applies,
-- because they are `security invoker`: they see exactly what the caller sees.

-- One row per day of a range, gaps filled, with running totals: the prefix sum
-- the client builds its charts from.
create or replace function public.daily_series(from_date date, to_date date)
returns table (
  day date,
  spent numeric,
  earned numeric,
  spent_to_date numeric,
  earned_to_date numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with days as (
    select generate_series(from_date, to_date, interval '1 day')::date as day
  ),
  totals as (
    select t.date,
           sum(t.amount) filter (where t.kind = 'expense') as spent,
           sum(t.amount) filter (where t.kind = 'income') as earned
    from public.transactions t
    where t.user_id = auth.uid() and t.date between from_date and to_date
    group by t.date
  )
  select days.day,
         coalesce(totals.spent, 0) as spent,
         coalesce(totals.earned, 0) as earned,
         sum(coalesce(totals.spent, 0)) over (order by days.day) as spent_to_date,
         sum(coalesce(totals.earned, 0)) over (order by days.day) as earned_to_date
  from days left join totals on totals.date = days.day
  order by days.day;
$$;

-- Totals for a period and for the equally long one before it, so the client can
-- report the change without a second round trip.
create or replace function public.period_totals(from_date date, to_date date)
returns table (period text, kind text, total numeric, transactions bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select case when t.date >= from_date then 'current' else 'previous' end as period,
         t.kind,
         sum(t.amount) as total,
         count(*) as transactions
  from public.transactions t
  where t.user_id = auth.uid()
    and t.date between (from_date - (to_date - from_date + 1)) and to_date
  group by 1, 2;
$$;

create or replace function public.category_totals(from_date date, to_date date)
returns table (category text, total numeric, transactions bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select t.category, sum(t.amount) as total, count(*) as transactions
  from public.transactions t
  where t.user_id = auth.uid()
    and t.kind = 'expense'
    and t.date between from_date and to_date
  group by t.category
  order by sum(t.amount) desc;
$$;

create or replace function public.account_totals(from_date date, to_date date)
returns table (method text, kind text, total numeric, transactions bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(t.payment_method, 'unassigned') as method,
         t.kind,
         sum(t.amount) as total,
         count(*) as transactions
  from public.transactions t
  where t.user_id = auth.uid() and t.date between from_date and to_date
  group by 1, 2;
$$;

-- Twelve months of expense totals, ending with the month given.
create or replace function public.monthly_trend(anchor date)
returns table (month text, total numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with months as (
    select to_char(
             generate_series(
               date_trunc('month', anchor) - interval '11 months',
               date_trunc('month', anchor),
               interval '1 month'
             ),
             'YYYY-MM'
           ) as month
  ),
  totals as (
    select to_char(t.date, 'YYYY-MM') as month, sum(t.amount) as total
    from public.transactions t
    where t.user_id = auth.uid()
      and t.kind = 'expense'
      and t.date >= date_trunc('month', anchor) - interval '11 months'
      and t.date < date_trunc('month', anchor) + interval '1 month'
    group by 1
  )
  select months.month, coalesce(totals.total, 0) as total
  from months left join totals on totals.month = months.month
  order by months.month;
$$;

-- Balances follow from the transactions, so they cannot drift out of step.
create or replace view public.account_balances
with (security_invoker = true) as
  select a.id,
         a.user_id,
         a.name,
         a.opening_balance,
         a.opening_balance
           + coalesce(sum(t.amount) filter (where t.kind = 'income'), 0)
           - coalesce(sum(t.amount) filter (where t.kind = 'expense'), 0) as balance,
         count(t.id) as transactions
  from public.accounts a
  left join public.transactions t on t.account_id = a.id
  group by a.id, a.user_id, a.name, a.opening_balance;

-- A goal's saved amount is its seed plus its contributions.
create or replace view public.goal_progress
with (security_invoker = true) as
  select g.id,
         g.user_id,
         g.name,
         g.icon,
         g.target_amount,
         g.saved_amount + coalesce(sum(c.amount), 0) as saved,
         g.created_at
  from public.goals g
  left join public.goal_contributions c on c.goal_id = g.id
  group by g.id, g.user_id, g.name, g.icon, g.target_amount, g.saved_amount, g.created_at;
