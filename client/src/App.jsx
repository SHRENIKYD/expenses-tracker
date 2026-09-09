import { useCallback, useEffect, useState } from 'react';
import ExpenseForm from './components/ExpenseForm.jsx';
import ExpenseList from './components/ExpenseList.jsx';
import Summary from './components/Summary.jsx';
import { createExpense, deleteExpense, listCategories, listExpenses } from './api.js';

export default function App() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState(['other']);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [expenseList, categoryList] = await Promise.all([listExpenses(), listCategories()]);
      setExpenses(expenseList);
      setCategories(categoryList);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(expense) {
    setSubmitting(true);
    try {
      const created = await createExpense(expense);
      setExpenses((current) => [created, ...current]);
      setError('');
      return created;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteExpense(id);
      setExpenses((current) => current.filter((expense) => expense.id !== id));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Expenses Tracker</h1>
      </header>

      {error && <p className="error">{error}</p>}

      <main>
        <div className="column">
          <ExpenseForm categories={categories} onSubmit={handleCreate} submitting={submitting} />
          <Summary expenses={expenses} />
        </div>
        <div className="column wide">
          {loading ? (
            <div className="card">
              <p className="empty">Loading…</p>
            </div>
          ) : (
            <ExpenseList expenses={expenses} onDelete={handleDelete} />
          )}
        </div>
      </main>
    </div>
  );
}
