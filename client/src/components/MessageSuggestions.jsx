import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { formatMoney, formatDay, titleCase } from '../format.js';
import { available, listen, permission, recent } from '../data/messages.js';
import { suggestCategory } from '../statement.js';

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

    let stop = () => {};
    let live = true;

    (async () => {
      const { granted } = await permission();
      if (!granted || !live) return;

      stop = await listen((suggestion) =>
        setSuggestions((current) =>
          // The same alert can arrive twice; its reference, or its shape,
          // says so.
          current.some((entry) => same(entry, suggestion)) ? current : [suggestion, ...current]
        )
      );

      const missed = await recent(3);
      if (!live) return;
      setSuggestions((current) => [
        ...current,
        ...missed.filter((entry) => !current.some((seen) => same(seen, entry)))
      ]);
    })().catch((err) => setError(err.message));

    return () => {
      live = false;
      stop();
    };
  }, []);

  if (suggestions.length === 0 && !error) return null;

  const dismiss = (index) =>
    setSuggestions((current) => current.filter((_, position) => position !== index));

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

// Two readings of the same alert: the same reference, or the same amount and
// direction on the same day.
const same = (a, b) =>
  (a.reference && a.reference === b.reference) ||
  (a.amount === b.amount && a.kind === b.kind && a.date === b.date && a.description === b.description);
