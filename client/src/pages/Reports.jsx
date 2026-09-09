import { useOutletContext } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { ReportsSkeleton } from '../components/Skeleton.jsx';
import { bucketSeries, rollingAverage } from '../series.js';
import KpiTile from '../components/KpiTile.jsx';
import SpendingDonut from '../components/SpendingDonut.jsx';
import DailyChart from '../components/DailyChart.jsx';
import TrendChart from '../components/TrendChart.jsx';
import {
  formatDayFull,
  formatMoney,
  formatMoneyTrim,
  formatMonthLong,
  formatPercent
} from '../format.js';

export default function Reports() {
  const { summary, loading, periodLoading } = useOutletContext();

  if (!summary) {
    return loading || periodLoading ? (
      <ReportsSkeleton />
    ) : (
      <p className="empty">Nothing to show yet.</p>
    );
  }

  const {
    total,
    count,
    change,
    previousTotal,
    previousMonth,
    month,
    projected,
    dailyAverage,
    elapsedDays,
    totalDays,
    daily,
    trend,
    categories,
    range,
    previousRange
  } = summary;

  // A custom window has no month to name, so every label falls back to its dates.
  const periodLabel = month
    ? formatMonthLong(month)
    : `${formatDayFull(range.from)} – ${formatDayFull(range.to)}`;
  const previousLabel = previousRange
    ? `${formatDayFull(previousRange.from)} – ${formatDayFull(previousRange.to)}`
    : formatMonthLong(previousMonth);

  const dailySeries = daily.map((day) => day.total);
  const buckets = bucketSeries(daily, 5);
  // A seven-day trailing mean, slid across the series in one pass.
  const smoothed = rollingAverage(dailySeries, 7);
  const latestAverage = smoothed.length ? smoothed[smoothed.length - 1] : 0;

  return (
    <>
      <div className="kpi-row">
        <KpiTile
          dark
          icon="trendDown"
          label="Spent"
          value={formatMoneyTrim(total)}
          foot={`${count} transaction${count === 1 ? '' : 's'} · ${periodLabel}`}
          series={buckets.map((bucket) => bucket.expenses)}
        />
        <KpiTile
          icon="calendar"
          label="Daily average"
          value={formatMoneyTrim(dailyAverage)}
          foot={`Day ${elapsedDays} of ${totalDays} · 7-day ${formatMoneyTrim(latestAverage)}`}
          series={dailySeries}
        />
        <KpiTile
          icon="target"
          tone="amber"
          label="Projected"
          value={projected === null ? formatMoneyTrim(total) : formatMoneyTrim(projected)}
          foot={projected === null ? 'Period complete' : 'At this pace, by the end of it'}
          series={buckets.map((bucket) => bucket.expenses)}
        />
        <KpiTile
          icon={change !== null && change > 0 ? 'arrowUpRight' : 'arrowDownRight'}
          tone={change !== null && change > 0 ? 'spend' : 'mint'}
          label="Versus the period before"
          value={change === null ? '—' : formatPercent(change)}
          foot={
            previousTotal === 0
              ? 'Nothing recorded then'
              : `${formatMoney(previousTotal)} · ${previousLabel}`
          }
          series={trend.slice(-5).map((row) => row.total)}
        />
      </div>

      <div className="two-col">
        <ErrorBoundary title="By category">
          <section className="card">
            <div className="card-head">
              <h2>
                <Icon name="pie" size={19} strokeWidth={1.9} />
                By category
              </h2>
              <span className="pill-static">{periodLabel}</span>
            </div>
            <SpendingDonut categories={categories} total={total} />
          </section>
        </ErrorBoundary>

        <ErrorBoundary title="Daily spending">
          <section className="card">
            <div className="card-head">
              <h2>
                <Icon name="chart" size={19} strokeWidth={1.9} />
                Daily spending
              </h2>
              <span className="pill-static">{periodLabel}</span>
            </div>
            <DailyChart month={month} daily={daily} />
          </section>
        </ErrorBoundary>
      </div>

      <ErrorBoundary title="Last 12 months">
        <section className="card">
          <div className="card-head">
            <h2>
              <Icon name="bills" size={19} strokeWidth={1.9} />
              Last 12 months
            </h2>
            <span className="pill-static">Expenses</span>
          </div>
          <TrendChart trend={trend} />
        </section>
      </ErrorBoundary>
    </>
  );
}
