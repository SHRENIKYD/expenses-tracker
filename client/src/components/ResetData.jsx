import { useState } from 'react';
import Icon from './Icon.jsx';
import { deleteAllTransactions } from '../data/index.js';

// Deleting everything, with the friction that deserves.
//
// The word has to be typed, the count is shown before and after, and the export
// is offered first — not because the button is hard to press, but because the
// thing it does cannot be undone by anything the app knows how to do.
export default function ResetData({ count, onExport, onDone }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removed, setRemoved] = useState(null);

  async function remove(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const gone = await deleteAllTransactions();
      setRemoved(Number(gone) || 0);
      setTyped('');
      await onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (removed !== null) {
    return (
      <div className="setting-detail">
        <p className="hint">
          {removed} transaction{removed === 1 ? '' : 's'} deleted. Your accounts, budgets, savings
          goals and settings are as they were.
        </p>
      </div>
    );
  }

  return (
    <div className="setting-detail">
      <p className="hint">
        This deletes every transaction on your account — {count} of them — and cannot be undone.
        Accounts, budgets, savings goals and your settings are kept. Receipts stay in storage; the
        rows that pointed at them are what go.
      </p>

      <div className="button-row">
        <button type="button" className="secondary" onClick={onExport}>
          <Icon name="export" size={16} /> Export everything first
        </button>
      </div>

      <form className="form" onSubmit={remove}>
        <label>
          Type DELETE to confirm
          <input
            type="text"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck="false"
            placeholder="DELETE"
          />
        </label>
        <button type="submit" className="danger-button" disabled={busy || typed !== 'DELETE'}>
          {busy ? 'Deleting…' : `Delete all ${count} transactions`}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
