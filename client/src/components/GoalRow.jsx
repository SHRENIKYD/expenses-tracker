import { useState } from 'react';
import Icon from './Icon.jsx';
import { formatMoneyTrim } from '../format.js';

export default function GoalRow({ goal, onContribute, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const percent = Math.round(goal.progress * 100);

  async function submit(event) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setBusy(true);
    await onContribute(goal.id, value);
    setBusy(false);
    setAmount('');
    setAdding(false);
  }

  return (
    <li className="goal-row">
      <span className="goal-icon">
        <Icon name={goal.icon} size={26} strokeWidth={1.7} />
      </span>

      <div className="goal-body">
        <div className="goal-head">
          <span className="goal-name">{goal.name}</span>
          <span className="goal-percent">{percent}%</span>
        </div>
        <p className="goal-figures">
          {formatMoneyTrim(goal.saved)} <span className="muted">of {formatMoneyTrim(goal.target)}</span>
        </p>
        <div className="goal-meter">
          <div className="goal-fill" style={{ width: `${Math.min(percent, 100)}%` }} />
        </div>
      </div>

      <div className="goal-actions">
        {adding ? (
          <form className="goal-add" onSubmit={submit}>
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Amount"
              aria-label={`Amount to add to ${goal.name}`}
              autoFocus
            />
            <button type="submit" className="mint" disabled={busy}>
              Save
            </button>
            <button type="button" className="link" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="mint"
            onClick={() => setAdding(true)}
            disabled={goal.saved >= goal.target}
          >
            {goal.saved >= goal.target ? 'Reached' : 'Add money'}
          </button>
        )}

        {onRemove && (
          <button type="button" className="link danger" onClick={() => onRemove(goal.id)}>
            Delete
          </button>
        )}
      </div>
    </li>
  );
}
