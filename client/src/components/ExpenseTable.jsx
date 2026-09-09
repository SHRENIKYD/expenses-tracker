import { useState } from 'react';
import { formatMoney, formatDay, titleCase } from '../format.js';

const COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'amount', label: 'Amount', numeric: true }
];

export default function ExpenseTable({ expenses, categories, sort, order, onSort, onSave, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  function startEdit(expense) {
    setEditingId(expense.id);
    setDraft({
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
                  {sort === column.key && <span aria-hidden="true">{order === 'asc' ? ' ▲' : ' ▼'}</span>}
                </button>
              </th>
            ))}
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) =>
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
                    {categories.map((category) => (
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
                <td>{formatDay(expense.date)}</td>
                <td>{expense.description}</td>
                <td>
                  <span className="tag">{titleCase(expense.category)}</span>
                </td>
                <td className="numeric">{formatMoney(expense.amount)}</td>
                <td className="actions">
                  <button type="button" className="link" onClick={() => startEdit(expense)}>
                    Edit
                  </button>
                  <button type="button" className="link danger" onClick={() => onDelete(expense.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
