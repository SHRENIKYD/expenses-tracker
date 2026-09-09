const express = require('express');
const { randomUUID } = require('crypto');
const { readAll, writeAll, withLock } = require('../store');
const { CATEGORIES, validateExpense } = require('../validate');

const router = express.Router();

function byDateDesc(a, b) {
  if (a.date === b.date) return b.createdAt.localeCompare(a.createdAt);
  return b.date.localeCompare(a.date);
}

router.get('/categories', (req, res) => {
  res.json(CATEGORIES);
});

router.get('/', async (req, res, next) => {
  try {
    let expenses = await readAll();
    const { category, from, to } = req.query;

    if (category) expenses = expenses.filter((e) => e.category === category);
    if (from) expenses = expenses.filter((e) => e.date >= from);
    if (to) expenses = expenses.filter((e) => e.date <= to);

    res.json(expenses.sort(byDateDesc));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { errors, value } = validateExpense(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const expense = {
      id: randomUUID(),
      ...value,
      createdAt: new Date().toISOString()
    };

    await withLock(async () => {
      const expenses = await readAll();
      expenses.push(expense);
      await writeAll(expenses);
    });

    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { errors, value } = validateExpense(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ errors });
    if (Object.keys(value).length === 0) {
      return res.status(400).json({ errors: ['no updatable fields provided'] });
    }

    const updated = await withLock(async () => {
      const expenses = await readAll();
      const index = expenses.findIndex((e) => e.id === req.params.id);
      if (index === -1) return null;
      expenses[index] = { ...expenses[index], ...value };
      await writeAll(expenses);
      return expenses[index];
    });

    if (!updated) return res.status(404).json({ error: 'Expense not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const removed = await withLock(async () => {
      const expenses = await readAll();
      const index = expenses.findIndex((e) => e.id === req.params.id);
      if (index === -1) return null;
      const [expense] = expenses.splice(index, 1);
      await writeAll(expenses);
      return expense;
    });

    if (!removed) return res.status(404).json({ error: 'Expense not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
