import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { titleCase } from '../format.js';
import { assignUnassigned, unassignedCount } from '../data/index.js';

// Rows imported before an account was picked — or added without one — sit
// outside the Accounts page. This claims them in one go rather than asking for
// the same edit a hundred times.
export default function UnassignedRows({ accounts, paymentMethods = [], onAssigned }) {
  const [count, setCount] = useState(0);
  const [choice, setChoice] = useState({ accountId: '', paymentMethod: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    unassignedCount()
      .then(setCount)
      .catch(() => setCount(0));
  }, [onAssigned]);

  async function assign() {
    setBusy(true);
    setError('');
    try {
      const outcome = await assignUnassigned(choice);
      setCount(0);
      setChoice({ accountId: '', paymentMethod: '' });
      await onAssigned(outcome.updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (count === 0 || accounts.length === 0) return null;

  return (
    <section className="card unassigned">
      <h2>
        <Icon name="accounts" size={19} strokeWidth={1.9} />
        {count} transaction{count === 1 ? '' : 's'} without an account
      </h2>
      <p className="hint">
        They count towards your totals but not towards any balance. Assign them and the Accounts
        page includes them.
      </p>

      <div className="statement-destination">
        <label>
          Account
          <select
            value={choice.accountId}
            onChange={(event) => setChoice({ ...choice, accountId: event.target.value })}
          >
            <option value="">Choose an account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Paid by
          <select
            value={choice.paymentMethod}
            onChange={(event) => setChoice({ ...choice, paymentMethod: event.target.value })}
          >
            <option value="">Leave as is</option>
            {paymentMethods.map((method) => (
              <option key={method} value={method}>
                {titleCase(method.replace('_', ' '))}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={assign} disabled={busy || !choice.accountId}>
          {busy ? 'Assigning…' : `Assign all ${count}`}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
    </section>
  );
}
