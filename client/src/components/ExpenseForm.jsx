import { useState } from 'react';
import { titleCase, todayIso } from '../format.js';

const emptyForm = () => ({
  description: '',
  amount: '',
  category: 'other',
  date: todayIso()
});

export default function ExpenseForm({ categories, onSubmit, submitting }) {
  const [form, setForm] = useState(emptyForm);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const created = await onSubmit(form);
    if (created) setForm(emptyForm());
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h2>Add expense</h2>

      <label>
        Description
        <input
          type="text"
          value={form.description}
          onChange={(event) => update('description', event.target.value)}
          placeholder="Groceries"
          required
        />
      </label>

      <label>
        Amount (₹)
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={form.amount}
          onChange={(event) => update('amount', event.target.value)}
          placeholder="0.00"
          required
        />
      </label>

      <label>
        Category
        <select value={form.category} onChange={(event) => update('category', event.target.value)}>
          {categories.map((category) => (
            <option key={category} value={category}>
              {titleCase(category)}
            </option>
          ))}
        </select>
      </label>

      <label>
        Date
        <input
          type="date"
          value={form.date}
          max={todayIso()}
          onChange={(event) => update('date', event.target.value)}
          required
        />
      </label>

      <button type="submit" disabled={submitting}>
        {submitting ? 'Saving…' : 'Add expense'}
      </button>
    </form>
  );
}
