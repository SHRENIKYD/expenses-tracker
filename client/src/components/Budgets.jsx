import { useState } from 'react';
import { formatMoney, titleCase } from '../format.js';

export default function Budgets({ categories, budgets, spending, onSave }) {
  const [editing, setEditing] = useState(null);
  const [value, setValue] = useState('');

  const limits = new Map(budgets.map((budget) => [budget.category, budget.monthlyLimit]));
  const spent = new Map(spending.map((entry) => [entry.category, entry.total]));

  function startEdit(category) {
    setEditing(category);
    setValue(limits.has(category) ? String(limits.get(category)) : '');
  }

  async function commit(category) {
    const saved = await onSave(category, value === '' ? 0 : Number(value));
    if (saved) {
      setEditing(null);
      setValue('');
    }
  }

  return (
    <div className="card">
      <h2>Monthly budgets</h2>
      <ul className="budget-list">
        {categories.map((category) => {
          const limit = limits.get(category) ?? null;
          const used = spent.get(category) ?? 0;
          const over = limit !== null && used > limit;
          const pct = limit ? Math.min((used / limit) * 100, 100) : 0;

          return (
            <li key={category}>
              <div className="budget-head">
                <span>{titleCase(category)}</span>
                {editing === category ? (
                  <span className="budget-edit">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      placeholder="0 to clear"
                      aria-label={`Monthly budget for ${category}`}
                    />
                    <button type="button" onClick={() => commit(category)}>
                      Save
                    </button>
                    <button type="button" className="secondary" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button type="button" className="link" onClick={() => startEdit(category)}>
                    {limit === null ? 'Set budget' : formatMoney(limit)}
                  </button>
                )}
              </div>

              {limit !== null && (
                <>
                  <div className="meter" role="presentation">
                    <div className={over ? 'meter-fill over' : 'meter-fill'} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="budget-foot">
                    <span>{formatMoney(used)} spent</span>
                    {over && (
                      <span className="over-flag">
                        <span aria-hidden="true">⚠</span> Over by {formatMoney(used - limit)}
                      </span>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
