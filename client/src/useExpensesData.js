import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useDebouncedValue from './useDebouncedValue.js';
import { monthRange } from './dashboard.js';
import {
  listAccounts,
  createAccount,
  removeAccount,
  listGoals,
  createGoal,
  removeGoal,
  contributeGoal
} from './data/index.js';
import { currentMonth } from './format.js';
import { defaultRange, monthSelection, rangeQuery } from './range.js';
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
} from './data/index.js';

export const emptyFilters = {
  q: '',
  category: '',
  from: '',
  to: '',
  kind: '',
  paymentMethod: '',
  // Set by the header search, which looks across every date rather than the
  // period on screen.
  searchAll: false
};

export default function useExpensesData() {
  const [accounts, setAccounts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState({
    expense: ['other'],
    income: ['salary'],
    paymentMethods: []
  });
  const [budgets, setBudgets] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [settings, setSettings] = useState({
    displayName: '',
    monthlyBudget: 0
  });
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [sort, setSort] = useState('date');
  const [order, setOrder] = useState('desc');
  const [range, setRange] = useState(defaultRange);
  // True from the moment a period is chosen until its figures land, so the
  // pages can show placeholders rather than the previous period's numbers.
  const [periodLoading, setPeriodLoading] = useState(false);
  // Everything that still thinks in months reads this; a custom window reports
  // the month its range ends in.
  const month = range.mode === 'month' ? range.month : range.to.slice(0, 7);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [undoable, setUndoable] = useState(null);
  const undoTimer = useRef(null);
  const expensesRequest = useRef(0);
  const contextRequest = useRef(0);

  const debouncedQuery = useDebouncedValue(filters.q, 300);

  const queryFilters = useMemo(
    () => ({
      q: debouncedQuery,
      category: filters.category,
      kind: filters.kind,
      paymentMethod: filters.paymentMethod,
      from: filters.searchAll ? filters.from : filters.from || range.from,
      to: filters.searchAll ? filters.to : filters.to || range.to
    }),
    [
      debouncedQuery,
      filters.category,
      filters.kind,
      filters.paymentMethod,
      filters.from,
      filters.to,
      filters.searchAll,
      range.from,
      range.to
    ]
  );

  const loadExpenses = useCallback(async () => {
    const request = ++expensesRequest.current;
    const rows = await listExpenses({ ...queryFilters, sort, order });
    if (request === expensesRequest.current) setExpenses(rows);
  }, [queryFilters, sort, order]);

  const loadContext = useCallback(async () => {
    const request = ++contextRequest.current;
    const [nextSummary, nextBudgets, nextRecurring, nextSettings, nextAccounts, nextGoals] =
      await Promise.all([
        getSummary(rangeQuery(range)),
        listBudgets(),
        listRecurring(),
        getSettings(),
        listAccounts(),
        listGoals()
      ]);
    if (request !== contextRequest.current) return;
    setSummary(nextSummary);
    setBudgets(nextBudgets);
    setRecurring(nextRecurring);
    setSettings(nextSettings);
    setAccounts(nextAccounts);
    setGoals(nextGoals);
  }, [range]);

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
        if (!cancelled) {
          setLoading(false);
          setPeriodLoading(false);
        }
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
    createAccount: (value) =>
      guard(async () => {
        const result = await createAccount(value);
        await refresh();
        return result;
      }),
    removeAccount: (id) =>
      guard(async () => {
        await removeAccount(id);
        await refresh();
        return true;
      }),
    createGoal: (value) =>
      guard(async () => {
        const result = await createGoal(value);
        await loadContext();
        return result;
      }),
    removeGoal: (id) =>
      guard(async () => {
        await removeGoal(id);
        await loadContext();
        return true;
      }),
    contributeGoal: (id, amount) =>
      guard(async () => {
        const result = await contributeGoal(id, amount);
        await loadContext();
        return result;
      }),
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
          note: expense.note,
          accountId: expense.accountId
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

  handlers.addGoal = handlers.createGoal;
  handlers.contribute = handlers.contributeGoal;

  return {
    expenses,
    accounts,
    goals,
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
    range,
    // The list follows the range by default, so choosing a window narrows both
    // the figures and the transactions behind them. An explicit date filter
    // still wins over it.
    periodLoading,
    setRange: (next) => {
      // Drop the old period's figures immediately: showing September's totals
      // under a July heading, even for a moment, is worse than a placeholder.
      setSummary(null);
      setPeriodLoading(true);
      setRange(next);
      // Choosing a period ends an all-dates search: the list goes back to
      // following the range.
      setFilters((current) => ({ ...current, from: '', to: '', searchAll: false }));
    },
    setMonth: (value) => {
      if (!/^\d{4}-\d{2}$/.test(value)) return;
      setSummary(null);
      setPeriodLoading(true);
      setRange(monthSelection(value));
      setFilters((current) => ({ ...current, from: '', to: '', searchAll: false }));
    },
    loading,
    submitting,
    error,
    undoable,
    clearUndo,
    handlers
  };
}
