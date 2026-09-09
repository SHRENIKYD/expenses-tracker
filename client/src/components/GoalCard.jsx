import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { money } from '../dashboard.js';
import { listContributions } from '../api.js';

export default function GoalCard({ goal, handlers, compact = false }) {
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const pct = goal ? Math.round((goal.saved / goal.target) * 100) : 0;
  async function contribute(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const saved = await handlers.contributeGoal(goal.id, amount);
    setBusy(false);
    if (saved) {
      setAmount('');
      setAdding(false);
      setHistory(null);
    }
  }
  async function showHistory() {
    if (history !== null) {
      setHistory(null);
      return;
    }
    setBusy(true);
    setError('');
    try {
      setHistory(await listContributions(goal.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card goal-card">
      <div className="card-head">
        <h2>
          <Icon name="target" />
          Savings goal
        </h2>
        {compact && (
          <Link className="link" to="/goals">
            View all <Icon name="chevronRight" size={14} />
          </Link>
        )}
      </div>
      {!goal ? (
        <div className="empty">
          <p>Give your savings a purpose.</p>
          <Link className="button-primary" to="/goals">
            Create a goal
          </Link>
        </div>
      ) : (
        <>
          <div className="goal-content">
            <span className="goal-icon">
              <Icon name={goal.icon || 'target'} size={32} />
            </span>
            <div className="goal-details">
              <strong>{goal.name}</strong>
              <p>
                {money(goal.saved)} <span className="muted">of {money(goal.target)}</span>
              </p>
              <div
                className="meter"
                role="progressbar"
                aria-label={`${goal.name} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(pct, 100)}
              >
                <div className="meter-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
            <div className="goal-actions">
              <strong>{pct}%</strong>
              <button
                className="soft-button"
                onClick={() => setAdding(!adding)}
                aria-expanded={adding}
              >
                {adding ? 'Cancel' : 'Add money'}
              </button>
            </div>
          </div>
          {adding && (
            <form className="contribution-form" onSubmit={contribute}>
              <label>
                Amount set aside (₹)
                <input
                  type="number"
                  min="0.01"
                  max="9999999999.99"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  autoFocus
                />
              </label>
              <button disabled={busy}>{busy ? 'Saving…' : 'Save contribution'}</button>
              <p className="hint">
                Tracks money you have set aside. Does not move money or add an expense.
              </p>
            </form>
          )}
          {!compact && (
            <div className="button-row goal-footer">
              <button className="link" disabled={busy} onClick={showHistory}>
                {history !== null ? 'Hide history' : 'Contribution history'}
              </button>
              <button
                className="link danger"
                disabled={busy}
                onClick={async () => {
                  if (window.confirm(`Delete “${goal.name}” and its contribution history?`)) {
                    setBusy(true);
                    await handlers.removeGoal(goal.id);
                    setBusy(false);
                  }
                }}
              >
                Delete goal
              </button>
            </div>
          )}
          {history && (
            <ul className="history-list">
              {history.length ? (
                history.map((entry) => (
                  <li key={entry.id}>
                    <span>{new Date(entry.date).toLocaleDateString('en-IN')}</span>
                    <strong>{money(entry.amount)}</strong>
                  </li>
                ))
              ) : (
                <li>No contributions yet.</li>
              )}
            </ul>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
