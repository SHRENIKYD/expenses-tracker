-- Importing a statement in one call rather than one call per row.
--
-- A 252-row statement meant 252 round trips from a phone: a minute of them,
-- any one of which could fail with "Failed to fetch" and lose the rest. The
-- whole batch is one statement here, and the unique indexes on the bank
-- reference — plaintext and blind — decide what is a repeat, so importing the
-- same statement twice adds nothing and raises nothing.

create or replace function public.create_transactions(p_rows jsonb)
returns integer
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  added integer;
begin
  insert into public.transactions (
    id, user_id, date, account_id, receipt_path,
    secret, iv, key_version, ref_hash,
    kind, description, amount, category, payment_method, note, source, external_ref
  )
  select
    coalesce((entry ->> 'id')::uuid, gen_random_uuid()),
    auth.uid(),
    (entry ->> 'date')::date,
    (entry ->> 'account_id')::uuid,
    entry ->> 'receipt_path',
    entry ->> 'secret',
    entry ->> 'iv',
    (entry ->> 'key_version')::smallint,
    entry ->> 'ref_hash',
    entry ->> 'kind',
    entry ->> 'description',
    (entry ->> 'amount')::numeric,
    entry ->> 'category',
    entry ->> 'payment_method',
    entry ->> 'note',
    entry ->> 'source',
    entry ->> 'external_ref'
  from jsonb_array_elements(p_rows) as entry
  on conflict do nothing;

  get diagnostics added = row_count;
  return added;
end;
$$;

notify pgrst, 'reload schema';
