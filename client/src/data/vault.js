// The key, and where it lives.
//
// In memory for the tab that unlocked it, and — so a reload does not ask again —
// in sessionStorage, which the browser drops when the tab closes. Never in
// localStorage, never sent anywhere, and never written next to the data it
// opens. A fresh tab asks for the password.

import {
  createVault,
  decryptBytes,
  decryptFields,
  encryptBytes,
  encryptFields,
  blindIndex,
  reissueRecoveryKey,
  rewrapPassword,
  unlockWithPassword,
  unlockWithRecoveryKey,
  toBase64,
  fromBase64
} from '../crypto.js';

const CACHE = 'expenses.datakey';

let dataKey = null;
let envelope = null;
let listeners = new Set();

const announce = () => listeners.forEach((listener) => listener(isUnlocked()));

export const onLockChange = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const isUnlocked = () => dataKey !== null;
export const currentEnvelope = () => envelope;

async function cache(key) {
  try {
    const raw = await globalThis.crypto.subtle.exportKey('raw', key);
    sessionStorage.setItem(CACHE, toBase64(new Uint8Array(raw)));
  } catch {
    // A private window can refuse storage; the key simply stays in memory.
  }
}

async function fromCache() {
  try {
    const stored = sessionStorage.getItem(CACHE);
    if (!stored) return null;
    return await globalThis.crypto.subtle.importKey(
      'raw',
      fromBase64(stored),
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  } catch {
    return null;
  }
}

export function forget() {
  dataKey = null;
  envelope = null;
  try {
    sessionStorage.removeItem(CACHE);
  } catch {
    // nothing to clear
  }
  announce();
}

/** Adopt a vault row; returns true when a cached key already opens it. */
export async function adopt(stored) {
  envelope = stored;
  if (!stored) return false;

  const cached = await fromCache();
  if (!cached) return false;

  // A cached key that no longer matches the vault is worse than none.
  try {
    const probe = await encryptFields(cached, 'probe', { ok: true });
    await decryptFields(cached, 'probe', probe.iv, probe.secret);
    dataKey = cached;
    announce();
    return true;
  } catch {
    forget();
    return false;
  }
}

export async function unlock(password) {
  if (!envelope) throw new Error('There is no vault for this account yet.');
  dataKey = await unlockWithPassword(envelope, password);
  await cache(dataKey);
  announce();
}

export async function unlockWithKey(recoveryKey) {
  if (!envelope) throw new Error('There is no vault for this account yet.');
  dataKey = await unlockWithRecoveryKey(envelope, recoveryKey);
  await cache(dataKey);
  announce();
}

/** A brand new vault. The recovery key is returned once and never stored. */
export async function create(password) {
  const created = await createVault(password);
  dataKey = created.dataKey;
  envelope = created.vault;
  await cache(dataKey);
  announce();
  return { vault: created.vault, recoveryKey: created.recoveryKey };
}

export async function rewrap(password) {
  requireKey();
  envelope = await rewrapPassword(envelope, dataKey, password);
  return envelope;
}

export async function newRecovery() {
  requireKey();
  const { vault, recoveryKey } = await reissueRecoveryKey(envelope, dataKey);
  envelope = vault;
  return { vault, recoveryKey };
}

function requireKey() {
  if (!dataKey) {
    const error = new Error('Your data is locked. Enter your password to unlock it.');
    error.code = 'locked';
    throw error;
  }
  return dataKey;
}

/** The fields that never reach the database in the clear. */
const SEALED = ['kind', 'description', 'amount', 'category', 'paymentMethod', 'note', 'source', 'externalRef'];

export async function seal(row) {
  const key = requireKey();
  const id = row.id || globalThis.crypto.randomUUID();

  const fields = {};
  for (const name of SEALED) if (row[name] !== undefined) fields[name] = row[name];

  const { iv, secret } = await encryptFields(key, id, fields);
  return {
    id,
    iv,
    secret,
    key_version: envelope.keyVersion,
    ref_hash: row.externalRef ? await blindIndex(key, row.externalRef) : null
  };
}

export async function open(row) {
  const key = requireKey();
  return decryptFields(key, row.id, row.iv, row.secret);
}

export const referenceDigest = async (value) => blindIndex(requireKey(), value);

export const sealBytes = (name, bytes) => encryptBytes(requireKey(), name, bytes);
export const openBytes = (name, blob) => decryptBytes(requireKey(), name, blob);
