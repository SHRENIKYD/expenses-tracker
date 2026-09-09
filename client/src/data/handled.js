// Which alerts have been dealt with.
//
// A suggestion the user added, or said was not a transaction, must not come
// back the next time the app opens. What is remembered is a digest of the
// message, never the message: the alert itself is not written to this device.
//
// The list is capped, because it only has to cover the few days the reader
// looks back over.

const KEY = 'tessera.messages-handled';
const LIMIT = 400;

// A 64-bit FNV-1a, as two 32-bit halves. Not a cryptographic hash and does not
// need to be: it identifies a message to this device, and it cannot be turned
// back into one.
function digest(text) {
  let high = 0x811c9dc5;
  let low = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    high = Math.imul(high ^ code, 0x01000193) >>> 0;
    low = Math.imul(low ^ ((code << 5) | (code >>> 3)), 0x01000193) >>> 0;
  }
  return `${high.toString(36)}${low.toString(36)}`;
}

export const fingerprint = (suggestion) =>
  digest(`${suggestion.sender}|${suggestion.date}|${suggestion.kind}|${suggestion.amount}|${suggestion.body}`);

function read() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export const handled = () => new Set(read());

export function remember(suggestion) {
  const mark = fingerprint(suggestion);
  const kept = read().filter((entry) => entry !== mark);
  kept.push(mark);

  try {
    localStorage.setItem(KEY, JSON.stringify(kept.slice(-LIMIT)));
  } catch {
    // A private window can refuse storage; the suggestion simply comes back.
  }
  return mark;
}

export function forgetAll() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
