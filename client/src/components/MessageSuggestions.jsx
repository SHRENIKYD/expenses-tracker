import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { formatMoney, formatDay, localDay, titleCase } from '../format.js';
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
import { ensureAccount, listExpenses } from '../data/index.js';

// The account an alert is about, when it says both the bank and the digits.
const alertAccount = (suggestion) =>
  suggestion.bank && suggestion.accountTail
    ? {
        bank: suggestion.bank,
        tail: suggestion.accountTail,
        kind: /\bcard\b/i.test(suggestion.body || '') ? 'card' : 'account'
      }
    : null;

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
export default function MessageSuggestions({ onAdd, categories, ledger = 0 }) {
  const [suggestions, setSuggestions] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  // What is already recorded, indexed. Held in a ref so the listeners below are
  // subscribed once while this is rebuilt every time the ledger moves.
  const recorded = useRef(buildIndex([]));

  useEffect(() => {
    if (!available()) return;
    const since = localDay(Date.now() - 10 * 86400000);
    listExpenses({ from: since })
      .then((rows) =>
        (recorded.current = buildIndex(
          rows.map((row) => ({
            id: row.id,
            kind: row.kind,
            description: row.description,
            amount: row.amount,
            date: row.date,
            external_ref: row.externalRef
          }))
        ))
      )
      .catch(() => {
        recorded.current = buildIndex([]);
      });
  }, [ledger]);

  useEffect(() => {
    if (!available() || !readingMessages()) return undefined;

    const stops = [];
    let live = true;

    // Three ways an alert is already dealt with: it is on screen, it was added
    // or dismissed before, or the transaction it describes is in the ledger.
    // Without all three the same messages come back on every launch.
    const seen = handled();
    const shown = new Set();

    const offer = (suggestion) => {
      const mark = fingerprint(suggestion);
      if (seen.has(mark) || shown.has(mark)) return;
      // Three constant-time checks, and the index behind the third is rebuilt
      // whenever the ledger changes — a reset must not leave rows that no
      // longer exist deciding what may be offered.
      if (recorded.current.find(suggestion)) return;
      shown.add(mark);
      setSuggestions((current) => [suggestion, ...current]);
    };

    (async () => {
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
      // Filed under the account it names, which is made the first time an
      // alert or a statement mentions it.
      const account = alertAccount(suggestion);
      const accountId = account ? (await ensureAccount(account)).id : null;
      await onAdd({
        accountId,
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
              {suggestion.bank
                ? ` · ${suggestion.bank.name}${suggestion.accountTail ? ` ••${suggestion.accountTail}` : ''}`
                : suggestion.accountTail
                  ? ` · ••${suggestion.accountTail}`
                  : ''}
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
