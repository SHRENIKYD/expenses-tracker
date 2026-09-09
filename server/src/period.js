// A period is a closed [from, to] day range. A month is just the shorthand for
// one; everything downstream works in ranges so a custom window costs no extra
// code paths.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const asDate = (iso) => new Date(`${iso}T00:00:00Z`);
const asIso = (date) => date.toISOString().slice(0, 10);

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const date = asDate(value);
  return !Number.isNaN(date.getTime()) && asIso(date) === value;
}

function monthEnd(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return asIso(new Date(Date.UTC(year, monthNumber, 0)));
}

function monthStart(month) {
  return `${month}-01`;
}

function addDays(iso, days) {
  return asIso(new Date(asDate(iso).getTime() + days * 86400000));
}

// Inclusive, so a single day is one day long rather than zero.
function daysBetween(from, to) {
  return Math.round((asDate(to) - asDate(from)) / 86400000) + 1;
}

// The window of the same length ending the day before this one starts: what
// "versus the previous period" compares against, whatever the period is.
function previousPeriod({ from, to }) {
  const length = daysBetween(from, to);
  return { from: addDays(from, -length), to: addDays(from, -1) };
}

// A range covering exactly one calendar month can carry month-scoped figures —
// the monthly budget, the month-end projection. An arbitrary window cannot.
function coveredMonth({ from, to }) {
  const month = from.slice(0, 7);
  return from === monthStart(month) && to === monthEnd(month) ? month : null;
}

// Every month the range touches, so recurring bills can be expanded across it.
function monthsInRange({ from, to }) {
  const months = [];
  let [year, month] = from.split('-').map(Number);
  const last = to.slice(0, 7);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    months.push(key);
    if (key >= last) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

// Accepts either a month or an explicit range and answers with one shape.
function resolvePeriod(query, today) {
  const { from, to, month } = query;

  if (from || to) {
    if (!isValidIsoDate(from) || !isValidIsoDate(to)) {
      return { errors: ['from and to must both be YYYY-MM-DD dates'] };
    }
    if (from > to) return { errors: ['from must not be after to'] };
    if (daysBetween(from, to) > 1096) {
      return { errors: ['a range may cover at most three years'] };
    }
    return { period: { from, to } };
  }

  const key = month || today.slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) {
    return { errors: ['month must be in YYYY-MM format'] };
  }
  return { period: { from: monthStart(key), to: monthEnd(key) } };
}

module.exports = {
  addDays,
  coveredMonth,
  daysBetween,
  isValidIsoDate,
  monthEnd,
  monthStart,
  monthsInRange,
  previousPeriod,
  resolvePeriod
};
