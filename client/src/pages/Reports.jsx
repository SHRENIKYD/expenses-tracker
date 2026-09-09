import { useOutletContext } from 'react-router-dom';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import SummaryCards from '../components/SummaryCards.jsx';
import CategoryChart from '../components/CategoryChart.jsx';
import DailyChart from '../components/DailyChart.jsx';
import TrendChart from '../components/TrendChart.jsx';

export default function Reports() {
  const { summary } = useOutletContext();

  if (!summary) return <p className="empty">Loading…</p>;

  return (
    <>
      <SummaryCards summary={summary} />

      <div className="two-col">
        <ErrorBoundary title="By category">
          <section className="card">
            <h2>By category</h2>
            <CategoryChart categories={summary.categories} />
          </section>
        </ErrorBoundary>

        <ErrorBoundary title="Daily spending">
          <section className="card">
            <h2>Daily spending</h2>
            <DailyChart month={summary.month} daily={summary.daily} />
          </section>
        </ErrorBoundary>
      </div>

      <ErrorBoundary title="Last 12 months">
        <section className="card">
          <h2>Last 12 months</h2>
          <TrendChart trend={summary.trend} />
        </section>
      </ErrorBoundary>
    </>
  );
}
