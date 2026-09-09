const test = require('node:test');
const assert = require('node:assert/strict');
const { toCsv, csvToExpenses, parseCsv } = require('../src/csv');

test('quotes cells containing commas, quotes or newlines', () => {
  const csv = toCsv([{ date: '2026-09-01', description: 'Chai, masala', category: 'food', amount: 25.5 }]);
  assert.ok(csv.includes('"Chai, masala"'));
});

test('escapes embedded double quotes by doubling them', () => {
  const csv = toCsv([{ date: '2026-09-01', description: 'Say "hi"', category: 'other', amount: 1 }]);
  assert.ok(csv.includes('"Say ""hi"""'));
});

test('round-trips values through export and import unchanged', () => {
  const rows = [
    { date: '2026-09-01', description: 'Chai, masala', category: 'food', amount: 25.5 },
    { date: '2026-09-02', description: 'Say "hi"', category: 'other', amount: 10 }
  ];
  const { errors, records } = csvToExpenses(toCsv(rows));
  assert.deepEqual(errors, []);
  assert.equal(records[0].description, 'Chai, masala');
  assert.equal(records[1].description, 'Say "hi"');
});

test('reports missing columns rather than importing garbage', () => {
  const { errors, records } = csvToExpenses('amount,date\r\n1,2026-01-01\r\n');
  assert.equal(records.length, 0);
  assert.ok(errors[0].includes('description'));
  assert.ok(errors[0].includes('category'));
});

test('tolerates column reordering and header casing', () => {
  const { errors, records } = csvToExpenses('Amount,CATEGORY,date,Description\r\n50,food,2026-09-01,Tea\r\n');
  assert.deepEqual(errors, []);
  assert.equal(records[0].description, 'Tea');
  assert.equal(records[0].amount, '50');
});

test('ignores blank lines', () => {
  const { records } = csvToExpenses('date,description,category,amount\r\n\r\n2026-09-01,Tea,food,50\r\n\r\n');
  assert.equal(records.length, 1);
});

test('handles a newline inside a quoted field', () => {
  const rows = parseCsv('a,b\r\n"line1\nline2",second\r\n');
  assert.equal(rows[1][0], 'line1\nline2');
  assert.equal(rows[1][1], 'second');
});

test('reports an empty file', () => {
  assert.ok(csvToExpenses('').errors[0].includes('empty'));
});
