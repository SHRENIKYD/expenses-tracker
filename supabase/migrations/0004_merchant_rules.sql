-- What a merchant means to you.
--
-- The importer guesses a category from a keyword list, which is right often
-- enough to be useful and wrong often enough to be annoying. A correction made
-- once in the preview is remembered here, so the same merchant is categorised
-- the same way every month after that.

create table if not exists public.merchant_rules (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The merchant reduced to its distinctive words: a statement prints the same
  -- shop with different reference numbers every time.
  merchant text not null check (length(merchant) between 1 and 60),
  category text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, merchant)
);

alter table public.merchant_rules enable row level security;

drop policy if exists "merchant rules are private" on public.merchant_rules;
create policy "merchant rules are private" on public.merchant_rules
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
