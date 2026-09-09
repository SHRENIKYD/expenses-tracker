import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import Icon, { CATEGORY_ICON } from '../components/Icon.jsx';
import CashFlowChart from '../components/CashFlowChart.jsx';
import SpendingDonut from '../components/SpendingDonut.jsx';
import KpiTile from '../components/KpiTile.jsx';
import MessageSuggestions from '../components/MessageSuggestions.jsx';
import GoalCard from '../components/GoalCard.jsx';
import UpcomingBills from '../components/UpcomingBills.jsx';
import useDebouncedValue from '../useDebouncedValue.js';
import { bucketSeries, buildPrefix, heaviestWindow, rangeSum } from '../series.js';
import { OverviewSkeleton } from '../components/Skeleton.jsx';
import {
  currentMonth,
  formatDayFull,
  formatMonth,
  formatMoney,
  formatMoneyTrim,
  formatRelativeDay,
  paymentLabel,
  titleCase,
  todayIso
} from '../format.js';

const shortMonth = (month) => formatMonth(month).split(' ')[0];

// The strip calls out the category closest to its limit, but only once it is
// worth acting on; anything under 85% is noise on a dashboard.
function pressuredCategory(categories) {
  const withBudget = categories.filter((row) => row.budget > 0 && row.total / row.budget >= 0.85);
  if (withBudget.length === 0) return null;
  return withBudget.sort((a, b) => b.total / b.budget - a.total / a.budget)[0];
}

// Buckets come from the daily series through its prefix sums, so a month, a
// fortnight or a year all bucket the same way and cost the same to redraw.
function bucketedSeries(daily, count) {
  return bucketSeries(daily, count).map((bucket) => ({
    index: bucket.index,
    label: bucket.days === 1 ? shortDay(bucket.from) : `${shortDay(bucket.from)}`,
    range: bucket.days === 1 ? '' : `to ${shortDay(bucket.to)}`,
    income: bucket.income,
    expenses: bucket.expenses
  }));
}

const shortDay = (date) => `${Number(date.slice(8))} ${shortMonth(date.slice(0, 7))}`;

function dailySeries(daily) {
  return daily.map((day, index) => ({
    index: index + 1,
    label: String(Number(day.date.slice(8, 10))),
    range: index === 0 || index === daily.length - 1 ? shortMonth(day.date.slice(0, 7)) : '',
    income: day.income,
    expenses: day.total
  }));
}

// What was left of the budget at the end of each bucket, read straight off the
// running total rather than re-summing the days under each one.
function budgetRunway(buckets, overallBudget) {
  if (!(overallBudget > 0)) return [];
  let spent = 0;
  return buckets.map((bucket) => {
    spent += bucket.expenses;
    return Math.max(overallBudget - spent, 0);
  });
}

export default function Overview() {
  const { summary, expenses, accounts, goals, loading, periodLoading, handlers } =
    useOutletContext();
  const [period, setPeriod] = useState('buckets');
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search, 200);

  const recent = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? expenses.filter(
          (expense) =>
            expense.description.toLowerCase().includes(needle) ||
            expense.category.toLowerCase().includes(needle)
        )
      : expenses;
    // The list arrives already scoped to the selected range, so it only needs
    // ordering and trimming here.
    return [...matches].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [expenses, query]);

  if (!summary) {
    return loading || periodLoading ? (
      <OverviewSkeleton />
    ) : (
      <p className="empty">Nothing to show yet.</p>
    );
  }

  const {
    income,
    total,
    remaining,
    overallBudget,
    budgetLeft,
    budgetUsed,
    categories,
    upcoming,
    daily,
    range,
    month
  } = summary;

  const isThisMonth = Boolean(month) && month === currentMonth();
  const periodLabel = month
    ? formatMonth(month)
    : `${formatDayFull(range.from)} – ${formatDayFull(range.to)}`;
  const footLabel = isThisMonth ? 'This month' : periodLabel;

  const usedPct = budgetUsed === null ? null : Math.round(budgetUsed * 100);
  const savingsRate = income > 0 ? Math.round((remaining / income) * 100) : null;
  const pressured = pressuredCategory(categories);

  // One pass over the days feeds the chart, the tile sparklines and the
  // heaviest-week callout; each of those then reads sub-ranges in constant time.
  // A short range reads best day by day; a longer one is grouped into roughly
  // weekly columns so the chart never turns into a picket fence.
  const bucketCount = daily.length <= 14 ? daily.length : Math.min(6, Math.ceil(daily.length / 7));
  const buckets = bucketSeries(daily, bucketCount);
  const series = period === 'buckets' ? bucketedSeries(daily, buckets.length) : dailySeries(daily);
  const heaviest = daily.length >= 7 ? heaviestWindow(daily, 7) : null;
  const spendPrefix = buildPrefix(daily.map((day) => day.total));
  // "The last seven days" means the seven up to today, not the last seven of a
  // month that still has three weeks of empty future in it.
  const today = todayIso();
  const future = daily.findIndex((day) => day.date > today);
  const upToNow = future === -1 ? daily.length : future;
  const lastWeek = rangeSum(spendPrefix, Math.max(0, upToNow - 7), upToNow);
  const topGoal = goals[0];

  return (
    <>
      <MessageSuggestions onAdd={handlers.create} categories={categories} />

      <section className="card hero-card">
        <span className="hero-label">Remaining income</span>
        <p className="hero-amount">{formatMoney(remaining)}</p>
        <div className="hero-split">
          <span>
            <span className="hero-key">Income</span>
            <span className="hero-val">{formatMoney(income)}</span>
          </span>
          <span>
            <span className="hero-key">Expenses</span>
            <span className="hero-val">{formatMoney(total)}</span>
          </span>
        </div>
      </section>

      {overallBudget > 0 && (
        <Link to="/budgets" className="card budget-summary">
          <div className="card-head">
            <h2>Monthly budget</h2>
            <Icon name="chevronRight" size={17} />
          </div>
          <p className="budget-figures">
            {formatMoney(total)} <span className="muted">/ {formatMoney(overallBudget)}</span>
          </p>
          <div className="budget-meter-row">
            <div className="meter">
              <div
                className={usedPct > 100 ? 'meter-fill over' : 'meter-fill'}
                style={{ width: `${Math.min(usedPct, 100)}%` }}
              />
            </div>
            <span className="budget-pct-small">{usedPct}%</span>
          </div>
          <p className="hint">
            {budgetLeft >= 0
              ? `${formatMoney(budgetLeft)} left to spend`
              : `${formatMoney(Math.abs(budgetLeft))} over budget`}
          </p>
        </Link>
      )}

      <div className="kpi-row">
        <KpiTile
          dark
          icon="trendUp"
          label="Income"
          value={formatMoneyTrim(income)}
          foot={footLabel}
          series={buckets.map((bucket) => bucket.income)}
        />
        <KpiTile
          icon="trendDown"
          tone="spend"
          label="Expenses"
          value={formatMoneyTrim(total)}
          foot={footLabel}
          series={buckets.map((bucket) => bucket.expenses)}
        />
        <KpiTile
          icon="savings"
          label="Net savings"
          value={formatMoneyTrim(remaining)}
          foot={savingsRate === null ? 'Income minus expenses' : `${savingsRate}% of income kept`}
          series={buckets.map((bucket) => Math.max(bucket.income - bucket.expenses, 0))}
        />
        <KpiTile
          icon="pie"
          tone="amber"
          label="Budget remaining"
          value={budgetLeft === null ? '—' : formatMoneyTrim(budgetLeft)}
          foot={
            overallBudget > 0
              ? `Of ${formatMoneyTrim(overallBudget)} budget`
              : month
                ? 'No budget set'
                : 'Budgets are monthly'
          }
          series={budgetRunway(buckets, overallBudget)}
        />
      </div>

      <div className="overview-grid">
        <div className="overview-main">
          <section className="card">
            <div className="card-head">
              <h2>
                <Icon name="chart" size={19} strokeWidth={1.9} />
                Cash flow
              </h2>
              <div className="card-tools">
                <span className="chart-legend">
                  <span>
                    <span className="dot" style={{ background: 'var(--accent)' }} /> Income
                  </span>
                  <span>
                    <span className="dot" style={{ background: 'var(--bar-light)' }} /> Expenses
                  </span>
                </span>
                <select
                  className="pill-select"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  aria-label="Cash flow period"
                >
                  <option value="buckets">Grouped</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
            </div>
            <CashFlowChart
              series={series}
              monthLabel={periodLabel}
              progress={daily.length ? upToNow / daily.length : null}
            />
            {heaviest && heaviest.total > 0 && (
              <p className="chart-foot muted">
                Heaviest seven days {formatDayFull(heaviest.from)} – {formatDayFull(heaviest.to)} ·{' '}
                {formatMoney(heaviest.total)}
                {upToNow > 0 && <> · last seven to date {formatMoney(lastWeek)}</>}
              </p>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>
                <Icon name="list" size={19} strokeWidth={1.9} />
                Recent transactions
              </h2>
              <div className="card-tools">
                <label className="card-search">
                  <Icon name="search" size={16} strokeWidth={1.9} />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search transactions…"
                    aria-label="Search recent transactions"
                  />
                </label>
                <Link to="/transactions" className="pill-link">
                  <Icon name="filter" size={15} strokeWidth={1.9} /> Filter
                </Link>
              </div>
            </div>

            {recent.length === 0 ? (
              <p className="empty">{query ? `Nothing matches “${query}”.` : 'No transactions yet.'}</p>
            ) : (
              <>
                <ul className="txn-list">
                  {recent.map((expense) => (
                    <li key={expense.id}>
                      <span className="cat-icon">
                        <Icon name={CATEGORY_ICON[expense.category] || 'other'} size={18} />
                      </span>
                      <span className="txn-main">
                        <span className="txn-name">{expense.description}</span>
                        <span className="hint">
                          {formatRelativeDay(expense.date)}
                          {paymentLabel(expense.paymentMethod) &&
                            ` · ${paymentLabel(expense.paymentMethod)}`}
                        </span>
                      </span>
                      <span className={expense.kind === 'income' ? 'amount-in' : 'amount-out'}>
                        {expense.kind === 'income' ? '+' : '−'}
                        {formatMoney(expense.amount)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="table-scroll desktop-only">
                  <table className="txn-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Date</th>
                        <th>Account</th>
                        <th className="numeric">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((expense) => (
                        <tr key={expense.id}>
                          <td data-label="Name">
                            <span className="with-icon">
                              <Icon
                                name={CATEGORY_ICON[expense.category] || 'other'}
                                size={19}
                                strokeWidth={1.8}
                              />
                              {expense.description}
                            </span>
                          </td>
                          <td data-label="Category">
                            <span className="tag">
                              <Icon
                                name={CATEGORY_ICON[expense.category] || 'other'}
                                size={13}
                                strokeWidth={2}
                              />
                              {titleCase(expense.category)}
                            </span>
                          </td>
                          <td data-label="Date">{formatDayFull(expense.date)}</td>
                          <td data-label="Account">{accounts.find(account => account.id === expense.accountId)?.name || paymentLabel(expense.paymentMethod) || '—'}</td>
                          <td className="numeric" data-label="Amount">
                            <span className={expense.kind === 'income' ? 'amount-in' : 'amount-out'}>
                              {expense.kind === 'income' ? '+' : '−'}
                              {formatMoney(expense.amount)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="overview-side">
          <section className="card">
            <div className="card-head">
              <h2>
                <Icon name="pie" size={19} strokeWidth={1.9} />
                Spending breakdown
              </h2>
              <span className="pill-static">
                {isThisMonth ? 'This month' : periodLabel}
              </span>
            </div>
            <SpendingDonut categories={categories} total={total} />
            {pressured && (
              <Link to="/budgets" className="warning-strip">
                <Icon name="alert" size={18} strokeWidth={1.9} />
                <span className="warning-body">
                  <strong>
                    {titleCase(pressured.category)} budget is at{' '}
                    {Math.round((pressured.total / pressured.budget) * 100)}%
                  </strong>
                  <span>
                    {pressured.budget - pressured.total >= 0
                      ? `${formatMoney(pressured.budget - pressured.total)} remaining this month`
                      : `${formatMoney(pressured.total - pressured.budget)} over this month`}
                  </span>
                </span>
                <Icon name="chevronRight" size={16} strokeWidth={2} />
              </Link>
            )}
          </section>

          <GoalCard goal={topGoal} handlers={handlers} compact />

          <UpcomingBills upcoming={upcoming} />
        </div>
      </div>
    </>
  );
}
