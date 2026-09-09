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

// The rows are indexed rather than scanned.
//
// A statement of n rows checked against m recorded ones was n × m comparisons,
// and the message reader ran the same scan for every alert on every launch. Two
// hash tables make each check a constant number of probes: one keyed on the
// bank reference, one on the things that must match exactly — direction, amount
// and day. The fuzzy part, the narration, is then compared only against the
// handful of rows in that one bucket, which is almost always none or one.
//
// Building the index is O(m) once; each lookup is O(1) — seven probes, one per
// day in the window, whatever m is.

const exactKey = (kind, amount, day) => `${kind}|${Number(amount).toFixed(2)}|${day}`;

export function buildIndex(rows) {
  const byReference = new Map();
  const byShape = new Map();

  for (const row of rows) {
    if (row.external_ref) byReference.set(row.external_ref, row);

    const key = exactKey(row.kind, row.amount, row.date);
    const bucket = byShape.get(key);
    if (bucket) bucket.push(row);
    else byShape.set(key, [row]);
  }

  return {
    size: rows.length,
    find(candidate) {
      if (candidate.reference) {
        const byRef = byReference.get(candidate.reference);
        if (byRef) return { reason: 'same bank reference', existingId: byRef.id };
      }

      // The window is a fixed seven days, so this loop does not grow with the
      // ledger — it is the same seven probes for a hundred rows or a million.
      for (let offset = -NEAR_DAYS; offset <= NEAR_DAYS; offset += 1) {
        const day = shift(candidate.date, offset);
        const bucket = byShape.get(exactKey(candidate.kind, candidate.amount, day));
        if (!bucket) continue;

        for (const row of bucket) {
          if (similarity(row.description, candidate.description) >= 0.5) {
            return { reason: `matches “${row.description}” on ${row.date}`, existingId: row.id };
          }
        }
      }

      return null;
    }
  };
}

const shift = (day, days) =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

/**
 * One candidate against a set of rows. Building an index for a single lookup
 * costs what the scan did, so this stays for the one-off case; anything
 * checking more than a couple of candidates should build the index once.
 */
export const findDuplicate = (candidate, existing) => buildIndex(existing).find(candidate);
