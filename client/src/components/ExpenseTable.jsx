import { useEffect, useState } from 'react';
import { formatMoney, formatDay, titleCase } from '../format.js';

const COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'amount', label: 'Amount', numeric: true }
];

const PAGE_SIZE = 25;

export default function ExpenseTable({
  expenses,
  categories,
  incomeCategories = [],
  paymentMethods = [],
  accounts = [],
  sort,
  order,
  onSort,
  onSave,
  onDelete
}) {
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const pageCount = Math.max(Math.ceil(expenses.length / PAGE_SIZE), 1);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    setPage(1);
  }, [sort, order, expenses.length]);

  function startEdit(expense) {
    setEditingId(expense.id);
    setDraft({
      accountId: expense.accountId || '',
      description: expense.description,
      amount: String(expense.amount),
      category: expense.category,
      date: expense.date
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function commit() {
    setSaving(true);
    const saved = await onSave(editingId, draft);
    setSaving(false);
    if (saved) cancelEdit();
  }

  if (expenses.length === 0) {
    return <p className="empty">No expenses match these filters.</p>;
  }

  const start = (page - 1) * PAGE_SIZE;
  const visible = expenses.slice(start, start + PAGE_SIZE);

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} className={column.numeric ? 'numeric' : undefined}>
                <button
                  type="button"
                  className="sort"
                  onClick={() => onSort(column.key)}
                  aria-label={`Sort by ${column.label}`}
                >
                  {column.label}
                  {sort === column.key && (
                    <span aria-hidden="true">{order === 'asc' ? ' ▲' : ' ▼'}</span>
                  )}
                </button>
              </th>
            ))}
            <th>Account</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {visible.map((expense) =>
            editingId === expense.id ? (
              <tr key={expense.id} className="editing">
                <td>
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={draft.description}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  />
                </td>
                <td>
                  <select
                    value={draft.category}
                    onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                  >
                    {(expense.kind === 'income' ? incomeCategories : categories).map((category) => (
                      <option key={category} value={category}>
                        {titleCase(category)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="numeric">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={draft.amount}
                    onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                  />
                </td>
                <td>
                  <select
                    aria-label="Account"
                    value={draft.accountId}
                    onChange={(event) => setDraft({ ...draft, accountId: event.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="actions">
                  <button type="button" onClick={commit} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" className="secondary" onClick={cancelEdit}>
                    Cancel
                  </button>
                </td>
              </tr>
            ) : (
              <tr key={expense.id}>
                <td data-label="Date">{formatDay(expense.date)}</td>
                <td data-label="Description">{expense.description}</td>
                <td data-label="Category">
                  <span className="tag">{titleCase(expense.category)}</span>
                </td>
                <td className="numeric" data-label="Amount">
                  <span className={expense.kind === 'income' ? 'amount-in' : 'amount-out'}>
                    {expense.kind === 'income' ? '+' : '−'}
                    {formatMoney(expense.amount)}
                  </span>
                </td>
                <td data-label="Account">
                  {accounts.find((account) => account.id === expense.accountId)?.name ||
                    'Unassigned'}
                </td>
                <td className="actions">
                  <button type="button" className="link" onClick={() => startEdit(expense)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="link danger"
                    onClick={() => onDelete(expense.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan="3">Total of {expenses.length} matching</td>
            <td className="numeric">
              {formatMoney(expenses.reduce((sum, expense) => sum + expense.amount, 0))}
            </td>
            <td colSpan="2" />
          </tr>
        </tfoot>
      </table>

      <div className="pager">
        <span className="muted">
          {start + 1}–{Math.min(start + PAGE_SIZE, expenses.length)} of {expenses.length}
        </span>
        {pageCount > 1 && (
          <span className="pager-controls">
            <button
              type="button"
              className="secondary"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              Previous
            </button>
            <span className="muted">
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              className="secondary"
              onClick={() => setPage(page + 1)}
              disabled={page === pageCount}
            >
              Next
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
