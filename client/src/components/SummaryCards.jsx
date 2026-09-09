import { formatMoney, formatMonthLong, formatPercent } from '../format.js';

export default function SummaryCards({ summary }) {
  const { total, count, change, previousTotal, month, projected, dailyAverage, elapsedDays, totalDays } =
    summary;

  return (
    <div className="card">
      <h2>{formatMonthLong(month)}</h2>
      <p className="hero">{formatMoney(total)}</p>
      <p className="hero-sub">
        {count} {count === 1 ? 'expense' : 'expenses'}
        {projected !== null && ` · day ${elapsedDays} of ${totalDays}`}
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

      {projected !== null && (
        <div className="projection">
          <span>
            <span className="projection-label">Averaging</span> {formatMoney(dailyAverage)}/day
          </span>
          <span>
            <span className="projection-label">On this pace</span> {formatMoney(projected)} by month end
          </span>
        </div>
      )}
    </div>
  );
}
