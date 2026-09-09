import test from 'node:test';
import assert from 'node:assert/strict';

import { BANKS, detectBank, parseDate, parseStatement } from '../src/statement.js';
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
