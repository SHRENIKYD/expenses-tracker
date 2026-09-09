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

const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const monthLong = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayLabel = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });

export const formatMoney = (value) => rupees.format(value);
export const formatMoneyShort = (value) => rupeesCompact.format(value);
export const formatMonth = (month) => monthLabel.format(new Date(`${month}-01T00:00:00Z`));
export const formatMonthLong = (month) => monthLong.format(new Date(`${month}-01T00:00:00Z`));
export const formatDay = (date) => dayLabel.format(new Date(`${date}T00:00:00Z`));

export const formatPercent = (fraction) =>
  `${fraction > 0 ? '+' : ''}${(fraction * 100).toFixed(1)}%`;

export const titleCase = (text) => text.charAt(0).toUpperCase() + text.slice(1);

export const currentMonth = () => new Date().toISOString().slice(0, 7);

export const todayIso = () => new Date().toISOString().slice(0, 10);

// "Today" / "Yesterday" read better than a date on a phone, but only for the
// last two days — beyond that the actual date is more useful than "5 days ago".
export function formatRelativeDay(date) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const value = new Date(`${date}T00:00:00Z`).getTime();
  const days = Math.round((todayUtc - value) / 86400000);

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

export const paymentLabel = (method) => (method ? PAYMENT_LABEL[method] || titleCase(method) : null);
