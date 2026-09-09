import { formatMoney, formatMonthLong, formatPercent } from '../format.js';

export default function SummaryCards({ summary }) {
  const { total, count, change, previousTotal, month } = summary;

  return (
    <div className="card">
      <h2>{formatMonthLong(month)}</h2>
      <p className="hero">{formatMoney(total)}</p>
      <p className="hero-sub">
        {count} {count === 1 ? 'expense' : 'expenses'}
      </p>
      <p className="hero-delta">
        {change === null ? (
          previousTotal === 0 ? 'No spending last month' : ''
        ) : (
          <>
            <span aria-hidden="true">{change > 0 ? '▲' : '▼'}</span> {formatPercent(change)} vs last
            month ({formatMoney(previousTotal)})
          </>
        )}
      </p>
    </div>
  );
}
