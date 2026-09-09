import { useCallback, useEffect, useState } from 'react';
import ExpenseForm from './components/ExpenseForm.jsx';
import ExpenseTable from './components/ExpenseTable.jsx';
import Filters from './components/Filters.jsx';
import SummaryCards from './components/SummaryCards.jsx';
import CategoryChart from './components/CategoryChart.jsx';
import TrendChart from './components/TrendChart.jsx';
import Budgets from './components/Budgets.jsx';
import ImportExport from './components/ImportExport.jsx';
import { currentMonth } from './format.js';
import {
  createExpense,
  deleteExpense,
  exportCsv,
  getSummary,
  importCsv,
  listBudgets,
  listCategories,
  listExpenses,
  setBudget,
  updateExpense
} from './api.js';

const emptyFilters = { q: '', category: '', from: '', to: '' };

export default function App() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState(['other']);
  const [budgets, setBudgets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [sort, setSort] = useState('date');
  const [order, setOrder] = useState('desc');
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadExpenses = useCallback(async () => {
    const rows = await listExpenses({ ...filters, sort, order });
    setExpenses(rows);
  }, [filters, sort, order]);

  const loadSummary = useCallback(async () => {
    const [nextSummary, nextBudgets] = await Promise.all([getSummary(month), listBudgets()]);
    setSummary(nextSummary);
    setBudgets(nextBudgets);
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([loadExpenses(), loadSummary(), listCategories()])
      .then(([, , nextCategories]) => {
        if (!cancelled) {
          setCategories(nextCategories);
          setError('');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadExpenses, loadSummary]);

  async function refresh() {
    await Promise.all([loadExpenses(), loadSummary()]);
  }

  async function guard(action) {
    try {
      const result = await action();
      setError('');
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }

  async function handleCreate(form) {
    setSubmitting(true);
    const created = await guard(async () => {
      const expense = await createExpense(form);
      await refresh();
      return expense;
    });
    setSubmitting(false);
    return created;
  }

  const handleUpdate = (id, patch) =>
    guard(async () => {
      const saved = await updateExpense(id, patch);
      await refresh();
      return saved;
    });

  const handleDelete = (id) =>
    guard(async () => {
      await deleteExpense(id);
      await refresh();
      return true;
    });

  const handleBudget = (category, limit) =>
    guard(async () => {
      await setBudget(category, limit);
      await loadSummary();
      return true;
    });

  const handleImport = (text) =>
    guard(async () => {
      const outcome = await importCsv(text);
      await refresh();
      return outcome;
    });

  const handleExport = () => guard(() => exportCsv({ ...filters, sort, order }));

  function handleSort(key) {
    if (sort === key) setOrder(order === 'asc' ? 'desc' : 'asc');
    else {
      setSort(key);
      setOrder(key === 'amount' || key === 'date' ? 'desc' : 'asc');
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Expenses Tracker</h1>
        <label className="month-picker">
          Month
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </header>

      {error && <p className="error">{error}</p>}

      <main>
        <div className="column">
          <ExpenseForm categories={categories} onSubmit={handleCreate} submitting={submitting} />
          {summary && (
            <Budgets
              categories={categories}
              budgets={budgets}
              spending={summary.categories}
              onSave={handleBudget}
            />
          )}
          <ImportExport onExport={handleExport} onImport={handleImport} />
        </div>

        <div className="column wide">
          {summary && <SummaryCards summary={summary} />}

          {summary && (
            <div className="card">
              <h2>By category</h2>
              <CategoryChart categories={summary.categories} />
            </div>
          )}

          {summary && (
            <div className="card">
              <h2>Last 12 months</h2>
              <TrendChart trend={summary.trend} />
            </div>
          )}

          <Filters
            categories={categories}
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters(emptyFilters)}
          />

          <div className="card">
            <h2>Expenses</h2>
            {loading ? (
              <p className="empty">Loading…</p>
            ) : (
              <ExpenseTable
                expenses={expenses}
                categories={categories}
                sort={sort}
                order={order}
                onSort={handleSort}
                onSave={handleUpdate}
                onDelete={handleDelete}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
