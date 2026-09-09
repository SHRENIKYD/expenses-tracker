// End-to-end encryption for transaction data.
//
// The database holds ciphertext and never the key, so nothing on the server —
// and nobody with access to it — can read what a transaction was for. That is
// the whole point, and it has a price paid elsewhere: the SQL functions that
// used to compute the dashboard cannot add up numbers they cannot read, so the
// totals are computed in the browser instead.
//
// The shape is standard envelope encryption:
//
//   data key            32 random bytes, AES-GCM. Encrypts every row.
//   password wrapping   PBKDF2-SHA256 over the password, its own salt.
//   recovery wrapping   PBKDF2-SHA256 over a recovery key shown once.
//
// The data key is stored twice, wrapped by each. Changing the password rewraps
// it and leaves every row alone; losing both the password and the recovery key
// means the rows are unreadable by anyone, permanently, which is what makes the
// guarantee worth anything.

const KEY_VERSION = 1;
// OWASP's floor for PBKDF2-HMAC-SHA256 at the time of writing. High enough to
// be felt on a phone once per sign-in, which is the right place to feel it.
const ITERATIONS = 310000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const subtle = globalThis.crypto.subtle;
const utf8 = new TextEncoder();
const text = new TextDecoder();

export const randomBytes = (count) => globalThis.crypto.getRandomValues(new Uint8Array(count));

export function toBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Crockford's alphabet: no I, L, O or U, so a recovery key written down by hand
// cannot be misread as a different one.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function newRecoveryKey() {
  const bytes = randomBytes(20);
  let out = '';
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out.match(/.{1,5}/g).join('-');
}

export const normaliseRecoveryKey = (value) =>
  String(value).toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/I/g, '1').replace(/[LO]/g, '0');

async function wrappingKey(secret, salt) {
  const material = await subtle.importKey('raw', utf8.encode(secret), 'PBKDF2', false, [
    'deriveKey'
  ]);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function wrap(dataKey, secret) {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const kek = await wrappingKey(secret, salt);
  const raw = await subtle.exportKey('raw', dataKey);
  const wrapped = await subtle.encrypt({ name: 'AES-GCM', iv }, kek, raw);
  return { salt: toBase64(salt), iv: toBase64(iv), wrapped: toBase64(new Uint8Array(wrapped)) };
}

async function unwrap(envelope, secret) {
  const kek = await wrappingKey(secret, fromBase64(envelope.salt));
  let raw;
  try {
    raw = await subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
      kek,
      fromBase64(envelope.wrapped)
    );
  } catch {
    // AES-GCM fails as a whole: there is no way to tell a wrong password from a
    // corrupted envelope, and pretending otherwise would leak which it was.
    const error = new Error('That did not unlock your data.');
    error.code = 'unlock_failed';
    throw error;
  }
  return subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt'
  ]);
}

/** A fresh vault: a random data key, wrapped by the password and by a new recovery key. */
export async function createVault(password) {
  const dataKey = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt'
  ]);
  const recoveryKey = newRecoveryKey();

  return {
    dataKey,
    recoveryKey,
    vault: {
      keyVersion: KEY_VERSION,
      password: await wrap(dataKey, password),
      recovery: await wrap(dataKey, normaliseRecoveryKey(recoveryKey))
    }
  };
}

export const unlockWithPassword = (vault, password) => unwrap(vault.password, password);

export const unlockWithRecoveryKey = (vault, recoveryKey) =>
  unwrap(vault.recovery, normaliseRecoveryKey(recoveryKey));

/** A new password wraps the same data key, so no row is touched. */
export async function rewrapPassword(vault, dataKey, password) {
  return { ...vault, password: await wrap(dataKey, password) };
}

/** A new recovery key, replacing the old one, over the same data key. */
export async function reissueRecoveryKey(vault, dataKey) {
  const recoveryKey = newRecoveryKey();
  return { recoveryKey, vault: { ...vault, recovery: await wrap(dataKey, normaliseRecoveryKey(recoveryKey)) } };
}

// The row's id is authenticated alongside its ciphertext, so a blob cannot be
// moved from one row to another and still decrypt.
const associated = (rowId) => utf8.encode(`transaction:${rowId}`);

export async function encryptFields(dataKey, rowId, fields) {
  const iv = randomBytes(IV_BYTES);
  const secret = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: associated(rowId) },
    dataKey,
    utf8.encode(JSON.stringify(fields))
  );
  return { iv: toBase64(iv), secret: toBase64(new Uint8Array(secret)) };
}

export async function decryptFields(dataKey, rowId, iv, secret) {
  let plain;
  try {
    plain = await subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(iv), additionalData: associated(rowId) },
      dataKey,
      fromBase64(secret)
    );
  } catch {
    const error = new Error('This row could not be decrypted.');
    error.code = 'decrypt_failed';
    throw error;
  }
  return JSON.parse(text.decode(plain));
}

// A receipt is a file, so it is encrypted as bytes rather than as JSON. The iv
// travels in front of the ciphertext, which makes the stored object a single
// opaque blob.
export async function encryptBytes(dataKey, name, bytes) {
  const iv = randomBytes(IV_BYTES);
  const sealed = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: utf8.encode(`file:${name}`) },
    dataKey,
    bytes
  );
  const out = new Uint8Array(IV_BYTES + sealed.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(sealed), IV_BYTES);
  return out;
}

export async function decryptBytes(dataKey, name, blob) {
  const bytes = new Uint8Array(blob);
  try {
    return new Uint8Array(
      await subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: bytes.slice(0, IV_BYTES),
          additionalData: utf8.encode(`file:${name}`)
        },
        dataKey,
        bytes.slice(IV_BYTES)
      )
    );
  } catch {
    const error = new Error('This file could not be decrypted.');
    error.code = 'decrypt_failed';
    throw error;
  }
}

// A blind index: the same reference always gives the same digest, so the unique
// index still refuses a statement imported twice, but the digest says nothing
// about the reference to anyone without the key.
export async function blindIndex(dataKey, value) {
  const raw = await subtle.exportKey('raw', dataKey);
  const hmacKey = await subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign'
  ]);
  const digest = await subtle.sign('HMAC', hmacKey, utf8.encode(`ref:${value}`));
  return toBase64(new Uint8Array(digest));
}

export { KEY_VERSION, ITERATIONS };
