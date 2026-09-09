import { useState } from 'react';
import { formatMoney, formatMonthLong, titleCase } from '../format.js';

const emptyDraft = () => ({ description: '', amount: '', category: 'other', dayOfMonth: '1' });

export default function Recurring({ month, categories, templates, onAdd, onDelete, onApply }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  const update = (field) => (event) => setDraft({ ...draft, [field]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    const created = await onAdd({ ...draft, dayOfMonth: Number(draft.dayOfMonth) });
    setBusy(false);
    if (created) {
      setDraft(emptyDraft());
      setAdding(false);
    }
  }

  async function apply() {
    setBusy(true);
    setResult('');
    const outcome = await onApply();
    setBusy(false);
    if (outcome) {
      setResult(
        outcome.created === 0
          ? `Already added for ${formatMonthLong(month)}`
          : `Added ${outcome.created} to ${formatMonthLong(month)}` +
              (outcome.skipped ? `, ${outcome.skipped} already there` : '')
      );
    }
  }

  return (
    <div className="card">
      <h2>Recurring</h2>

      {templates.length === 0 ? (
        <p className="hint">Nothing recurring yet. Add rent or a bill to stop retyping it.</p>
      ) : (
        <ul className="recurring-list">
          {templates.map((template) => (
            <li key={template.id}>
              <span className="recurring-main">
                <span className="recurring-name">{template.description}</span>
                <span className="hint">
                  {titleCase(template.category)} · day {template.dayOfMonth}
                </span>
              </span>
              <span className="recurring-amount">{formatMoney(template.amount)}</span>
              <button type="button" className="link danger" onClick={() => onDelete(template.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form className="recurring-form" onSubmit={submit}>
          <label>
            Description
            <input type="text" value={draft.description} onChange={update('description')} required />
          </label>
          <label>
            Amount (₹)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={draft.amount}
              onChange={update('amount')}
              required
            />
          </label>
          <label>
            Category
            <select value={draft.category} onChange={update('category')}>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {titleCase(category)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Day of month
            <input
              type="number"
              min="1"
              max="28"
              value={draft.dayOfMonth}
              onChange={update('dayOfMonth')}
              required
            />
          </label>
          <div className="button-row">
            <button type="submit" disabled={busy}>
              Save
            </button>
            <button type="button" className="secondary" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="button-row">
          <button type="button" className="secondary" onClick={() => setAdding(true)}>
            Add recurring
          </button>
          {templates.length > 0 && (
            <button type="button" onClick={apply} disabled={busy}>
              Add to this month
            </button>
          )}
        </div>
      )}

      {result && <p className="hint">{result}</p>}
      <p className="hint">Day is capped at 28 so it exists in every month.</p>
    </div>
  );
}
