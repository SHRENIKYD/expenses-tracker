// Deciding whether a statement row is already in the ledger.
//
// Statement narration and a hand-typed description rarely match exactly, so
// rows are compared on the words that carry meaning, plus amount, direction and
// a few days' leeway. A bank reference, when there is one, is decisive.

function tokens(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3)
  );
}

export function similarity(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

export const daysApart = (a, b) =>
  Math.abs((new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`)) / 86400000);

export const NEAR_DAYS = 3;

// `existing` are rows as the database returns them: amount, kind, description,
// date and external_ref.
export function findDuplicate(candidate, existing) {
  if (candidate.reference) {
    const byRef = existing.find((row) => row.external_ref === candidate.reference);
    if (byRef) return { reason: 'same bank reference', existingId: byRef.id };
  }

  const near = existing.find(
    (row) =>
      Number(row.amount) === candidate.amount &&
      row.kind === candidate.kind &&
      daysApart(row.date, candidate.date) <= NEAR_DAYS &&
      similarity(row.description, candidate.description) >= 0.5
  );
  if (near) {
    return { reason: `matches “${near.description}” on ${near.date}`, existingId: near.id };
  }

  return null;
}
