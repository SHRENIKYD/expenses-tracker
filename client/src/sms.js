// Reading a bank's SMS.
//
// The same discipline as the statement parser: a message that cannot be read
// with confidence is ignored rather than guessed at, and nothing it produces is
// recorded without being confirmed. A wrong amount entered silently is worse
// than a message the app did not understand.
//
// Indian bank alerts vary by bank and by product, but they share a shape:
// an amount, a direction word, an account or card tail, and — for anything
// worth recording — a counterparty.

const MONEY = /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;

// Words that decide which way the money went. `debited` and `credited` are the
// common pair; `spent`, `paid` and `withdrawn` only ever mean out.
const OUT = /\b(debited|spent|paid|withdrawn|purchase|deducted)\b/i;
const IN = /\b(credited|received|refunded|deposited)\b/i;

// Messages that carry an amount but are not a transaction. Balance alerts are
// the dangerous ones: they read almost exactly like a payment.
const NOT_A_TRANSACTION =
  /\b(otp|one time password|will be debited|has been requested|requesting|balance is|avl bal|available balance|min(?:imum)? (?:amount )?due|due on|statement|e-?statement|reminder|offer|cashback offer|apply now|loan|credit limit|emi option)\b/i;

// An account or card, as the bank prints it: "A/c XX3596", "card ending 1234".
const TAIL = /(?:a\/?c|acct|account|card)\s*(?:no\.?|number|ending|xx+|x+|\*+)?\s*[xX*]*(\d{3,6})\b/i;

const REFERENCE = /\b(?:upi|imps|neft|rtgs|txn|ref(?:erence)?(?:\s*no)?|rrn)[:\s.#-]*([A-Za-z0-9]{6,25})\b/i;

// The counterparty, in the forms the alerts use. Ordered: the more specific
// pattern wins, so "to VPA swiggy@ybl" is preferred over a trailing "at".
const PARTY = [
  /\b(?:to|at|towards)\s+VPA\s+([^\s,.;]+)/i,
  /\bVPA\s+([^\s,.;]+)/i,
  /\btrf\s+to\s+([A-Za-z0-9 &._-]{2,40})/i,
  /\b(?:to|at|towards|in favour of)\s+([A-Za-z0-9&._-][A-Za-z0-9 &._-]{1,39})/i,
  /\bfrom\s+([A-Za-z0-9&._-][A-Za-z0-9 &._-]{1,39})/i
];

// A merchant name runs until the message goes back to talking about the
// transaction: "AMAZON on 09-Sep-26" is a shop called Amazon.
const AFTER_THE_NAME = /\s+(?:on|dt|dated|at|via|through|ref|txn|upi|imps|neft|rtgs|by|for)\b.*$/i;

const clean = (value) =>
  String(value)
    .replace(/\s+/g, ' ')
    .replace(AFTER_THE_NAME, '')
    .replace(/[.,;:-]+$/, '')
    .trim()
    .slice(0, 60);

/** The merchant, as a person would read it out of the message. */
export function counterparty(body) {
  for (const pattern of PARTY) {
    const found = pattern.exec(body);
    if (!found) continue;
    // A UPI handle names the merchant before the @.
    const value = clean(found[1]).split('@')[0];
    if (value && !/^\d+$/.test(value)) return value;
  }
  return null;
}

/**
 * A transaction, or null when the message is not one — or is one this cannot
 * read. The caller shows what comes back for confirmation; nothing here writes
 * anything down.
 */
export function readMessage({ sender = '', body = '', at = Date.now() } = {}) {
  const text = String(body);
  if (!text) return null;
  if (NOT_A_TRANSACTION.test(text)) return null;

  const amount = MONEY.exec(text);
  if (!amount) return null;

  const value = Number(amount[1].replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0) return null;

  const out = OUT.test(text);
  const income = IN.test(text);
  // Both or neither means the direction is a guess, and a guess about
  // direction is the one mistake that cannot be spotted from a total.
  if (out === income) return null;

  const tail = TAIL.exec(text);
  const reference = REFERENCE.exec(text);
  const party = counterparty(text);

  return {
    kind: out ? 'expense' : 'income',
    amount: Math.round(value * 100) / 100,
    description: party || `${out ? 'Payment' : 'Credit'} from ${clean(sender) || 'bank'}`,
    merchant: party,
    accountTail: tail ? tail[1] : null,
    reference: reference ? reference[1].toUpperCase() : null,
    date: new Date(at).toISOString().slice(0, 10),
    sender: clean(sender),
    // Kept so the confirmation screen can show what it was read from.
    body: text.slice(0, 200)
  };
}

// A sender like 'AD-HDFCBK' or 'JD-ICICIB-S': the middle part names the bank.
export const looksLikeBank = (sender) =>
  /^[A-Z]{2}-?[A-Z]{4,8}(-[A-Z])?$/i.test(String(sender).trim()) ||
  /\b(hdfc|icici|sbi|axis|kotak|idfc|indusind|yesbnk|pnb|bob|canbnk|unionb|federal|rbl)\b/i.test(
    String(sender)
  );
