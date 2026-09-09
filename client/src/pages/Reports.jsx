import { useOutletContext } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import KpiTile from '../components/KpiTile.jsx';
import SpendingDonut from '../components/SpendingDonut.jsx';
import DailyChart from '../components/DailyChart.jsx';
import TrendChart from '../components/TrendChart.jsx';
import { formatMoney, formatMoneyTrim, formatMonthLong, formatPercent } from '../format.js';

export default function Reports() {
  const { summary } = useOutletContext();

  if (!summary) return <p className="empty">Loading…</p>;

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
    weekly,
    daily,
    trend,
    categories
  } = summary;

  const dailySeries = daily.map((day) => day.total);

  return (
    <>
      <div className="kpi-row">
        <KpiTile
          dark
          icon="trendDown"
          label="Spent"
          value={formatMoneyTrim(total)}
          foot={`${count} transaction${count === 1 ? '' : 's'} in ${formatMonthLong(month)}`}
          series={weekly.map((week) => week.expenses)}
        />
        <KpiTile
          icon="calendar"
          label="Daily average"
          value={formatMoneyTrim(dailyAverage)}
          foot={`Day ${elapsedDays} of ${totalDays}`}
          series={dailySeries}
        />
        <KpiTile
          icon="target"
          tone="amber"
          label="Projected"
          value={projected === null ? formatMoneyTrim(total) : formatMoneyTrim(projected)}
          foot={projected === null ? 'Month complete' : 'At this pace, by month end'}
          series={weekly.map((week) => week.expenses)}
        />
        <KpiTile
          icon={change !== null && change > 0 ? 'arrowUpRight' : 'arrowDownRight'}
          tone={change !== null && change > 0 ? 'spend' : 'mint'}
          label="Versus last month"
          value={change === null ? '—' : formatPercent(change)}
          foot={
            previousTotal === 0
              ? 'Nothing recorded last month'
              : `${formatMoney(previousTotal)} in ${formatMonthLong(previousMonth)}`
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
              <span className="pill-static">{formatMonthLong(month)}</span>
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
              <span className="pill-static">{formatMonthLong(month)}</span>
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
