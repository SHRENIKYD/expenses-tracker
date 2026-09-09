const test = require('node:test');
const assert = require('node:assert/strict');
const { parseStatement, parseDate, detectBank } = require('../src/statement');

const rows = (text) => parseStatement(text.trim().split('\n').map((line) => line.trim()));

test('an opening balance line lets the first row be resolved too', () => {
  const { transactions } = rows(`
    Opening Balance 73,930.00
    01/09/2026 UPI-SWIGGY-9876543210 486.00 73,444.00
    02/09/2026 NEFT SALARY ACME 60,000.00 1,33,444.00
  `);
  assert.equal(transactions.length, 2);
  assert.equal(transactions[0].kind, 'expense');
  assert.equal(transactions[0].amount, 486);
  assert.equal(transactions[1].kind, 'income');
});

test('without an opening balance or a marker, the first row is reported rather than guessed', () => {
  const { transactions, skipped } = rows(`
    01/09/2026 UPI-SWIGGY-9876543210 486.00 73,444.00
    02/09/2026 NEFT SALARY ACME 60,000.00 1,33,444.00
  `);
  assert.equal(transactions.length, 1, 'only the second row can be resolved');
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /money in from money out/);
});

test('an explicit Dr or Cr marker beats the balance inference', () => {
  const { transactions } = rows(`
    01/09/2026 SOME PAYMENT Cr 500.00 1,000.00
  `);
  assert.equal(transactions[0].kind, 'income');
});

test('a narration wrapped onto its own line is stitched back onto the row', () => {
  const { transactions } = rows(`
    NEFT CR-ACME SOFTWARE PVT LTD-SALARY SEP-
    01/09/2026 60,000.00 92,430.00
    UTR N2026090112345
  `);
  assert.equal(transactions.length, 1);
  assert.match(transactions[0].description, /ACME SOFTWARE/);
  assert.equal(transactions[0].kind, 'income', 'the CR marker lives in the wrapped narration');
});

test('a row with only one amount is reported rather than guessed at', () => {
  const { transactions, skipped } = rows('01/09/2026 SOMETHING 500.00');
  assert.equal(transactions.length, 0);
  assert.equal(skipped.length, 1);
});

test('"TORRENT POWER" is a utility, not rent', () => {
  const { transactions } = rows(`
    Opening Balance 10,100.00
    01/09/2026 SOMETHING 100.00 10,000.00
    03/09/2026 BILLPAY TORRENT POWER ELECTRICITY 2,340.50 7,659.50
  `);
  const power = transactions.find((row) => row.description.includes('TORRENT'));
  assert.equal(power.category, 'utilities');
});

test('a reference must contain a digit, so "IMPS-AMAZON" is not one', () => {
  const { transactions } = rows(`
    Opening Balance 10,100.00
    01/09/2026 SOMETHING 100.00 10,000.00
    09/09/2026 IMPS-AMAZON PAY INDIA-3344556677 1,299.00 8,701.00
  `);
  const amazon = transactions.find((row) => row.description.includes('AMAZON'));
  assert.equal(amazon.reference, '3344556677');
});

test('dates parse in the common Indian formats and reject impossible days', () => {
  assert.equal(parseDate('01/09/2026'), '2026-09-01');
  assert.equal(parseDate('1-9-26'), '2026-09-01');
  assert.equal(parseDate('01-Sep-2026'), '2026-09-01');
  assert.equal(parseDate('31/02/2026'), null);
  assert.equal(parseDate('not a date'), null);
});

test('income categories are suggested for credits', () => {
  const { transactions } = rows(`
    01/09/2026 SALARY CREDIT Cr 60,000.00 1,00,000.00
    02/09/2026 INT PD-INTEREST Cr 412.25 1,00,412.25
  `);
  assert.equal(transactions[0].category, 'salary');
  assert.equal(transactions[1].category, 'interest');
});

test('the bank is identified from the statement header', () => {
  assert.equal(detectBank('HDFC BANK LIMITED Statement').code, 'hdfc');
  assert.equal(detectBank('ICICI Bank Ltd').code, 'icici');
  assert.equal(detectBank('Some Other Cooperative'), null);
});
