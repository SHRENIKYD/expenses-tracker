import test from 'node:test';
import assert from 'node:assert/strict';

import { fromTransaction, toWriteArgs } from '../src/data/rows.js';

// PostgREST resolves an RPC by the argument names it receives, and supabase-js
// never sends a key whose value is undefined. p_id and p_date have no defaults,
// so a missing p_id made every insert fail with "could not find the function
// public.create_transaction(...) in the schema cache" — which is what an
// unsealed row, carrying no id of its own, produced on every save.
const PARAMETERS = [
  'p_id',
  'p_date',
  'p_account_id',
  'p_receipt_path',
  'p_secret',
  'p_iv',
  'p_key_version',
  'p_ref_hash',
  'p_kind',
  'p_description',
  'p_amount',
  'p_category',
  'p_payment_method',
  'p_note',
  'p_source',
  'p_external_ref'
];

test('a row without an id still sends every argument, p_id as null', () => {
  const args = toWriteArgs(
    fromTransaction({
      kind: 'expense',
      description: 'Test',
      amount: 100,
      category: 'health',
      date: '2026-09-10'
    })
  );

  assert.deepEqual(Object.keys(args).sort(), [...PARAMETERS].sort());
  for (const name of PARAMETERS) assert.notEqual(args[name], undefined, `${name} is undefined`);
  assert.equal(args.p_id, null);
  assert.equal(args.p_date, '2026-09-10');
  assert.equal(args.p_amount, 100);
});

test('a sealed row carries its own id and its blob, and no plaintext', () => {
  const args = toWriteArgs({
    id: '11111111-1111-1111-1111-111111111111',
    date: '2026-09-10',
    secret: 'sealed',
    iv: 'iv',
    key_version: 1,
    ref_hash: 'digest'
  });

  assert.deepEqual(Object.keys(args).sort(), [...PARAMETERS].sort());
  assert.equal(args.p_id, '11111111-1111-1111-1111-111111111111');
  assert.equal(args.p_secret, 'sealed');
  assert.equal(args.p_description, null);
  assert.equal(args.p_amount, null);
});
