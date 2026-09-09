// What is left to debug with when the data cannot be read.
//
// Every field here is deliberately incapable of carrying content: a code from a
// fixed list, an identifier, a count, a length. The database refuses a string
// longer than 64 characters in `detail`, so this is a guard rather than a
// promise — but the promise is the point, so the scrubber below drops anything
// that is not a number, a boolean or a short token before it is sent.

// The only strings allowed through. Anything else — a description, a merchant,
// an amount formatted as text — is dropped, because a rule about length or
// shape would let 'Rent' past.
export const CODES = [
  'vault.missing',
  'vault.unlock_failed',
  'vault.cache_rejected',
  'row.decrypt_failed',
  'row.sealed_without_key',
  'row.legacy_plaintext',
  'summary.window_empty',
  'import.rejected_rows',
  'storage.upload_failed',
  'storage.fetch_failed'
];



/**
 * Numbers and booleans. Nothing else survives — not a short string, not an
 * amount formatted as text — because any rule about the shape of a string lets
 * something through: a description can be one word. What a report needs to say
 * in words is said by its code, which is a value from a fixed list.
 */
export function scrub(detail = {}) {
  const safe = {};
  for (const [name, value] of Object.entries(detail)) {
    if (typeof value === 'number' && Number.isFinite(value)) safe[name] = value;
    else if (typeof value === 'boolean') safe[name] = value;
  }
  return safe;
}

export function makeReporter({ insert, appVersion }) {
  return async function report(code, { rowId = null, keyVersion = null, ...detail } = {}) {
    if (!CODES.includes(code)) throw new Error(`Unknown diagnostic code: ${code}`);
    try {
      await insert({
        code,
        row_id: rowId,
        key_version: keyVersion,
        app_version: appVersion,
        detail: scrub(detail)
      });
    } catch {
      // Reporting a problem must never become one. A failure here is silent by
      // design: the panel in Settings reads the same state directly.
    }
  };
}
