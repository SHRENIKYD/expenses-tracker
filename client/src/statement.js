// Bank statement parsing, moved into the browser.
//
// This is the parser the Express API ran, unchanged in behaviour: the file is
// read where it is chosen and only the rows it yields are sent anywhere. The
// PDF itself never leaves the device, and no server is needed to read it.
//
// Reading the PDF lives in ./pdf.js, so this half stays pure and testable.

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

function detectBank(text) {
  const found = BANKS.find((bank) => bank.match.test(text));
  return found ? { code: found.code, name: found.name } : null;
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

function leadingDate(line) {
  const match = /^\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}[\s/-][A-Za-z]{3}[a-z]*[\s/-]\d{2,4})/.exec(
    line
  );
  if (!match) return null;
  const date = parseDate(match[1].trim());
  return date ? { date, rest: line.slice(match[0].length) } : null;
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

function cleanDescription(text) {
  return text
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

function parseStatement(lines) {
  const transactions = [];
  const skipped = [];
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

    if (amounts.length === 1) {
      skipped.push({ line: line.slice(0, 120), reason: 'only one amount on the row' });
      continue;
    }

    const balance = toNumber(amounts[amounts.length - 1]);
    const amount = toNumber(amounts[amounts.length - 2]);

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
    let kind = null;
    if (/\bCr\b\.?/i.test(marked)) kind = 'income';
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
      description,
      amount: Math.round(amount * 100) / 100,
      kind,
      category: suggestCategory(description, kind),
      reference: extractReference(description),
      balance
    });
  }

  return { transactions, skipped };
}

export { detectBank, parseStatement, parseDate, suggestCategory, extractReference, BANKS };
