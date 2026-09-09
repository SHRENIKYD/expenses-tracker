import test from 'node:test';
import assert from 'node:assert/strict';

import {
  blindIndex,
  createVault,
  decryptFields,
  encryptFields,
  newRecoveryKey,
  normaliseRecoveryKey,
  reissueRecoveryKey,
  rewrapPassword,
  unlockWithPassword,
  unlockWithRecoveryKey
} from '../src/crypto.js';

const PASSWORD = 'a long enough password';
const ROW = 'b0a1c2d3-0000-4000-8000-000000000001';
const FIELDS = { description: 'Rent', amount: 18500, category: 'housing', kind: 'expense' };

test('a vault opens with either the password or the recovery key', async () => {
  const { vault, dataKey, recoveryKey } = await createVault(PASSWORD);

  const box = await encryptFields(dataKey, ROW, FIELDS);
  const byPassword = await unlockWithPassword(vault, PASSWORD);
  const byRecovery = await unlockWithRecoveryKey(vault, recoveryKey);

  assert.deepEqual(await decryptFields(byPassword, ROW, box.iv, box.secret), FIELDS);
  assert.deepEqual(await decryptFields(byRecovery, ROW, box.iv, box.secret), FIELDS);
});

test('a wrong password says only that it did not work', async () => {
  const { vault } = await createVault(PASSWORD);

  await assert.rejects(unlockWithPassword(vault, 'not the password'), (err) => {
    assert.equal(err.code, 'unlock_failed');
    // Nothing in the message distinguishes a wrong password from a damaged
    // envelope: saying which would be a hint worth having.
    assert.doesNotMatch(err.message, /password|corrupt/i);
    return true;
  });
});

test('the vault holds no readable key material', async () => {
  const { vault } = await createVault(PASSWORD);
  const serialised = JSON.stringify(vault);

  assert.doesNotMatch(serialised, new RegExp(PASSWORD));
  assert.deepEqual(Object.keys(vault).sort(), ['keyVersion', 'password', 'recovery']);
  assert.deepEqual(Object.keys(vault.password).sort(), ['iv', 'salt', 'wrapped']);
});

test('ciphertext is bound to its row', async () => {
  const { vault, dataKey } = await createVault(PASSWORD);
  const box = await encryptFields(dataKey, ROW, FIELDS);
  const key = await unlockWithPassword(vault, PASSWORD);

  await assert.rejects(decryptFields(key, 'another-row', box.iv, box.secret), (err) => {
    assert.equal(err.code, 'decrypt_failed');
    return true;
  });
});

test('a tampered byte is refused rather than returned', async () => {
  const { vault, dataKey } = await createVault(PASSWORD);
  const box = await encryptFields(dataKey, ROW, FIELDS);
  const key = await unlockWithPassword(vault, PASSWORD);

  const bytes = [...atob(box.secret)].map((c) => c.charCodeAt(0));
  bytes[4] ^= 0xff;
  const tampered = btoa(String.fromCharCode(...bytes));

  await assert.rejects(decryptFields(key, ROW, box.iv, tampered), (err) => {
    assert.equal(err.code, 'decrypt_failed');
    return true;
  });
});

test('the same fields encrypt differently every time', async () => {
  const { dataKey } = await createVault(PASSWORD);
  const one = await encryptFields(dataKey, ROW, FIELDS);
  const two = await encryptFields(dataKey, ROW, FIELDS);

  assert.notEqual(one.iv, two.iv);
  assert.notEqual(one.secret, two.secret);
});

test('changing the password leaves every row readable', async () => {
  const { vault, dataKey } = await createVault(PASSWORD);
  const box = await encryptFields(dataKey, ROW, FIELDS);

  const rewrapped = await rewrapPassword(vault, dataKey, 'a different password');
  const key = await unlockWithPassword(rewrapped, 'a different password');

  assert.deepEqual(await decryptFields(key, ROW, box.iv, box.secret), FIELDS);
  await assert.rejects(unlockWithPassword(rewrapped, PASSWORD));
});

test('a reissued recovery key replaces the old one and keeps the data', async () => {
  const { vault, dataKey, recoveryKey } = await createVault(PASSWORD);
  const box = await encryptFields(dataKey, ROW, FIELDS);

  const { vault: updated, recoveryKey: fresh } = await reissueRecoveryKey(vault, dataKey);
  const key = await unlockWithRecoveryKey(updated, fresh);

  assert.deepEqual(await decryptFields(key, ROW, box.iv, box.secret), FIELDS);
  await assert.rejects(unlockWithRecoveryKey(updated, recoveryKey));
});

test('a recovery key survives being written down by hand', async () => {
  const key = newRecoveryKey();

  assert.match(key, /^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}$/);
  // Lower case, missing dashes, and the letters people confuse for digits.
  assert.equal(normaliseRecoveryKey(key.toLowerCase()), normaliseRecoveryKey(key));
  assert.equal(normaliseRecoveryKey('ab cd-ef'), 'ABCDEF');
  assert.equal(normaliseRecoveryKey('IL0'), '100');
});

test('the same reference always gives the same blind index, and a different key does not', async () => {
  const first = await createVault(PASSWORD);
  const second = await createVault(PASSWORD);

  const mine = await blindIndex(first.dataKey, '402512345678');
  assert.equal(await blindIndex(first.dataKey, '402512345678'), mine);
  assert.notEqual(await blindIndex(first.dataKey, '402512345679'), mine);
  assert.notEqual(await blindIndex(second.dataKey, '402512345678'), mine);
  assert.doesNotMatch(mine, /402512345678/);
});

test('a diagnostic carries no content, whatever it is handed', async () => {
  const { scrub, makeReporter, CODES } = await import('../src/diagnostics.js');

  assert.deepEqual(
    scrub({
      rows: 12,
      failed: true,
      // Every one of these is dropped: a code belongs in the code column, and
      // 'Rent' is exactly as revealing as the sentence below it.
      code: 'decrypt_failed',
      category: 'housing',
      description: 'Rent',
      amount: '18500.00',
      note: 'Dinner with friends at Toit'
    }),
    { rows: 12, failed: true }
  );

  // A code has to be one of the known ones, so a message cannot be smuggled in
  // as a code either.
  const sent = [];
  const report = makeReporter({ insert: async (entry) => sent.push(entry), appVersion: 'test' });
  await assert.rejects(report('anything I like'), /Unknown diagnostic code/);

  await report(CODES[0], { rowId: 'row-1', rows: 3, description: 'Rent' });
  assert.deepEqual(sent[0].detail, { rows: 3 });
});

test('a failure to report is not itself a failure', async () => {
  const { makeReporter, CODES } = await import('../src/diagnostics.js');
  const report = makeReporter({
    insert: async () => {
      throw new Error('offline');
    },
    appVersion: 'test'
  });

  await report(CODES[0], { rows: 1 });
});
