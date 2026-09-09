import test from 'node:test';
import assert from 'node:assert/strict';
import { monthRange, money, budgetAlert } from '../src/dashboard.js';
test('month filters include the final day across leap years and year boundaries', () => {
  assert.deepEqual(monthRange('2024-02'), {
    from: '2024-02-01',
    to: '2024-02-29'
  });
  assert.deepEqual(monthRange('2026-02'), {
    from: '2026-02-01',
    to: '2026-02-28'
  });
  assert.deepEqual(monthRange('2026-12'), {
    from: '2026-12-01',
    to: '2026-12-31'
  });
});
test('dashboard amounts preserve paise and Indian grouping', () => {
  assert.equal(money(123456.78), '₹1,23,456.78');
  assert.equal(money(80000), '₹80,000');
});
test('budget alert chooses the most pressured category, excluding unset budgets', () => {
  const categories = [
    { category: 'food', total: 91, budget: 100 },
    { category: 'shopping', total: 110, budget: 100 },
    { category: 'other', total: 9999, budget: 0 }
  ];
  assert.equal(budgetAlert(categories).category, 'shopping');
  assert.equal(categories[0].category, 'food');
  assert.equal(budgetAlert([{ total: 10, budget: 100 }]), null);
});
