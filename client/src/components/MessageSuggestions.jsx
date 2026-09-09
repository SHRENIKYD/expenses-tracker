import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { formatMoney, formatDay, titleCase } from '../format.js';
import {
  available,
  listen,
  listenNotifications,
  notificationAccess,
  permission,
  recent
} from '../data/messages.js';
import { suggestCategory } from '../statement.js';
import { fingerprint, handled, remember } from '../data/handled.js';
import { buildIndex } from '../duplicates.js';
import { listExpenses } from '../data/index.js';

const SETTING = 'tessera.read-messages';

export const readingMessages = () => localStorage.getItem(SETTING) === 'yes';
export const setReadingMessages = (on) => localStorage.setItem(SETTING, on ? 'yes' : 'no');

// Bank alerts, offered rather than recorded.
//
// A parsed message is a suggestion until it is confirmed: the amount, the
// merchant and the direction are shown next to the words they were read from,
// and nothing is written until the tick is pressed. Suggestions live in memory
// only — an unconfirmed message is not written to this device or to the
// database, and a missed one can be found again by asking for the last week.
export default function MessageSuggestions({ onAdd, categories }) {
  const [suggestions, setSuggestions] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!available() || !readingMessages()) return undefined;

    const stops = [];
    let live = true;

    // Three ways an alert is already dealt with: it is on screen, it was added
    // or dismissed before, or the transaction it describes is in the ledger.
    // Without all three the same messages come back on every launch.
    const seen = handled();
    // Three constant-time checks. The ledger is indexed once when the page
    // opens, so an alert arriving at midnight costs the same as the first one.
    let recorded = buildIndex([]);
    const shown = new Set();

    const offer = (suggestion) => {
      const mark = fingerprint(suggestion);
      if (seen.has(mark) || shown.has(mark)) return;
      if (recorded.find(suggestion)) return;
      shown.add(mark);
      setSuggestions((current) => [suggestion, ...current]);
    };

    (async () => {
      // What is already recorded around the days the reader looks back over.
      const since = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
      recorded = buildIndex(
        (await listExpenses({ from: since })).map((row) => ({
          id: row.id,
          kind: row.kind,
          description: row.description,
          amount: row.amount,
          date: row.date,
          external_ref: row.externalRef
        }))
      );
      if (!live) return;

      const { granted } = await permission();
      if (granted && live) {
        stops.push(await listen(offer));

        const missed = await recent(3);
        if (!live) return;
        for (const suggestion of missed) offer(suggestion);
      }

      if (!live) return;
      if (await notificationAccess()) stops.push(await listenNotifications(offer));
    })().catch((err) => setError(err.message));

    return () => {
      live = false;
      for (const stop of stops) stop();
    };
  }, []);

  if (suggestions.length === 0 && !error) return null;

  // Dismissing is a decision, so it is remembered: the alert does not come
  // back on the next launch.
  const dismiss = (index, forget = true) =>
    setSuggestions((current) =>
      current.filter((entry, position) => {
        if (position !== index) return true;
        if (forget) remember(entry);
        return false;
      })
    );

  async function accept(suggestion, index) {
    setBusy(index);
    setError('');
    try {
      await onAdd({
        kind: suggestion.kind,
        description: suggestion.description,
        amount: suggestion.amount,
        category: suggestCategory(suggestion.description, suggestion.kind),
        date: suggestion.date,
        source: 'message',
        externalRef: suggestion.reference || null,
        note: suggestion.sender ? `From ${suggestion.sender}` : ''
      });
      dismiss(index);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card suggestions">
      <div className="card-head">
        <h2>
          <Icon name="bell" size={19} strokeWidth={1.9} />
          From your messages
        </h2>
        <span className="hint">{suggestions.length} to check</span>
      </div>

      {error && <p className="error">{error}</p>}

      <ul className="suggestion-list">
        {suggestions.map((suggestion, index) => (
          <li key={`${suggestion.date}-${suggestion.amount}-${index}`}>
            <div className="suggestion-main">
              <span className="suggestion-name">{suggestion.description}</span>
              <span className={suggestion.kind === 'income' ? 'amount-in' : 'amount-out'}>
                {suggestion.kind === 'income' ? '+' : '−'}
                {formatMoney(suggestion.amount)}
              </span>
            </div>
            <p className="suggestion-meta">
              {formatDay(suggestion.date)} ·{' '}
              {titleCase(suggestCategory(suggestion.description, suggestion.kind))}
              {suggestion.accountTail ? ` · ⋯${suggestion.accountTail}` : ''}
            </p>
            {/* The words it was read from, so a wrong reading is obvious. */}
            <p className="suggestion-source">{suggestion.body}</p>
            <div className="button-row">
              <button type="button" onClick={() => accept(suggestion, index)} disabled={busy === index}>
                {busy === index ? 'Adding…' : 'Add it'}
              </button>
              <button type="button" className="link" onClick={() => dismiss(index)}>
                Not a transaction
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
