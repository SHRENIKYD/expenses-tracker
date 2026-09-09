import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import Icon, { CATEGORY_ICON } from '../components/Icon.jsx';
import CashFlowChart from '../components/CashFlowChart.jsx';
import SpendingDonut from '../components/SpendingDonut.jsx';
import KpiTile from '../components/KpiTile.jsx';
import GoalRow from '../components/GoalRow.jsx';
import UpcomingBills from '../components/UpcomingBills.jsx';
import useDebouncedValue from '../useDebouncedValue.js';
import {
  currentMonth,
  formatDayFull,
  formatMonth,
  formatMoney,
  formatMoneyTrim,
  formatRelativeDay,
  paymentLabel,
  titleCase
} from '../format.js';

const shortMonth = (month) => formatMonth(month).split(' ')[0];

// The strip calls out the category closest to its limit, but only once it is
// worth acting on; anything under 85% is noise on a dashboard.
function pressuredCategory(categories) {
  const withBudget = categories.filter((row) => row.budget > 0 && row.total / row.budget >= 0.85);
  if (withBudget.length === 0) return null;
  return withBudget.sort((a, b) => b.total / b.budget - a.total / a.budget)[0];
}

function weeklySeries(weekly, month) {
  const label = shortMonth(month);
  return weekly.map((week) => ({
    index: week.week,
    label: week.label,
    range: `${week.from}–${week.to} ${label}`,
    income: week.income,
    expenses: week.expenses
  }));
}

function dailySeries(daily, month) {
  const label = shortMonth(month);
  return daily.map((day, index) => ({
    index: index + 1,
    label: String(Number(day.date.slice(8, 10))),
    range: index === 0 || index === daily.length - 1 ? label : '',
    income: day.income,
    expenses: day.total
  }));
}

// What was left of the monthly budget at the end of each week.
function budgetRunway(weekly, overallBudget) {
  if (!(overallBudget > 0)) return [];
  let spent = 0;
  return weekly.map((week) => {
    spent += week.expenses;
    return Math.max(overallBudget - spent, 0);
  });
}

export default function Overview() {
  const { summary, expenses, goals, loading, month, handlers } = useOutletContext();
  const [period, setPeriod] = useState('weekly');
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
    return matches.slice(0, 5);
  }, [expenses, query]);

  if (!summary) {
    return <p className="empty">{loading ? 'Loading…' : 'Nothing to show yet.'}</p>;
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
    weekly,
    daily
  } = summary;

  const usedPct = budgetUsed === null ? null : Math.round(budgetUsed * 100);
  const savingsRate = income > 0 ? Math.round((remaining / income) * 100) : null;
  const pressured = pressuredCategory(categories);
  const series = period === 'weekly' ? weeklySeries(weekly, month) : dailySeries(daily, month);
  const topGoal = goals[0];

  return (
    <>
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
          foot="This month"
          series={weekly.map((week) => week.income)}
        />
        <KpiTile
          icon="trendDown"
          tone="spend"
          label="Expenses"
          value={formatMoneyTrim(total)}
          foot="This month"
          series={weekly.map((week) => week.expenses)}
        />
        <KpiTile
          icon="savings"
          label="Net savings"
          value={formatMoneyTrim(remaining)}
          foot={savingsRate === null ? 'Income minus expenses' : `${savingsRate}% of income kept`}
          series={weekly.map((week) => Math.max(week.income - week.expenses, 0))}
        />
        <KpiTile
          icon="pie"
          tone="amber"
          label="Budget remaining"
          value={budgetLeft === null ? '—' : formatMoneyTrim(budgetLeft)}
          foot={overallBudget > 0 ? `Of ${formatMoneyTrim(overallBudget)} budget` : 'No budget set'}
          series={budgetRunway(weekly, overallBudget)}
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
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
            </div>
            <CashFlowChart series={series} monthLabel={formatMonth(month)} />
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
                          <td data-label="Account">{paymentLabel(expense.paymentMethod) || '—'}</td>
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
                {month === currentMonth() ? 'This month' : formatMonth(month)}
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

          <section className="card">
            <div className="card-head">
              <h2>
                <Icon name="target" size={19} strokeWidth={1.9} />
                Savings goal
              </h2>
              <Link to="/goals" className="link see-all">
                View all <Icon name="chevronRight" size={15} strokeWidth={2.1} />
              </Link>
            </div>

            {topGoal ? (
              <ul className="goal-list">
                <GoalRow goal={topGoal} onContribute={handlers.contribute} />
              </ul>
            ) : (
              <p className="empty">
                No goal yet. <Link to="/goals">Set one up.</Link>
              </p>
            )}
          </section>

          <UpcomingBills upcoming={upcoming} />
        </div>
      </div>
    </>
  );
}
