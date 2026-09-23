// Bank statement parsing, moved into the browser.
//
// This is the parser the Express API ran, unchanged in behaviour: the file is
// read where it is chosen and only the rows it yields are sent anywhere. The
// PDF itself never leaves the device, and no server is needed to read it.
//
// Reading the PDF lives in ./pdf.js, so this half stays pure and testable.
//
// Two layouts are handled. An account statement prints the transaction and the
// balance it left behind, and the direction of the money follows from the
// change in that balance. A card statement prints one amount and no balance at
// all, so direction comes from the Cr marker instead — and, because a credit on
// a card is usually a bill payment rather than income, those rows are reported
// rather than imported.

const BANKS = [
  { code: 'hdfc', name: 'HDFC Bank', match: /hdfc\s*bank/i },
  { code: 'icici', name: 'ICICI Bank', match: /icici\s*bank/i },
  { code: 'sbi', name: 'State Bank of India', match: /state\s*bank\s*of\s*india|\bSBI\b/i },
  { code: 'axis', name: 'Axis Bank', match: /axis\s*bank/i },
  { code: 'kotak', name: 'Kotak Mahindra Bank', match: /kotak/i },
  { code: 'yes', name: 'YES Bank', match: /yes\s*bank/i },
  { code: 'pnb', name: 'Punjab National Bank', match: /punjab\s*national/i },
  { code: 'bob', name: 'Bank of Baroda', match: /bank\s*of\s*baroda/i },
  { code: 'idfc', name: 'IDFC FIRST Bank', match: /idfc/i },
  { code: 'indusind', name: 'IndusInd Bank', match: /indusind/i }
];

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

// Merchant keywords -> category. Only obvious ones; anything else stays 'other'.
const CATEGORY_HINTS = [
  [/swiggy|zomato|blinkit|zepto|bigbasket|dmart|grocer|restaurant|cafe|dominos|kfc|mcdonald/i, 'food'],
  [/\buber\b|\bola\b|rapido|irctc|petrol|\bfuel\b|hpcl|bpcl|iocl|\bmetro\b|parking|\btoll\b|fastag/i, 'transport'],
  [/\brent\b|landlord|society\s*maint|\bhousing\b/i, 'housing'],
  [/electric|torrent\s*power|adani\s*elec|water\s*bill|\bgas\b|airtel|\bjio\b|vodafone|\bvi\b|broadband|wifi|\bdth\b|recharge|billpay/i, 'utilities'],
  [/pharm|apollo|medplus|hospital|clinic|diagnost|doctor|medic/i, 'health'],
  [/netflix|spotify|prime\s*video|hotstar|bookmyshow|pvr|inox|cinema/i, 'entertainment'],
  [/udemy|coursera|byju|unacademy|tuition|school\s*fee|college|exam\s*fee/i, 'education'],
  [/amazon|flipkart|myntra|ajio|nykaa|meesho|shop/i, 'shopping']
];

const INCOME_HINTS = [
  [/salary|payroll|sal\s*cr/i, 'salary'],
  [/freelance|consult|invoice/i, 'freelance'],
  [/interest|int\s*pd|int\.pd/i, 'interest'],
  [/refund|reversal|cashback/i, 'refund']
];

// The bank that the statement is mostly about, not the first one named in it.
// A statement mentions other banks in passing — a payee's branch, an IFSC in a
// narration — and taking the first match printed "HDFC Bank" over an ICICI
// statement whose own name appeared forty times.
// The account's own bank is on the letterhead. Further in, a statement names
// other banks in passing — a payee's branch, the bank behind a UPI handle — and
// counting mentions across the whole file crowned whichever of those appeared
// most. Only the opening is read, and there the most-named bank is the right
// one.
const LETTERHEAD = 1500;

function detectBank(text) {
  const opening = text.slice(0, LETTERHEAD);
  let best = null;
  for (const bank of BANKS) {
    const mentions = (opening.match(new RegExp(bank.match.source, 'gi')) || []).length;
    if (mentions > 0 && (!best || mentions > best.mentions)) best = { bank, mentions };
  }
  return best ? { code: best.bank.code, name: best.bank.name } : null;
}

// Which account the statement is for, as the last four digits of its number —
// the same digits a bank's alerts print, so a statement and an alert for the
// same account find the same one. Read from the letterhead, where the account's
// own number is; further in, narrations are full of other people's.
const CARD_NUMBER = /\bcard\s*(?:no\.?|number)?\s*[:.-]?\s*((?:[0-9Xx*]{4}[\s-]?){3}\d{4})/i;
const ACCOUNT_NUMBER = /\b(?:a\/c|acct|account)\s*(?:no\.?|number|num)?\s*[:.-]?\s*([0-9Xx*][0-9Xx*\s-]{2,24}\d)/i;

function detectAccount(text) {
  const opening = String(text).slice(0, LETTERHEAD);
  for (const [pattern, kind] of [[CARD_NUMBER, 'card'], [ACCOUNT_NUMBER, 'account']]) {
    const found = pattern.exec(opening);
    const digits = found?.[1].replace(/\D/g, '') ?? '';
    if (digits.length >= 4) return { kind, tail: digits.slice(-4) };
  }
  return null;
}

// What the account held before the statement's first transaction: the first
// row's balance with that row undone. A new account opened with it matches the
// statement's closing balance once the rows are in. Statements run oldest
// first or newest first, so the first row is whichever end is earlier.
function openingBalance(transactions) {
  const withBalance = transactions.filter((row) => Number.isFinite(row.balance));
  if (withBalance.length === 0) return 0;
  const descending = withBalance[0].date > withBalance[withBalance.length - 1].date;
  const first = descending ? withBalance[withBalance.length - 1] : withBalance[0];
  const before = first.balance + (first.kind === 'income' ? -first.amount : first.amount);
  return Math.round(before * 100) / 100;
}

function parseDate(token) {
  let match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(token);
  if (match) {
    const [, d, m, rawYear] = match;
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    return iso(year, Number(m), Number(d));
  }

  match = /^(\d{1,2})[\s/-]([A-Za-z]{3})[a-z]*[\s/-](\d{2,4})$/.exec(token);
  if (match) {
    const [, d, monthName, rawYear] = match;
    const month = MONTHS[monthName.toLowerCase()];
    if (!month) return null;
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    return iso(year, month, Number(d));
  }

  return null;
}

function iso(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  const text = date.toISOString().slice(0, 10);
  // Reject dates that roll over, e.g. 31/02.
  return Number(text.slice(8, 10)) === day ? text : null;
}

const MONEY = /-?(?:\d{1,3}(?:,\d{2,3})*|\d+)\.\d{2}/g;
const toNumber = (token) => Number(token.replace(/,/g, ''));

const DATE_TOKEN = String.raw`\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}[\s/-][A-Za-z]{3}[a-z]*[\s/-]\d{2,4}`;

// The date that opens a row, past the row number some exports print in front of
// it, and past the value date when the row carries a value date and a
// transaction date both. The transaction date is the one that is kept: it is
// when the money moved.
function leadingDate(line) {
  const match = new RegExp(`^\\s*(?:\\d{1,4}[.)]?\\s+)?(${DATE_TOKEN})`).exec(line);
  if (!match) return null;
  const date = parseDate(match[1].trim());
  if (!date) return null;

  let rest = line.slice(match[0].length);
  const second = new RegExp(`^\\s+(${DATE_TOKEN})(?=\\s|$)`).exec(rest);
  if (second) {
    const later = parseDate(second[1].trim());
    if (later) return { date: later, rest: rest.slice(second[0].length) };
  }

  return { date, rest };
}

function suggestCategory(description, kind) {
  const hints = kind === 'income' ? INCOME_HINTS : CATEGORY_HINTS;
  const found = hints.find(([pattern]) => pattern.test(description));
  if (found) return found[1];
  return kind === 'income' ? 'other income' : 'other';
}

function extractReference(description) {
  const labelled = /\b(?:UTR|REF|RRN|TXN|IMPS|NEFT|RTGS)[:\s/-]*([A-Z0-9]{6,25})\b/i.exec(description);
  // A reference must contain a digit, otherwise "IMPS-AMAZON" yields "AMAZON".
  if (labelled && /\d/.test(labelled[1])) return labelled[1].toUpperCase();

  const bare = /\b(\d{10,25})\b/.exec(description);
  return bare ? bare[1] : null;
}

// Reading the other side's name out of a transfer narration.
//
// Banks print a transfer as fields joined by slashes or dashes — channel,
// reference, handle, IFSC, the name, a note — in an order that differs by
// bank: "UPI-SWIGGY-SWIGGY.STORES@AXISBANK-UTIB0000001-412345678901-PAYMENT"
// at HDFC, "UPI/402500000040/Payment/SWIGGY" at ICICI. The fields that are
// never a name are recognisable on their own, so they are dropped and the
// first field left is the name. Taken as-is, the narration put the merchant
// last, where the list cut it off.
const TRANSFER = /\b(?:UPI|IMPS|NEFT|RTGS|MMT)\b/i;
const NOT_A_NAME = [
  /^\d+$/, // a reference
  /^[A-Z]{3,4}0[A-Z0-9]{6}$/i, // an IFSC, or one with its first letter wrapped away
  /@/, // a UPI handle
  /x{2,}\d+/i, // a masked account number
  /^(?=.*\d)[A-Z0-9]{12,}$/i, // a transaction id
  /^(?:UPI|IMPS|NEFT|RTGS|MMT|NEFT CR|NEFT DR|RTGS CR|RTGS DR|DR|CR|P2M|P2A|P2P|TO TRANSFER|BY TRANSFER|TRANSFER|PAYMENT|PAYMENT FROM PHONE|PAY|SENT|RECEIVED|COLLECT|INB|MOB|BIL)$/i,
  // IFSC bank codes, which travel on their own in some narrations. Only real
  // ones: a four-letter merchant such as UBER is not one of them.
  /^(?:YESB|UTIB|ICIC|HDFC|SBIN|KKBK|PUNB|BARB|IDFB|INDB|AIRP|PYTM|FDRL|CNRB|UBIN|IOBA|CBIN|MAHB|BKID|IDIB|UCBA|PSIB|KARB|SIBL|RATN|AUBL|ESFB|JAKA|TMBL|CIUB|DBSS|SCBL|CITI|HSBC)$/i,
  /\bBANK\b/i
];

export function readableName(narration) {
  const text = String(narration || '').trim();
  if (!TRANSFER.test(text)) return text;
  const name = text
    .split(/\s*[/-]\s*|\s{2,}/)
    .map((field) => field.trim())
    .find((field) => field.length > 1 && /[A-Za-z]/.test(field) && !NOT_A_NAME.some((pattern) => pattern.test(field)));
  return name || text;
}

function cleanDescription(text) {
  return text
    // An empty column prints as a dash or a pipe; it is not part of the words.
    .replace(/^[-|\s]+/, '')
    .replace(/\b(?:Dr|Cr)\b\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

// Most statements print the balance carried into the period. Seeding from it
// lets the very first transaction row be resolved, which otherwise has nothing
// to compare against.
function findOpeningBalance(lines) {
  const label = /(opening\s*balance|balance\s*b\/?f|brought\s*forward|b\/f)/i;
  for (const line of lines) {
    if (!label.test(line)) continue;
    MONEY.lastIndex = 0;
    const amounts = line.match(MONEY);
    if (amounts && amounts.length > 0) return toNumber(amounts[amounts.length - 1]);
  }
  return null;
}

// A card statement's rows carry one amount; an account statement's carry the
// amount and the balance. Counting them is more reliable than looking for a
// bank's name, since the same bank issues both.
function looksLikeCard(lines) {
  let single = 0;
  let several = 0;

  for (const line of lines) {
    const head = leadingDate(line);
    if (!head) continue;
    MONEY.lastIndex = 0;
    const amounts = head.rest.match(MONEY);
    if (!amounts) continue;
    if (amounts.length === 1) single += 1;
    else several += 1;
  }

  return single >= 3 && single > several;
}

function parseStatement(lines) {
  const transactions = [];
  const skipped = [];
  const card = looksLikeCard(lines);
  let previousBalance = findOpeningBalance(lines);

  const isContinuation = (line) => {
    if (!line || leadingDate(line)) return false;
    MONEY.lastIndex = 0;
    if (MONEY.test(line)) return false;
    // Either wrapped narration text, or a reference number on its own line.
    return /[A-Za-z]/.test(line) || /^\d{6,}$/.test(line.trim());
  };

  for (let index = 0; index < lines.length; index += 1) {
    // MONEY is a global regex; reset lastIndex before each reuse.
    MONEY.lastIndex = 0;
    const line = lines[index];
    const head = leadingDate(line);
    if (!head) continue;

    const amounts = head.rest.match(MONEY);
    if (!amounts || amounts.length === 0) continue;

    if (card) {
      if (amounts.length > 1) {
        skipped.push({ line: line.slice(0, 120), reason: 'more than one amount on the row' });
        continue;
      }

      const amount = toNumber(amounts[0]);
      if (!Number.isFinite(amount) || amount <= 0) {
        skipped.push({ line: line.slice(0, 120), reason: 'amount could not be read' });
        continue;
      }

      // A credit on a card is a bill payment far more often than income, and
      // importing one would cancel out the very spending it paid for. It is
      // reported so it can be added by hand if it really belongs in the ledger.
      if (/\bCr\b\.?/i.test(head.rest)) {
        skipped.push({ line: line.slice(0, 120), reason: 'a credit — a payment or a refund' });
        continue;
      }

      // The row leads with a separator and the time of the purchase; neither
      // belongs in the description.
      const raw = head.rest
        .slice(0, head.rest.indexOf(amounts[0]))
        .replace(/^[|\s]+/, '')
        .replace(/^\d{1,2}:\d{2}\s*/, '');
      const description = cleanDescription(raw);

      if (!description) {
        skipped.push({ line: line.slice(0, 120), reason: 'no description' });
        continue;
      }

      transactions.push({
        date: head.date,
        description,
        amount: Math.round(amount * 100) / 100,
        kind: 'expense',
        category: suggestCategory(description, 'expense'),
        reference: extractReference(head.rest),
        balance: null
      });
      continue;
    }

    if (amounts.length === 1) {
      skipped.push({ line: line.slice(0, 120), reason: 'only one amount on the row' });
      continue;
    }

    const balance = toNumber(amounts[amounts.length - 1]);

    // Withdrawal and deposit in columns of their own, the unused one printed as
    // 0.00 — which is how ICICI's transaction history exports a row, and which
    // read as an amount of zero before. Exactly one of the two is the amount,
    // and which one it is says which way the money went.
    let column = null;
    if (amounts.length >= 3) {
      const out = toNumber(amounts[amounts.length - 3]);
      const inward = toNumber(amounts[amounts.length - 2]);
      if (out > 0 && inward === 0) column = { amount: out, kind: 'expense' };
      else if (inward > 0 && out === 0) column = { amount: inward, kind: 'income' };
    }

    const amount = column ? column.amount : toNumber(amounts[amounts.length - 2]);

    // Record the balance before any later skip, so one unreadable row does not
    // break the running balance that tells later rows which way money moved.
    const balanceBefore = previousBalance;
    if (Number.isFinite(balance)) previousBalance = balance;

    if (!Number.isFinite(amount) || amount <= 0) {
      skipped.push({ line: line.slice(0, 120), reason: 'amount could not be read' });
      continue;
    }

    const firstAmountAt = head.rest.indexOf(amounts[0]);
    let raw = head.rest.slice(0, firstAmountAt);

    // A long narration wraps onto its own line, above and/or below the dated
    // row, leaving the dated row with amounts but no text. Stitch them back.
    if (!raw.trim()) {
      const before = isContinuation(lines[index - 1]) ? lines[index - 1] : '';
      const after = isContinuation(lines[index + 1]) ? lines[index + 1] : '';
      raw = `${before} ${after}`;
    }

    const description = cleanDescription(raw);

    if (!description) {
      skipped.push({ line: line.slice(0, 120), reason: 'no description' });
      continue;
    }

    // A direction marker may sit in the row or in the narration ("NEFT CR-...").
    // Test the raw text: cleanDescription strips those markers.
    const marked = `${head.rest} ${raw}`;
    let kind = column ? column.kind : null;
    if (kind) {
      // nothing more to decide: the column the figure sat in already said it
    } else if (/\bCr\b\.?/i.test(marked)) kind = 'income';
    else if (/\bDr\b\.?/i.test(marked)) kind = 'expense';
    else if (balanceBefore !== null) {
      const delta = balance - balanceBefore;
      if (Math.abs(Math.abs(delta) - amount) < 0.02) kind = delta > 0 ? 'income' : 'expense';
    }

    if (!kind) {
      skipped.push({ line: line.slice(0, 120), reason: 'could not tell money in from money out' });
      continue;
    }

    transactions.push({
      date: head.date,
      description: readableName(description),
      // The whole of what the bank printed, kept as the row's note: the name
      // is what a person reads, but nothing the statement said is lost.
      narration: description,
      amount: Math.round(amount * 100) / 100,
      kind,
      category: suggestCategory(description, kind),
      reference: extractReference(description),
      balance
    });
  }

  return { transactions, skipped };
}

export {
  detectAccount,
  detectBank,
  openingBalance,
  parseStatement,
  parseDate,
  suggestCategory,
  extractReference,
  BANKS
};
