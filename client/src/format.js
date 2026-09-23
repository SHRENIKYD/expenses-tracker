const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const rupeesCompact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

// "Sept 26" read as the 26th of September. The year is written out wherever a
// month is named; only a chart axis, with twelve of them side by side, is short
// of room, and there the apostrophe says it is a year: "Sept ’26".
const monthLabel = new Intl.DateTimeFormat('en-IN', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
});
const monthShort = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' });
const monthLong = new Intl.DateTimeFormat('en-IN', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC'
});
const dayLabel = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC'
});

export const formatMoney = (value) => rupees.format(value);
const rupeesWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});
export const formatMoneyTrim = (value) =>
  Number.isInteger(value) ? rupeesWhole.format(value) : rupees.format(value);

export const formatMoneyShort = (value) => rupeesCompact.format(value);
export const formatMonth = (month) => monthLabel.format(new Date(`${month}-01T00:00:00Z`));
export const formatMonthAxis = (month) =>
  `${monthShort.format(new Date(`${month}-01T00:00:00Z`))} ’${month.slice(2, 4)}`;
export const formatMonthLong = (month) => monthLong.format(new Date(`${month}-01T00:00:00Z`));
export const formatDay = (date) => dayLabel.format(new Date(`${date}T00:00:00Z`));

// "09 Sep 2026" — en-GB keeps the three-letter month that en-IN spells "Sept".
const dayFull = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC'
});
export const formatDayFull = (date) => dayFull.format(new Date(`${date}T00:00:00Z`));

export const formatPercent = (fraction) =>
  `${fraction > 0 ? '+' : ''}${(fraction * 100).toFixed(1)}%`;

export const titleCase = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// The date on the calendar where the user is. Stored dates are calendar days,
// pinned to UTC midnight so arithmetic on them never shifts; but *now* has to
// be read from the device's own calendar first. Read through UTC, "today" was
// yesterday in India until 05:30 every morning.
export const localDay = (at = new Date()) => {
  const date = at instanceof Date ? at : new Date(at);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const currentMonth = () => localDay().slice(0, 7);

export const todayIso = () => localDay();

// "Today" / "Yesterday" read better than a date on a phone, but only for the
// last two days — beyond that the actual date is more useful than "5 days ago".
export function formatRelativeDay(date) {
  const today = new Date(`${todayIso()}T00:00:00Z`).getTime();
  const value = new Date(`${date}T00:00:00Z`).getTime();
  const days = Math.round((today - value) / 86400000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return formatDay(date);
}

export const PAYMENT_LABEL = {
  upi: 'UPI',
  card: 'Card',
  cash: 'Cash',
  bank_transfer: 'Bank transfer'
};

export const paymentLabel = (method) =>
  method ? PAYMENT_LABEL[method] || titleCase(method) : null;

const longDay = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

export const formatToday = () => longDay.format(new Date());
