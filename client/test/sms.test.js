import test from 'node:test';
import assert from 'node:assert/strict';

import { counterparty, looksLikeBank, readMessage } from '../src/sms.js';

const at = Date.parse('2026-09-09T12:00:00Z');
const read = (sender, body) => readMessage({ sender, body, at });

test('a UPI debit becomes an expense, with its merchant and reference', () => {
  const found = read(
    'AD-HDFCBK',
    'Rs.450.00 debited from A/c XX3596 on 09-09-26 to VPA swiggy@ybl. UPI Ref 402512345678.'
  );

  assert.equal(found.kind, 'expense');
  assert.equal(found.amount, 450);
  assert.equal(found.description, 'swiggy');
  assert.equal(found.accountTail, '3596');
  assert.equal(found.reference, '402512345678');
  assert.equal(found.date, '2026-09-09');
});

test('a card purchase keeps the shop and not the date after it', () => {
  const found = read('VM-ICICIB', 'INR 1,234.56 spent on ICICI Bank Card XX1234 at AMAZON on 09-Sep-26.');

  assert.equal(found.amount, 1234.56);
  assert.equal(found.description, 'AMAZON');
  assert.equal(found.accountTail, '1234');
});

test('a credit is income, and Indian digit grouping is read', () => {
  const found = read('AX-SBIINB', 'Your a/c XX7788 is credited with Rs 1,00,000.00 on 01-09-26.');

  assert.equal(found.kind, 'income');
  assert.equal(found.amount, 100000);
});

test('an OTP is not a transaction, however much it looks like one', () => {
  assert.equal(read('AD-HDFCBK', 'OTP 445566 for txn of Rs.450 on your card. Do not share.'), null);
  assert.equal(
    read('AD-HDFCBK', 'Rs.5000 will be debited for your standing instruction on 12-09-26.'),
    null
  );
});

test('a balance alert is not a payment', () => {
  assert.equal(read('AD-HDFCBK', 'Avl Bal in A/c XX3596 is Rs.69,742.29 as on 09-09-26.'), null);
  assert.equal(read('AD-HDFCBK', 'Your available balance is Rs.1,200.00.'), null);
});

test('a message that will not say which way the money went is left alone', () => {
  // No direction word at all.
  assert.equal(read('AD-HDFCBK', 'Transaction of Rs.450 on A/c XX3596.'), null);
  // Both, which is worse: a guess here cannot be spotted from a total.
  assert.equal(read('AD-HDFCBK', 'Rs.450 debited and credited back to A/c XX3596.'), null);
});

test('an advertisement with a number in it is ignored', () => {
  assert.equal(read('AD-HDFCBK', 'Get a loan of Rs.5,00,000 credited instantly! Apply now.'), null);
  assert.equal(read('VM-ICICIB', 'Min amount due Rs.2,500 on your card. Pay now.'), null);
});

test('a message with no amount is not a transaction', () => {
  assert.equal(read('AD-HDFCBK', 'Your cheque book has been dispatched.'), null);
  assert.equal(read('AD-HDFCBK', ''), null);
  assert.equal(readMessage(), null);
});

test('the counterparty is read from the forms the banks use', () => {
  assert.equal(counterparty('trf to SHRENIK Y D Ref 123456'), 'SHRENIK Y D');
  assert.equal(counterparty('to VPA bescom@sbi'), 'bescom');
  assert.equal(counterparty('credited by NEFT from ACME PAYROLL LTD'), 'ACME PAYROLL LTD');
  assert.equal(counterparty('Rs.100 debited'), null);
});

test('only a bank-shaped sender is worth reading', () => {
  assert.ok(looksLikeBank('AD-HDFCBK'));
  assert.ok(looksLikeBank('VM-ICICIB'));
  assert.ok(looksLikeBank('JD-SBIINB-S'));
  assert.equal(looksLikeBank('+919876543210'), false);
  assert.equal(looksLikeBank('Amma'), false);
});
