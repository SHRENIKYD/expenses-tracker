import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useDebouncedValue from './useDebouncedValue.js';
import { currentMonth } from './format.js';
import {
  applyRecurring,
  createExpense,
  createRecurring,
  deleteExpense,
  deleteRecurring,
  exportCsv,
  getSettings,
  getSummary,
  importCsv,
  listBudgets,
  listCategories,
  listExpenses,
  listRecurring,
  saveSettings,
  setBudget,
  updateExpense
} from './api.js';

export const emptyFilters = { q: '', category: '', from: '', to: '', kind: '' };

export default function useExpensesData() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState({ expense: ['other'], income: ['salary'], paymentMethods: [] });
  const [budgets, setBudgets] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [settings, setSettings] = useState({ displayName: '', monthlyBudget: 0 });
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
      kind: filters.kind,
      from: filters.from,
      to: filters.to
    }),
    [debouncedQuery, filters.category, filters.kind, filters.from, filters.to]
  );

  const loadExpenses = useCallback(async () => {
    setExpenses(await listExpenses({ ...queryFilters, sort, order }));
  }, [queryFilters, sort, order]);

  const loadContext = useCallback(async () => {
    const [nextSummary, nextBudgets, nextRecurring, nextSettings] = await Promise.all([
      getSummary(month),
      listBudgets(),
      listRecurring(),
      getSettings()
    ]);
    setSummary(nextSummary);
    setBudgets(nextBudgets);
    setRecurring(nextRecurring);
    setSettings(nextSettings);
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([loadExpenses(), loadContext(), listCategories()])
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
  }, [loadExpenses, loadContext]);

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    []
  );

  const refresh = useCallback(async () => {
    await Promise.all([loadExpenses(), loadContext()]);
  }, [loadExpenses, loadContext]);

  const guard = useCallback(async (action) => {
    try {
      const result = await action();
      setError('');
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  function clearUndo() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setUndoable(null);
  }

  const handlers = {
    refresh,
    async create(form) {
      setSubmitting(true);
      const created = await guard(async () => {
        const expense = await createExpense(form);
        await refresh();
        return expense;
      });
      setSubmitting(false);
      return created;
    },
    update: (id, patch) =>
      guard(async () => {
        const saved = await updateExpense(id, patch);
        await refresh();
        return saved;
      }),
    remove(id) {
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
    },
    undo() {
      const expense = undoable;
      clearUndo();
      return guard(async () => {
        await createExpense({
          kind: expense.kind,
          description: expense.description,
          amount: expense.amount,
          category: expense.category,
          date: expense.date,
          paymentMethod: expense.paymentMethod,
          note: expense.note
        });
        await refresh();
        return true;
      });
    },
    setBudget: (category, limit) =>
      guard(async () => {
        await setBudget(category, limit);
        await loadContext();
        return true;
      }),
    saveSettings: (next) =>
      guard(async () => {
        const saved = await saveSettings(next);
        setSettings(saved);
        await loadContext();
        return saved;
      }),
    addRecurring: (template) =>
      guard(async () => {
        const created = await createRecurring(template);
        await loadContext();
        return created;
      }),
    removeRecurring: (id) =>
      guard(async () => {
        await deleteRecurring(id);
        await loadContext();
        return true;
      }),
    applyRecurring: () =>
      guard(async () => {
        const outcome = await applyRecurring(month);
        await refresh();
        return outcome;
      }),
    importCsv: (text) =>
      guard(async () => {
        const outcome = await importCsv(text);
        await refresh();
        return outcome;
      }),
    exportCsv: () => guard(() => exportCsv({ ...queryFilters, sort, order })),
    sortBy(key) {
      if (sort === key) setOrder(order === 'asc' ? 'desc' : 'asc');
      else {
        setSort(key);
        setOrder(key === 'amount' || key === 'date' ? 'desc' : 'asc');
      }
    }
  };

  return {
    expenses,
    categories,
    budgets,
    recurring,
    settings,
    summary,
    filters,
    setFilters,
    sort,
    order,
    month,
    setMonth,
    loading,
    submitting,
    error,
    undoable,
    clearUndo,
    handlers
  };
}
