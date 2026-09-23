import test from 'node:test';
import assert from 'node:assert/strict';

import { BANKS, detectBank, parseDate, parseStatement, readableName } from '../src/statement.js';
import { NEAR_DAYS, daysApart, findDuplicate, similarity } from '../src/duplicates.js';

// A statement as pdf.js delivers it once its cells are joined into rows: an
// opening balance, then dated rows whose direction has to be worked out.
const STATEMENT = [
  'HDFC Bank Ltd — Statement of account',
  'Date Narration Withdrawal Deposit Balance',
  'Opening Balance 12,000.00',
  '01/09/2026 UPI-SWIGGY ORDER-UTR 402512345678 450.00 11,550.00',
  '03/09/2026 NEFT CR-ACME PAYROLL SALARY 90,000.00 1,01,550.00',
  '05/09/2026 ATM WDL 2,000.00 99,550.00'
];

test('a statement becomes transactions, with direction from the running balance', () => {
  const { transactions } = parseStatement(STATEMENT);

  assert.equal(transactions.length, 3);
  assert.deepEqual(
    transactions.map((row) => [row.date, row.kind, row.amount]),
    [
      ['2026-09-01', 'expense', 450],
      ['2026-09-03', 'income', 90000],
      ['2026-09-05', 'expense', 2000]
    ]
  );
});

test('the merchant suggests a category, and a UTR becomes the reference', () => {
  const [swiggy, salary] = parseStatement(STATEMENT).transactions;

  assert.equal(swiggy.category, 'food');
  assert.equal(swiggy.reference, '402512345678');
  assert.equal(salary.category, 'salary');
});

test('a row that cannot be read is reported rather than guessed at', () => {
  const { transactions, skipped } = parseStatement([
    'Opening Balance 500.00',
    '01/09/2026 SOME CHARGE 250.00'
  ]);

  assert.equal(transactions.length, 0);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /only one amount/);
});

test('a narration that wrapped onto its own line is stitched back', () => {
  const { transactions } = parseStatement([
    'Opening Balance 5,000.00',
    'IMPS PAYMENT TO LANDLORD RENT',
    '02/09/2026 1,500.00 3,500.00'
  ]);

  assert.equal(transactions.length, 1);
  assert.match(transactions[0].description, /LANDLORD/);
  assert.equal(transactions[0].category, 'housing');
});

test('dates are read in either style, and impossible ones are refused', () => {
  assert.equal(parseDate('09/02/2026'), '2026-02-09');
  assert.equal(parseDate('9-Feb-26'), '2026-02-09');
  assert.equal(parseDate('31/02/2026'), null);
});

test('the bank is named from the text when it is one we know', () => {
  assert.deepEqual(detectBank(STATEMENT.join('\n')), { code: 'hdfc', name: 'HDFC Bank' });
  assert.equal(detectBank('A statement from somewhere else'), null);
  assert.ok(BANKS.length >= 10);
});

test('a bank reference settles a duplicate on its own', () => {
  const existing = [
    { id: 'a', kind: 'expense', description: 'Lunch', amount: 450, date: '2026-08-20', external_ref: '402512345678' }
  ];
  const candidate = { kind: 'expense', description: 'UPI-SWIGGY', amount: 450, date: '2026-09-01', reference: '402512345678' };

  assert.equal(findDuplicate(candidate, existing).reason, 'same bank reference');
});

test('without a reference, amount, direction, date and wording have to agree', () => {
  const existing = [
    { id: 'a', kind: 'expense', description: 'Weekly groceries at DMart', amount: 1813.84, date: '2026-09-04', external_ref: null }
  ];

  const same = { kind: 'expense', description: 'DMART WEEKLY GROCERIES', amount: 1813.84, date: '2026-09-05', reference: null };
  assert.ok(findDuplicate(same, existing));

  const otherAmount = { ...same, amount: 1813.85 };
  assert.equal(findDuplicate(otherAmount, existing), null);

  const otherDirection = { ...same, kind: 'income' };
  assert.equal(findDuplicate(otherDirection, existing), null);

  const tooFarApart = { ...same, date: '2026-09-30' };
  assert.equal(findDuplicate(tooFarApart, existing), null);

  const unrelated = { ...same, description: 'Cinema tickets' };
  assert.equal(findDuplicate(unrelated, existing), null);
});

test('the comparison window is symmetric and counts whole days', () => {
  assert.equal(daysApart('2026-09-01', '2026-09-04'), NEAR_DAYS);
  assert.equal(daysApart('2026-09-04', '2026-09-01'), NEAR_DAYS);
  assert.equal(similarity('', 'anything'), 0);
});

// A credit card statement: one amount per row, no running balance, the time of
// the purchase in the row, and credits marked Cr.
const CARD = [
  'DUPLICATE Millennia Credit Card Statement',
  'HDFC Bank Credit Cards',
  'Statement Date 22 Jan, 2026',
  'Date Transaction Description Amount (in Rs.)',
  '22/12/2025| 00:00 IGST-VPS2635769053851-RATE 18.0 -29 (Ref# 09999999981222003692662) 138.42',
  '23/12/2025| 18:13 AMAZONMUMBAI 515.90',
  '23/12/2025| 18:30 SWIGGY BANGALORE 341.05',
  '05/01/2026| 00:00 PAYMENT RECEIVED THANK YOU 12,000.00 Cr'
];

test('a card statement is read without a balance column', () => {
  const { transactions } = parseStatement(CARD);

  assert.deepEqual(
    transactions.map((row) => [row.date, row.kind, row.amount]),
    [
      ['2025-12-22', 'expense', 138.42],
      ['2025-12-23', 'expense', 515.9],
      ['2025-12-23', 'expense', 341.05]
    ]
  );
});

test('the time and the leading separator stay out of the description', () => {
  const [, amazon, swiggy] = parseStatement(CARD).transactions;

  assert.equal(amazon.description, 'AMAZONMUMBAI');
  assert.equal(amazon.category, 'shopping');
  assert.equal(swiggy.category, 'food');
});

test('a credit on a card is reported, not imported as income', () => {
  const { transactions, skipped } = parseStatement(CARD);

  assert.ok(!transactions.some((row) => row.kind === 'income'));
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].line, /PAYMENT RECEIVED/);
  assert.match(skipped[0].reason, /a credit/);
});

test('a card row keeps its reference, so a second import is a no-op', () => {
  const [igst] = parseStatement(CARD).transactions;

  assert.equal(igst.reference, '09999999981222003692662');
});

test('an account statement is still read as one, balance and all', () => {
  // The two layouts are told apart by the rows themselves, so adding cards must
  // not change how an account statement is read.
  const { transactions } = parseStatement(STATEMENT);
  assert.equal(transactions.length, 3);
  assert.equal(transactions[1].kind, 'income');
  assert.equal(transactions[1].balance, 101550);
});

test('a merchant is recognised across its varying reference numbers', async () => {
  const { merchantKey } = await import('../src/merchant.js');

  assert.equal(merchantKey('AMAZONMUMBAI'), 'amazonmumbai');
  assert.equal(merchantKey('UPI-SWIGGY ORDER-UTR 402512345678'), 'swiggy order');
  assert.equal(merchantKey('UPI-SWIGGY ORDER-UTR 998877665544'), 'swiggy order');
  // Noise words alone are not a merchant.
  assert.equal(merchantKey('IMPS PAYMENT 123456789012'), '');
  assert.ok(merchantKey('A'.repeat(200)).length <= 60);
});

test('the CSV round trip keeps income income', async () => {
  const { toCsv, csvToExpenses } = await import('../src/csv.js');

  const rows = [
    { date: '2026-09-01', description: 'Salary', category: 'salary', amount: 100000, kind: 'income' },
    { date: '2026-09-01', description: 'Rent, paid', category: 'housing', amount: 18500, kind: 'expense' }
  ];

  const { records } = csvToExpenses(toCsv(rows));
  assert.deepEqual(
    records.map((row) => [row.description, row.kind, row.amount]),
    [
      ['Salary', 'income', '100000'],
      ['Rent, paid', 'expense', '18500']
    ]
  );
});

test('a file exported before the kind column still imports', async () => {
  const { csvToExpenses } = await import('../src/csv.js');

  const { errors, records } = csvToExpenses(
    'date,description,category,amount\n2026-09-01,Salary,salary,100000\n'
  );
  assert.deepEqual(errors, []);
  assert.equal(records[0].kind, '');
});

test('a file missing a required column is refused by name', async () => {
  const { csvToExpenses } = await import('../src/csv.js');

  const { errors } = csvToExpenses('date,description\n2026-09-01,Salary\n');
  assert.match(errors[0], /category, amount/);
});

test('the index answers exactly what the scan did', async () => {
  const { buildIndex, findDuplicate, NEAR_DAYS } = await import('../src/duplicates.js');

  // A ledger with the awkward cases in it: the same amount on nearby days, the
  // same amount in both directions, and references that only some rows carry.
  const rows = [];
  for (let day = 1; day <= 28; day += 1) {
    const date = `2026-09-${String(day).padStart(2, '0')}`;
    rows.push({ id: `a${day}`, kind: 'expense', description: 'Weekly groceries DMart', amount: 500, date, external_ref: day % 3 === 0 ? `REF${day}` : null });
    rows.push({ id: `b${day}`, kind: 'income', description: 'Salary ACME', amount: 500, date, external_ref: null });
  }

  const index = buildIndex(rows);
  const candidates = [
    { kind: 'expense', description: 'DMART GROCERIES WEEKLY', amount: 500, date: '2026-09-14', reference: null },
    { kind: 'expense', description: 'Cinema tickets', amount: 500, date: '2026-09-14', reference: null },
    { kind: 'income', description: 'ACME SALARY', amount: 500, date: '2026-09-02', reference: null },
    { kind: 'expense', description: 'anything at all', amount: 500, date: '2026-09-09', reference: 'REF9' },
    { kind: 'expense', description: 'Weekly groceries DMart', amount: 501, date: '2026-09-14', reference: null },
    // Just outside the window, in both directions.
    { kind: 'expense', description: 'Weekly groceries DMart', amount: 500, date: '2026-08-28', reference: null },
    { kind: 'expense', description: 'Weekly groceries DMart', amount: 500, date: '2026-10-02', reference: null }
  ];

  for (const candidate of candidates) {
    const scanned = findDuplicate(candidate, rows);
    const looked = index.find(candidate);
    assert.deepEqual(looked, scanned, `disagreed on ${candidate.description} ${candidate.date}`);
  }

  // The window is the window, however it is searched.
  const edge = { kind: 'expense', description: 'Weekly groceries DMart', amount: 500, date: '2026-09-01', reference: null };
  assert.ok(index.find(edge));
  assert.equal(NEAR_DAYS, 3);
});

test('a lookup does not grow with the ledger', async () => {
  const { buildIndex } = await import('../src/duplicates.js');

  const rows = (count) =>
    Array.from({ length: count }, (_, i) => ({
      id: `r${i}`,
      kind: 'expense',
      description: `Shop number ${i}`,
      // Spread over years, so a scan would have to look at all of them.
      amount: 100 + (i % 997),
      date: new Date(Date.UTC(2020, 0, 1 + (i % 2000))).toISOString().slice(0, 10),
      external_ref: `REF${i}`
    }));

  const small = buildIndex(rows(200));
  const large = buildIndex(rows(200000));
  const candidate = { kind: 'expense', description: 'Nothing like it', amount: 42.5, date: '2026-09-09', reference: 'NOPE' };

  const time = (index) => {
    const started = process.hrtime.bigint();
    for (let i = 0; i < 2000; i += 1) index.find(candidate);
    return Number(process.hrtime.bigint() - started);
  };

  time(small);
  time(large);
  const quick = time(small);
  const huge = time(large);

  // A thousand times the rows must not cost meaningfully more per lookup. The
  // bound is loose because this is a timing test; a linear scan would be off by
  // three orders of magnitude, not by two.
  assert.ok(huge < quick * 20, `lookups scaled with the ledger: ${quick}ns vs ${huge}ns`);
});

// ICICI's transaction history export, as pdf.js delivers it: a row number in
// front of the date, a value date and a transaction date, an empty cheque
// column, and withdrawal and deposit in columns of their own with 0.00 in the
// one that does not apply.
const ICICI = [
  'Statement of Transactions in Saving Account no. 318301508036 in INR for the period',
  'ICICI BANK LIMITED, ICICIBANKLTD., HSG-J-KIADB, 203, RAVINDRA ROAD',
  'S No. Value Date Transaction Date Cheque Number Transaction Remarks Withdrawal Amount (INR) Deposit Amount (INR) Balance (INR)',
  '1 06/09/2026 07/09/2026 - UPI/129166379807/Payment/SWIGGY 30.00 0.00 12,345.67',
  '2 07/09/2026 07/09/2026 - MMT/IMPS/629012345678/ACME PAYROLL SALARY 0.00 90,000.00 1,02,345.67',
  '3 08/09/2026 08/09/2026 - UPI/994137/Payment to merchant 22,819.00 0.00 79,526.67'
];

test('an ICICI row is read past its number, its second date and its empty columns', () => {
  const { transactions, skipped } = parseStatement(ICICI);

  assert.equal(skipped.length, 0);
  assert.deepEqual(
    transactions.map((row) => [row.date, row.kind, row.amount]),
    [
      // The transaction date, not the value date, is the day it moved.
      ['2026-09-07', 'expense', 30],
      ['2026-09-07', 'income', 90000],
      ['2026-09-08', 'expense', 22819]
    ]
  );
  assert.equal(transactions[0].description, 'SWIGGY');
  assert.equal(transactions[0].category, 'food');
  assert.equal(transactions[1].category, 'salary');
});

test('the bank is the one the statement is about, not the first one it names', () => {
  // A payee's bank appears in a narration; the account's own bank appears
  // throughout.
  const text = ['HDFC BANK payee', ...ICICI, 'ICICI Bank'].join('\n');
  assert.deepEqual(detectBank(text), { code: 'icici', name: 'ICICI Bank' });
});

// What a person calls the other side of the transaction, out of the narration
// the bank prints. Imported rows read as "UPI/402500000040/Pay…" before, the
// merchant cut off at the end.
const NAMES = [
  // HDFC: UPI-<name>-<handle>-<IFSC>-<reference>-<note>
  ['UPI-SWIGGY-SWIGGY.STORES@AXISBANK-UTIB0000001-412345678901-PAYMENT FROM PHONE', 'SWIGGY'],
  ['UPI-RAHUL SHARMA-RAHUL@OKICICI-ICIC0001234-412345678901-UPI', 'RAHUL SHARMA'],
  // ICICI: UPI/<reference>/<note>/<name>, and the newer UPI/<name>/<handle>/...
  ['UPI/402500000040/Payment/SWIGGY', 'SWIGGY'],
  ['UPI/SWIGGY/swiggy.stores@axi/Payment/AXIS BANK/424512345678/ICI1a2b3c4d5e6f', 'SWIGGY'],
  ['MMT/IMPS/629012345678/ACME PAYROLL SALARY', 'ACME PAYROLL SALARY'],
  // SBI
  ['TO TRANSFER-UPI/DR/412345678901/SWIGGY/YESB/swiggy@yes/Payment', 'SWIGGY'],
  ['IMPS/P2A/412345678901/RAHUL SHARMA/SBIN/rahul/xxxx1234', 'RAHUL SHARMA'],
  // Axis
  ['UPI/P2M/129200640073/GANESH KOTARY', 'GANESH KOTARY'],
  // NEFT: the remitter comes first.
  ['NEFT CR-CITI0000001-ACME PAYROLL-SHRENIK Y D-CITIN52026090112345', 'ACME PAYROLL'],
  // Four letters is a bank code only when it is one: Uber stays Uber.
  ['UPI/P2M/412345678901/UBER', 'UBER']
];

test('a narration yields the name of the other side', () => {
  for (const [narration, name] of NAMES) assert.equal(readableName(narration), name, narration);
});

test('a narration with no name in it is kept as it is', () => {
  // The name was wrapped onto a line of its own; what is left has none.
  assert.equal(readableName('TIB0000553 - 129166379807 - UPI'), 'TIB0000553 - 129166379807 - UPI');
  assert.equal(readableName('994137'), '994137');
  // Not a transfer at all, so nothing to take apart.
  assert.equal(readableName('ATM WDL-ATM CASH 1234 MG ROAD BANGALORE'), 'ATM WDL-ATM CASH 1234 MG ROAD BANGALORE');
  assert.equal(readableName('POS 416021XXXXXX1234 AMAZON RETAIL IN'), 'POS 416021XXXXXX1234 AMAZON RETAIL IN');
});

test('an imported row is named for the merchant and keeps the whole narration as its note', () => {
  const [swiggy] = parseStatement(ICICI).transactions;
  assert.equal(swiggy.description, 'SWIGGY');
  assert.equal(swiggy.narration, 'UPI/129166379807/Payment/SWIGGY');
  // The category and the reference still come from all of it.
  assert.equal(swiggy.category, 'food');
  assert.equal(swiggy.reference, '129166379807');
});

// The account a statement is for, as the last digits of its number: the same
// digits an alert prints, so both find the same account.
test('the account number is read off the statement, as its last four digits', async () => {
  const { detectAccount } = await import('../src/statement.js');
  const cases = [
    ['Statement of Transactions in Saving Account no. 318301508036 in INR for the period', '8036'],
    ['Account No : 50100123456789', '6789'],
    ['A/C No: XXXXXXXX1234 Branch: MG Road', '1234'],
    ['Account Number 000012345678 IFSC HDFC0000001', '5678'],
    ['Card No: 4375 XXXX XXXX 9012', '9012'],
    ['Statement of account for the period 01/08/2026 to 31/08/2026', null]
  ];
  for (const [text, tail] of cases) assert.equal(detectAccount(text)?.tail ?? null, tail, text);
  assert.equal(detectAccount('Card No: 4375 XXXX XXXX 9012').kind, 'card');
});

test('the balance before a statement\'s first row is its opening balance', async () => {
  const { openingBalance } = await import('../src/statement.js');
  const { transactions } = parseStatement(ICICI);
  // First row: 30.00 out, leaving 12,345.67.
  assert.equal(openingBalance(transactions), 12375.67);
});
