const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateExpense,
  validateBudget,
  validateRecurring,
  parseFilters,
  CATEGORIES
} = require('../src/validate');

test('accepts a well-formed expense and rounds to paise', () => {
  const { errors, value } = validateExpense({
    description: '  Chai  ',
    amount: '25.005',
    category: 'food',
    date: '2026-09-01'
  });
  assert.deepEqual(errors, []);
  assert.equal(value.description, 'Chai');
  assert.equal(value.amount, 25.01);
  assert.equal(value.date, '2026-09-01');
});

test('rejects empty description, non-positive amount, unknown category, bad date', () => {
  const { errors } = validateExpense({
    description: '   ',
    amount: 0,
    category: 'rockets',
    date: '2026-13-45'
  });
  assert.equal(errors.length, 4);
});

test('rejects an absurdly large amount', () => {
  const { errors } = validateExpense({ description: 'x', amount: 1e12, category: 'food', date: '2026-09-01' });
  assert.ok(errors.some((e) => e.includes('too large')));
});

test('defaults category and date when creating', () => {
  const { errors, value } = validateExpense({ description: 'x', amount: 5 });
  assert.deepEqual(errors, []);
  assert.equal(value.category, 'other');
  assert.match(value.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('partial mode omits missing fields instead of defaulting them', () => {
  const { errors, value } = validateExpense({ amount: 5 }, { partial: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(Object.keys(value), ['amount']);
});

test('caps description length', () => {
  const { value } = validateExpense({ description: 'a'.repeat(500), amount: 1 });
  assert.equal(value.description.length, 200);
});

test('rejects a date that looks valid but is not a real calendar day', () => {
  const { errors } = validateExpense({ description: 'x', amount: 1, date: '2026-02-31' });
  assert.ok(errors.some((e) => e.includes('date')), 'expected 2026-02-31 to be rejected');
});

test('sort falls back to a whitelisted column, blocking injection', () => {
  const { filters } = parseFilters({ sort: "amount; DROP TABLE expenses;--", order: 'asc' });
  assert.equal(filters.sort, 'date');
  assert.equal(filters.order, 'ASC');
});

test('order only ever resolves to ASC or DESC', () => {
  assert.equal(parseFilters({ order: 'asc' }).filters.order, 'ASC');
  assert.equal(parseFilters({ order: 'nonsense' }).filters.order, 'DESC');
});

test('rejects an unknown category filter', () => {
  const { errors } = parseFilters({ category: 'rockets' });
  assert.equal(errors.length, 1);
});

test('budget rejects negatives and accepts zero as a clear', () => {
  assert.equal(validateBudget({ monthlyLimit: -1 }).errors.length, 1);
  assert.equal(validateBudget({ monthlyLimit: 0 }).value.monthlyLimit, 0);
});

test('every category is lowercase and unique', () => {
  assert.equal(new Set(CATEGORIES).size, CATEGORIES.length);
  assert.deepEqual(CATEGORIES, CATEGORIES.map((c) => c.toLowerCase()));
});

test('recurring requires a day of month and rejects days above 28', () => {
  const { errors, value } = validateRecurring({
    description: 'Rent',
    amount: 18000,
    category: 'housing',
    dayOfMonth: 1
  });
  assert.deepEqual(errors, []);
  assert.equal(value.dayOfMonth, 1);
  assert.equal(value.date, undefined, 'a template must not carry a date');

  assert.ok(validateRecurring({ description: 'x', amount: 1, dayOfMonth: 31 }).errors.length);
  assert.ok(validateRecurring({ description: 'x', amount: 1, dayOfMonth: 0 }).errors.length);
  assert.ok(validateRecurring({ description: 'x', amount: 1, dayOfMonth: 1.5 }).errors.length);
  assert.ok(validateRecurring({ description: 'x', amount: 1 }).errors.length);
});
