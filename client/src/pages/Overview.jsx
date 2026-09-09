import { Link, useOutletContext } from 'react-router-dom';
import Icon, { CATEGORY_ICON } from '../components/Icon.jsx';
import CashFlowChart from '../components/CashFlowChart.jsx';
import SpendingDonut from '../components/SpendingDonut.jsx';
import { formatMoney, formatDay, formatRelativeDay, paymentLabel, titleCase } from '../format.js';

function Kpi({ icon, tone, dark, label, value, foot, delta }) {
  return (
    <div className={dark ? 'card kpi dark' : 'card kpi'}>
      <div className="kpi-top">
        <span className={tone === 'spend' ? 'kpi-icon spend' : 'kpi-icon'}>
          <Icon name={icon} size={19} strokeWidth={1.9} />
        </span>
        {delta && (
          <span className={delta.good ? 'kpi-delta' : 'kpi-delta down'}>
            <Icon name={delta.up ? 'arrowUpRight' : 'arrowDownRight'} size={13} strokeWidth={2.2} />
            {delta.text}
          </span>
        )}
      </div>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-foot">{foot}</span>
    </div>
  );
}

// The strip calls out the category closest to its limit, but only once it is
// worth acting on; anything under 85% is noise on a dashboard.
function pressuredCategory(categories) {
  const withBudget = categories.filter((row) => row.budget > 0 && row.total / row.budget >= 0.85);
  if (withBudget.length === 0) return null;
  return withBudget.sort((a, b) => b.total / b.budget - a.total / a.budget)[0];
}

export default function Overview() {
  const { summary, expenses, loading } = useOutletContext();

  if (!summary) {
    return <p className="empty">{loading ? 'Loading…' : 'Nothing to show yet.'}</p>;
  }

  const {
    income,
    total,
    remaining,
    overallBudget,
    budgetUsed,
    budgetLeft,
    categories,
    upcoming,
    weekly,
    change,
    count
  } = summary;

  const maxCategory = Math.max(...categories.map((row) => row.total), 1);
  const recent = expenses.slice(0, 6);
  const usedPct = budgetUsed === null ? null : Math.round(budgetUsed * 100);
  const savingsRate = income > 0 ? Math.round((remaining / income) * 100) : null;
  const pressured = pressuredCategory(categories);

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
        <Kpi
          dark
          icon="income"
          label="Income"
          value={formatMoney(income)}
          foot="Received this month"
        />
        <Kpi
          icon="trendDown"
          tone="spend"
          label="Expenses"
          value={formatMoney(total)}
          foot={change === null ? `${count} transaction${count === 1 ? '' : 's'}` : 'vs last month'}
          delta={
            change === null
              ? null
              : { up: change > 0, good: change <= 0, text: `${Math.abs(Math.round(change * 100))}%` }
          }
        />
        <Kpi
          icon="savings"
          label="Net savings"
          value={formatMoney(remaining)}
          foot={savingsRate === null ? 'No income recorded' : `${savingsRate}% of income kept`}
        />
        <Kpi
          icon="target"
          label="Budget left"
          value={budgetLeft === null ? '—' : formatMoney(budgetLeft)}
          foot={overallBudget > 0 ? `of ${formatMoney(overallBudget)} budgeted` : 'No budget set'}
        />
      </div>

      <div className="overview-grid">
        <section className="card">
          <div className="card-head">
            <h2>Cash flow</h2>
            <span className="chart-legend">
              <span>
                <span className="dot" style={{ background: 'var(--accent)' }} /> Income
              </span>
              <span>
                <span className="dot" style={{ background: '#cfe4d9' }} /> Expenses
              </span>
            </span>
          </div>
          <CashFlowChart weekly={weekly} />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Spending breakdown</h2>
            <Link to="/reports" className="link">
              Reports
            </Link>
          </div>
          <SpendingDonut categories={categories} total={total} />
          {pressured && (
            <p className="warning-strip">
              <Icon name="alert" size={17} strokeWidth={1.9} />
              <span>
                <strong>{titleCase(pressured.category)}</strong> budget is at{' '}
                {Math.round((pressured.total / pressured.budget) * 100)}% of{' '}
                {formatMoney(pressured.budget)}
              </span>
            </p>
          )}
        </section>
      </div>

      <div className="overview-grid">
        <section className="card">
          <div className="card-head">
            <h2>Recent transactions</h2>
            <Link to="/transactions" className="link">
              View all
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="empty">No transactions yet.</p>
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
                        {paymentLabel(expense.paymentMethod) && ` · ${paymentLabel(expense.paymentMethod)}`}
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
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Date</th>
                      <th>Account</th>
                      <th className="numeric">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((expense) => (
                      <tr key={expense.id}>
                        <td data-label="Description">
                          <span className="with-icon">
                            <span className="cat-icon small">
                              <Icon name={CATEGORY_ICON[expense.category] || 'other'} size={15} />
                            </span>
                            {expense.description}
                          </span>
                        </td>
                        <td data-label="Category">
                          <span className="tag">{titleCase(expense.category)}</span>
                        </td>
                        <td data-label="Date">{formatDay(expense.date)}</td>
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

        <div className="overview-side">
          <section className="card">
            <div className="card-head">
              <h2>Upcoming bills</h2>
              <Link to="/budgets" className="link">
                See all
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <p className="empty">Nothing due for the rest of this month.</p>
            ) : (
              <ul className="upcoming">
                {upcoming.slice(0, 4).map((item) => (
                  <li key={item.id}>
                    <span className="cat-icon">
                      <Icon name={CATEGORY_ICON[item.category] || 'other'} size={18} />
                    </span>
                    <span className="upcoming-main">
                      <span>{item.description}</span>
                      <span className="hint">{formatDay(item.date)}</span>
                    </span>
                    <span className="upcoming-amount">{formatMoney(item.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2>Top categories</h2>
            {categories.length === 0 ? (
              <p className="empty">No spending recorded this month.</p>
            ) : (
              <ul className="cat-rows">
                {categories.slice(0, 5).map((row) => (
                  <li key={row.category}>
                    <span className="cat-icon">
                      <Icon name={CATEGORY_ICON[row.category] || 'other'} size={18} />
                    </span>
                    <span className="cat-name">{titleCase(row.category)}</span>
                    <span className="cat-track">
                      <span
                        className={row.overBudget ? 'cat-fill over' : 'cat-fill'}
                        style={{ width: `${Math.max((row.total / maxCategory) * 100, 2)}%` }}
                      />
                    </span>
                    <span className="cat-amount">
                      {formatMoney(row.total)}
                      {row.overBudget && <span className="over-flag"> ⚠</span>}
                    </span>
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
