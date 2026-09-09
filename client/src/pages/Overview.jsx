import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import Icon, { CATEGORY_ICON } from '../components/Icon.jsx';
import CashFlowChart from '../components/CashFlowChart.jsx';
import SpendingDonut from '../components/SpendingDonut.jsx';
import GoalCard from '../components/GoalCard.jsx';
import { formatDay, paymentLabel, titleCase, formatMonthLong } from '../format.js';
import { money, budgetAlert } from '../dashboard.js';

function Kpi({ icon, dark, label, value, foot, tone = '' }) {
  return (
    <section className={`card kpi ${dark ? 'dark' : ''}`}>
      <div className="kpi-heading">
        <span className={`kpi-icon ${tone}`}>
          <Icon name={icon} size={22} />
        </span>
        <span className="kpi-label">{label}</span>
      </div>
      <strong className="kpi-value">{value}</strong>
      <span className="kpi-foot">{foot}</span>
    </section>
  );
}

export default function Overview() {
  const {
    summary,
    expenses,
    accounts,
    goals,
    categories: allowedCategories,
    loading,
    month,
    filters,
    setFilters,
    handlers
  } = useOutletContext();
  const [showFilters, setShowFilters] = useState(false);
  if (!summary)
    return (
      <section className="card empty" role="status">
        {loading ? 'Loading your overview…' : 'Could not load your overview. Try refreshing.'}
      </section>
    );
  const { income, total, remaining, overallBudget, budgetLeft, categories, upcoming, weekly } =
    summary;
  const pressured = budgetAlert(categories);
  const recent = expenses
    .filter((row) => row.date.startsWith(month))
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt))
    )
    .slice(0, 5);
  const accountName = (id) => accounts.find((account) => account.id === id)?.name;
  const goal = goals.find((item) => item.saved < item.target) || goals[0];
  return (
    <>
      <div className="kpi-row">
        <Kpi dark icon="trendUp" label="Income" value={money(income)} foot="This month" />
        <Kpi
          icon="trendDown"
          tone="spend"
          label="Expenses"
          value={money(total)}
          foot="This month"
        />
        <Kpi
          icon="savings"
          label="Net savings"
          value={money(remaining)}
          foot="Income minus expenses"
        />
        <Kpi
          icon="pie"
          label="Budget remaining"
          value={budgetLeft === null ? '—' : money(budgetLeft)}
          foot={
            overallBudget > 0
              ? `Of ${money(overallBudget)} budget`
              : 'Set a monthly budget in Settings'
          }
        />
      </div>
      <div className="overview-grid analytics-grid">
        <section className="card cash-card">
          <div className="card-head">
            <h2>
              <Icon name="chart" />
              Cash flow
            </h2>
            <div className="chart-controls">
              <span className="chart-legend">
                <span>
                  <i className="dot" style={{ background: '#14563f' }} />
                  Income
                </span>
                <span>
                  <i className="dot" style={{ background: '#8fc5a1' }} />
                  Expenses
                </span>
              </span>
              <span className="period-label">Weekly</span>
            </div>
          </div>
          <CashFlowChart weekly={weekly} month={month} />
        </section>
        <section className="card spending-card">
          <div className="card-head">
            <h2>
              <Icon name="pie" />
              Spending breakdown
            </h2>
            <span className="period-label">{formatMonthLong(month)}</span>
          </div>
          <SpendingDonut categories={categories} total={total} />
          {pressured && (
            <Link to="/budgets" className="warning-strip">
              <Icon name="alert" />
              <span>
                <strong>
                  {titleCase(pressured.category)} budget is at{' '}
                  {Math.round((pressured.total / pressured.budget) * 100)}%
                </strong>
                <small>
                  {money(Math.abs(pressured.budget - pressured.total))}{' '}
                  {pressured.total > pressured.budget ? 'over budget' : 'remaining this month'}
                </small>
              </span>
              <Icon name="chevronRight" size={16} />
            </Link>
          )}
        </section>
      </div>
      <div className="overview-grid lower-grid">
        <section className="card recent-card">
          <div className="card-head">
            <h2>
              <Icon name="bills" />
              Recent transactions
            </h2>
            <div className="transaction-tools">
              <label className="search-field">
                <Icon name="search" size={17} />
                <input
                  aria-label="Search recent transactions"
                  placeholder="Search transactions…"
                  value={filters.q}
                  onChange={(e) => setFilters((current) => ({ ...current, q: e.target.value }))}
                />
              </label>
              <button
                className="secondary filter-button"
                aria-expanded={showFilters}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Icon name="filter" size={17} />
                Filter
              </button>
            </div>
          </div>
          {showFilters && (
            <div className="inline-filters">
              <label>
                Category
                <select
                  value={filters.category}
                  onChange={(e) =>
                    setFilters((current) => ({
                      ...current,
                      category: e.target.value
                    }))
                  }
                >
                  <option value="">All categories</option>
                  {[...allowedCategories.expense, ...allowedCategories.income]
                    .sort()
                    .map((category) => (
                      <option key={category} value={category}>
                        {titleCase(category)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Type
                <select
                  value={filters.kind}
                  onChange={(e) =>
                    setFilters((current) => ({
                      ...current,
                      kind: e.target.value
                    }))
                  }
                >
                  <option value="">Income & expenses</option>
                  <option value="income">Income</option>
                  <option value="expense">Expenses</option>
                </select>
              </label>
              <button
                className="link"
                onClick={() =>
                  setFilters({
                    q: '',
                    kind: '',
                    category: '',
                    from: '',
                    to: ''
                  })
                }
              >
                Clear filters
              </button>
            </div>
          )}
          {!recent.length ? (
            <p className="empty">
              {loading
                ? 'Loading transactions…'
                : 'No transactions match this month and these filters.'}
            </p>
          ) : (
            <>
              <div className="table-scroll desktop-only">
                <table>
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
                    {recent.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <span className="with-icon">
                            <Icon name={CATEGORY_ICON[row.category]} size={21} />
                            <span className="transaction-name" title={row.description}>
                              {row.description}
                            </span>
                          </span>
                        </td>
                        <td>
                          <span className="tag">
                            <Icon name={CATEGORY_ICON[row.category]} size={16} />
                            {titleCase(row.category)}
                          </span>
                        </td>
                        <td className="date-cell">
                          {formatDay(row.date)} {row.date.slice(0, 4)}
                        </td>
                        <td>
                          {accountName(row.accountId) || paymentLabel(row.paymentMethod) || '—'}
                        </td>
                        <td className="numeric">
                          <span className={row.kind === 'income' ? 'amount-in' : 'amount-out'}>
                            {row.kind === 'income' ? '+' : '−'}
                            {money(row.amount)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="txn-list">
                {recent.map((row) => (
                  <li key={row.id}>
                    <span className="cat-icon">
                      <Icon name={CATEGORY_ICON[row.category]} />
                    </span>
                    <span className="txn-main">
                      <span className="txn-name">{row.description}</span>
                      <span className="hint">
                        {formatDay(row.date)} ·{' '}
                        {accountName(row.accountId) ||
                          paymentLabel(row.paymentMethod) ||
                          titleCase(row.category)}
                      </span>
                    </span>
                    <strong className={row.kind === 'income' ? 'amount-in' : 'amount-out'}>
                      {row.kind === 'income' ? '+' : '−'}
                      {money(row.amount)}
                    </strong>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link className="link all-transactions" to="/transactions">
            View all transactions <Icon name="chevronRight" size={14} />
          </Link>
        </section>
        <div className="overview-side">
          <GoalCard goal={goal} handlers={handlers} compact />
          <section className="card">
            <div className="card-head">
              <h2>
                <Icon name="calendar" />
                Upcoming bills
              </h2>
              <Link className="link" to="/budgets">
                View all <Icon name="chevronRight" size={14} />
              </Link>
            </div>
            {!upcoming.length ? (
              <p className="empty">
                No unpaid recurring bills for this month. <Link to="/budgets">Manage bills</Link>
              </p>
            ) : (
              <ul className="upcoming">
                {upcoming.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <Icon name={CATEGORY_ICON[item.category]} size={23} />
                    <span className="upcoming-main">{item.description}</span>
                    <span className="hint">
                      {money(item.amount)} · {formatDay(item.date)}
                    </span>
                    <Link to="/budgets" aria-label={`Manage ${item.description}`}>
                      <Icon name="chevronRight" size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
