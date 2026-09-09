// Reducing a statement narration to the merchant behind it.
//
// The same shop appears with a different reference number, terminal id and city
// every month, so a rule keyed on the whole narration would never match twice.
// Keeping the first couple of distinctive words is enough to recognise it and
// short enough not to key on a transaction id.

const NOISE = new Set([
  'upi',
  'imps',
  'neft',
  'rtgs',
  'pos',
  'atm',
  'ref',
  'txn',
  'payment',
  'purchase',
  'transaction',
  'india',
  'private',
  'limited',
  'ltd',
  'pvt'
]);

export function merchantKey(description) {
  const words = String(description)
    .toLowerCase()
    .replace(/[^a-z ]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !NOISE.has(word));

  return words.slice(0, 2).join(' ').slice(0, 60);
}
