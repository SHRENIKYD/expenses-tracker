-- Knowing an account when a statement or an alert names it.
--
-- A statement prints its bank and account number; a bank alert prints the
-- bank in its sender and the account's last digits in its text. The bank and
-- the last four digits are enough to tell a person's accounts apart, and they
-- are the same whichever of the two they arrive from, so they identify the
-- account: the first statement or alert that names it creates it, and every
-- later one finds it.
--
-- The digits are the ones the bank itself prints on an alert — never the full
-- number — so nothing is stored here that a bank's own SMS does not already
-- show.

alter table public.accounts add column if not exists bank_code text;
alter table public.accounts add column if not exists number_tail text
  check (number_tail is null or number_tail ~ '^[0-9]{3,6}$');

-- One account per bank and number, however many imports name it at once.
create unique index if not exists accounts_user_bank_tail_idx
  on public.accounts (user_id, bank_code, number_tail)
  where bank_code is not null and number_tail is not null;

-- The account a statement or an alert belongs to, created if this is the
-- first time it has been seen. An account made by hand is adopted rather than
-- duplicated when its name carries the same last digits: "HDFC ••3596" and
-- "Salary 3596" are both taken to be it.
create or replace function public.ensure_account(
  p_bank_code text,
  p_number_tail text,
  p_name text,
  p_opening_balance numeric default 0
)
returns public.accounts
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  found public.accounts;
begin
  select * into found from public.accounts
  where user_id = auth.uid() and bank_code = p_bank_code and number_tail = p_number_tail;
  if found.id is not null then
    return found;
  end if;

  update public.accounts
  set bank_code = p_bank_code, number_tail = p_number_tail
  where id = (
    select id from public.accounts
    where user_id = auth.uid()
      and bank_code is null
      and number_tail is null
      and name ~ ('(^|[^0-9])' || p_number_tail || '([^0-9]|$)')
    order by created_at
    limit 1
  )
  returning * into found;
  if found.id is not null then
    return found;
  end if;

  insert into public.accounts (user_id, name, opening_balance, bank_code, number_tail)
  values (auth.uid(), left(p_name, 80), coalesce(p_opening_balance, 0), p_bank_code, p_number_tail)
  on conflict (user_id, bank_code, number_tail) where bank_code is not null and number_tail is not null
  do nothing
  returning * into found;
  if found.id is not null then
    return found;
  end if;

  -- Another import created it between the look and the insert.
  select * into found from public.accounts
  where user_id = auth.uid() and bank_code = p_bank_code and number_tail = p_number_tail;
  return found;
end;
$$;

notify pgrst, 'reload schema';
