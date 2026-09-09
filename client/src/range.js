import { currentMonth, todayIso } from './format.js';

// A range is either a calendar month or an explicit window. Presets are just
// named ways of producing one, so the rest of the app only ever sees {from,to}.

const iso = (date) => date.toISOString().slice(0, 10);
const shift = (days) => iso(new Date(Date.now() + days * 86400000));

export function monthSelection(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    mode: 'month',
    month,
    from: `${month}-01`,
    to: iso(new Date(Date.UTC(year, monthNumber, 0)))
  };
}

function quarterToDate() {
  const now = new Date();
  const startMonth = Math.floor(now.getUTCMonth() / 3) * 3;
  return {
    mode: 'preset',
    preset: 'quarter',
    from: iso(new Date(Date.UTC(now.getUTCFullYear(), startMonth, 1))),
    to: todayIso()
  };
}

export const PRESETS = [
  { id: 'month', label: 'This month', build: () => monthSelection(currentMonth()) },
  {
    id: 'last7',
    label: 'Last 7 days',
    build: () => ({ mode: 'preset', preset: 'last7', from: shift(-6), to: todayIso() })
  },
  {
    id: 'last30',
    label: 'Last 30 days',
    build: () => ({ mode: 'preset', preset: 'last30', from: shift(-29), to: todayIso() })
  },
  { id: 'quarter', label: 'This quarter', build: quarterToDate },
  {
    id: 'year',
    label: 'Year to date',
    build: () => ({
      mode: 'preset',
      preset: 'year',
      from: `${new Date().getUTCFullYear()}-01-01`,
      to: todayIso()
    })
  }
];

export function customRange(from, to) {
  return { mode: 'custom', from, to };
}

export const rangeQuery = (range) =>
  range.mode === 'month' ? { month: range.month } : { from: range.from, to: range.to };

export const defaultRange = () => monthSelection(currentMonth());
