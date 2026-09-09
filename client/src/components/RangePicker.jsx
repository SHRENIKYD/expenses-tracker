import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { PRESETS, customRange, monthSelection } from '../range.js';
import { formatDayFull, formatMonth } from '../format.js';

function label(range) {
  if (range.mode === 'month') return formatMonth(range.month);
  const preset = PRESETS.find((entry) => entry.id === range.preset);
  return preset ? preset.label : `${formatDayFull(range.from)} – ${formatDayFull(range.to)}`;
}

export default function RangePicker({ range, onChange, busy = false }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from: range.from, to: range.to });
  const box = useRef(null);

  useEffect(() => setDraft({ from: range.from, to: range.to }), [range.from, range.to]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!box.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  function apply(event) {
    event.preventDefault();
    if (!draft.from || !draft.to || draft.from > draft.to) return;
    onChange(customRange(draft.from, draft.to));
    setOpen(false);
  }

  return (
    <div className="range-picker" ref={box}>
      <button
        type="button"
        className={busy ? 'month-select range-button busy' : 'month-select range-button'}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-busy={busy}
      >
        <Icon name="calendar" size={16} />
        <span>{label(range)}</span>
        {busy ? (
          <span className="spinner" aria-hidden="true" />
        ) : (
          <Icon name="chevronDown" size={15} strokeWidth={2} />
        )}
      </button>

      {open && (
        <div className="range-panel" role="dialog" aria-label="Choose a period">
          <div className="range-presets">
            {PRESETS.map((preset) => {
              const active =
                (preset.id === 'month' && range.mode === 'month') || range.preset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={active ? 'range-preset active' : 'range-preset'}
                  onClick={() => {
                    onChange(preset.build());
                    setOpen(false);
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <form className="range-custom" onSubmit={apply}>
            <label>
              A month
              <input
                type="month"
                value={range.mode === 'month' ? range.month : range.to.slice(0, 7)}
                onChange={(event) => {
                  if (!event.target.value) return;
                  onChange(monthSelection(event.target.value));
                  setOpen(false);
                }}
              />
            </label>

            <span className="range-or">or a range</span>

            <label>
              From
              <input
                type="date"
                value={draft.from}
                max={draft.to}
                onChange={(event) => setDraft({ ...draft, from: event.target.value })}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={draft.to}
                min={draft.from}
                onChange={(event) => setDraft({ ...draft, to: event.target.value })}
              />
            </label>

            <button type="submit" className="mint">
              Apply
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
