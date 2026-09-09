import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon, { CATEGORY_ICON } from './Icon.jsx';
import useDebouncedValue from '../useDebouncedValue.js';
import { listExpenses } from '../api.js';
import { formatDayFull, formatMoney } from '../format.js';

const LIMIT = 6;

export default function GlobalSearch({ onSeeAll }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);

  const query = useDebouncedValue(term.trim(), 220);
  const box = useRef(null);
  // Responses can land out of order; only the newest one is allowed to win.
  const latest = useRef(0);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    const request = ++latest.current;
    setSearching(true);
    // No date bounds: the header search looks across everything recorded, not
    // just the period on screen.
    listExpenses({ q: query, sort: 'date', order: 'desc' })
      .then((rows) => {
        if (request !== latest.current) return;
        setResults(rows.slice(0, LIMIT));
        setActive(-1);
      })
      .catch(() => {
        if (request === latest.current) setResults([]);
      })
      .finally(() => {
        if (request === latest.current) setSearching(false);
      });
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!box.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function seeAll() {
    if (!term.trim()) return;
    onSeeAll(term.trim());
    setOpen(false);
    navigate('/transactions');
  }

  function choose(expense) {
    // There is no single-transaction page, so opening a result means showing it
    // in the list with the search that found it still applied.
    onSeeAll(expense.description);
    setOpen(false);
    navigate('/transactions');
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + step + results.length) % results.length);
      setOpen(true);
    }
  }

  const showPanel = open && query.length >= 2;

  return (
    <div className="global-search-wrap" ref={box}>
      <form
        className="global-search search-field"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (active >= 0 && results[active]) choose(results[active]);
          else seeAll();
        }}
      >
        <button type="submit" aria-label="Search">
          <Icon name="search" size={18} />
        </button>
        <input
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="global-search-results"
          aria-label="Search transactions and categories"
          placeholder="Search transactions, categories…"
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {term && (
          <button
            type="button"
            className="global-search-clear"
            aria-label="Clear search"
            onClick={() => {
              setTerm('');
              setResults([]);
              setOpen(false);
            }}
          >
            <Icon name="close" size={15} strokeWidth={2.2} />
          </button>
        )}
      </form>

      {showPanel && (
        <div className="search-results" id="global-search-results" role="listbox">
          {results.map((expense, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === active}
              key={expense.id}
              className={index === active ? 'search-result active' : 'search-result'}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(expense)}
            >
              <Icon name={CATEGORY_ICON[expense.category] || 'other'} size={18} strokeWidth={1.8} />
              <span className="search-result-main">
                <span className="search-result-name">{expense.description}</span>
                <span className="hint">{formatDayFull(expense.date)}</span>
              </span>
              <span className={expense.kind === 'income' ? 'amount-in' : 'amount-out'}>
                {expense.kind === 'income' ? '+' : '−'}
                {formatMoney(expense.amount)}
              </span>
            </button>
          ))}

          {results.length === 0 && (
            <p className="hint search-empty">
              {searching ? 'Searching…' : `Nothing matches “${query}”.`}
            </p>
          )}

          {results.length > 0 && (
            <button type="button" className="search-see-all" onClick={seeAll}>
              See every match for “{query}”
              <Icon name="chevronRight" size={15} strokeWidth={2} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
