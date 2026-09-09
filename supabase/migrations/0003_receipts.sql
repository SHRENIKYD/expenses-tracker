-- Receipts move from database bytes to Storage.
--
-- The Express API kept the file itself in a `receipts` table, which put binary
-- data in every backup and counted against the database's gigabyte. Here the
-- file lives in a private bucket and the transaction keeps only its path, so a
-- receipt is fetched with a signed request rather than through the API.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  2097152,
  -- Encrypted receipts are uploaded as opaque bytes; the extension records
  -- what the file really is, so the viewer can still show it.
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'application/octet-stream']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Every object is stored under a folder named for its owner, so ownership is a
-- property of the path and the same check covers reading, writing and deleting.
drop policy if exists "receipts are private" on storage.objects;
create policy "receipts are private" on storage.objects
  for all to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
