import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ExpenseForm from './components/ExpenseForm.jsx';
import ExpenseTable from './components/ExpenseTable.jsx';
import Filters from './components/Filters.jsx';
import SummaryCards from './components/SummaryCards.jsx';
import CategoryChart from './components/CategoryChart.jsx';
import TrendChart from './components/TrendChart.jsx';
import Budgets from './components/Budgets.jsx';
import ImportExport from './components/ImportExport.jsx';
import DailyChart from './components/DailyChart.jsx';
import useDebouncedValue from './useDebouncedValue.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Recurring from './components/Recurring.jsx';
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
  updateExpense,
  listRecurring,
  createRecurring,
  deleteRecurring,
  applyRecurring
} from './api.js';

const emptyFilters = { q: '', category: '', from: '', to: '' };

export default function App() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState(['other']);
  const [budgets, setBudgets] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [sort, setSort] = useState('date');
  const [order, setOrder] = useState('desc');
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [undoable, setUndoable] = useState(null);
  const undoTimer = useRef(null);

  const debouncedQuery = useDebouncedValue(filters.q, 300);

  const queryFilters = useMemo(
    () => ({
      q: debouncedQuery,
      category: filters.category,
      from: filters.from,
      to: filters.to
    }),
    [debouncedQuery, filters.category, filters.from, filters.to]
  );

  const loadExpenses = useCallback(async () => {
    const rows = await listExpenses({ ...queryFilters, sort, order });
    setExpenses(rows);
  }, [queryFilters, sort, order]);

  const loadSummary = useCallback(async () => {
    const [nextSummary, nextBudgets, nextRecurring] = await Promise.all([
      getSummary(month),
      listBudgets(),
      listRecurring()
    ]);
    setSummary(nextSummary);
    setBudgets(nextBudgets);
    setRecurring(nextRecurring);
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

  function clearUndo() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setUndoable(null);
  }

  const handleDelete = (id) => {
    const removed = expenses.find((expense) => expense.id === id);
    return guard(async () => {
      await deleteExpense(id);
      await refresh();
      if (removed) {
        if (undoTimer.current) clearTimeout(undoTimer.current);
        setUndoable(removed);
        undoTimer.current = setTimeout(() => setUndoable(null), 8000);
      }
      return true;
    });
  };

  const handleUndo = () => {
    const expense = undoable;
    clearUndo();
    return guard(async () => {
      await createExpense({
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        date: expense.date
      });
      await refresh();
      return true;
    });
  };

  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

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

  const handleAddRecurring = (template) =>
    guard(async () => {
      const created = await createRecurring(template);
      await loadSummary();
      return created;
    });

  const handleDeleteRecurring = (id) =>
    guard(async () => {
      await deleteRecurring(id);
      await loadSummary();
      return true;
    });

  const handleApplyRecurring = () =>
    guard(async () => {
      const outcome = await applyRecurring(month);
      await refresh();
      return outcome;
    });

  const handleExport = () => guard(() => exportCsv({ ...queryFilters, sort, order }));

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

      {undoable && (
        <p className="undo-bar" role="status">
          <span>
            Deleted “{undoable.description}”
          </span>
          <button type="button" className="link" onClick={handleUndo}>
            Undo
          </button>
        </p>
      )}

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
          <Recurring
            month={month}
            categories={categories}
            templates={recurring}
            onAdd={handleAddRecurring}
            onDelete={handleDeleteRecurring}
            onApply={handleApplyRecurring}
          />
          <ImportExport onExport={handleExport} onImport={handleImport} />
        </div>

        <div className="column wide">
          {summary && <SummaryCards summary={summary} />}

          {summary && (
            <ErrorBoundary title="By category">
              <div className="card">
                <h2>By category</h2>
                <CategoryChart categories={summary.categories} />
              </div>
            </ErrorBoundary>
          )}

          {summary && (
            <ErrorBoundary title="Daily spending">
              <div className="card">
                <h2>Daily spending</h2>
                <DailyChart month={summary.month} daily={summary.daily} />
              </div>
            </ErrorBoundary>
          )}

          {summary && (
            <ErrorBoundary title="Last 12 months">
              <div className="card">
                <h2>Last 12 months</h2>
                <TrendChart trend={summary.trend} />
              </div>
            </ErrorBoundary>
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
