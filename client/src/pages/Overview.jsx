import { Link, useOutletContext } from 'react-router-dom';
import Icon, { CATEGORY_ICON } from '../components/Icon.jsx';
import { formatMoney, formatDay, titleCase } from '../format.js';

function StatTile({ icon, tone, label, value, foot }) {
  return (
    <div className="card stat">
      <span className={`stat-icon ${tone}`}>
        <Icon name={icon} size={20} />
      </span>
      <div className="stat-body">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        <span className="stat-foot">{foot}</span>
      </div>
    </div>
  );
}

export default function Overview() {
  const { summary, expenses, loading } = useOutletContext();

  if (!summary) {
    return <p className="empty">{loading ? 'Loading…' : 'Nothing to show yet.'}</p>;
  }

  const { income, total, remaining, overallBudget, budgetUsed, budgetLeft, categories, upcoming } =
    summary;

  const maxCategory = Math.max(...categories.map((row) => row.total), 1);
  const recent = expenses.slice(0, 5);
  const usedPct = budgetUsed === null ? null : Math.round(budgetUsed * 100);

  return (
    <>
      <div className="stat-row">
        <StatTile icon="trendUp" tone="good" label="Income" value={formatMoney(income)} foot="This month" />
        <StatTile icon="trendDown" tone="spend" label="Expenses" value={formatMoney(total)} foot="This month" />
        <StatTile icon="wallet" tone="good" label="Remaining income" value={formatMoney(remaining)} foot="This month" />
        <StatTile
          icon="pie"
          tone="good"
          label="Budget left"
          value={budgetLeft === null ? '—' : formatMoney(budgetLeft)}
          foot={overallBudget > 0 ? `of ${formatMoney(overallBudget)} monthly budget` : 'No budget set'}
        />
      </div>

      <div className="overview-grid">
        <section className="card">
          <h2>Spending by category</h2>
          {categories.length === 0 ? (
            <p className="empty">No spending recorded this month.</p>
          ) : (
            <ul className="cat-rows">
              {categories.slice(0, 6).map((row) => (
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

        <div className="overview-side">
          <section className="card">
            <div className="card-head">
              <h2>Budget status</h2>
              {overallBudget > 0 && (
                <span className="hint">Monthly budget: {formatMoney(overallBudget)}</span>
              )}
            </div>

            {overallBudget > 0 ? (
              <>
                <p className={usedPct > 100 ? 'budget-pct over' : 'budget-pct'}>{usedPct}%</p>
                <div className="meter">
                  <div
                    className={usedPct > 100 ? 'meter-fill over' : 'meter-fill'}
                    style={{ width: `${Math.min(usedPct, 100)}%` }}
                  />
                </div>
                <p className="hint budget-line">
                  {formatMoney(total)} of {formatMoney(overallBudget)} used
                </p>
                <p className={budgetLeft < 0 ? 'notice danger' : 'notice'}>
                  <Icon name="alert" size={16} />
                  <span>
                    {budgetLeft < 0 ? (
                      <>
                        <strong>{formatMoney(Math.abs(budgetLeft))}</strong> over budget this month
                      </>
                    ) : (
                      <>
                        <strong>{formatMoney(budgetLeft)}</strong> available this month
                      </>
                    )}
                  </span>
                </p>
              </>
            ) : (
              <p className="empty">
                No monthly budget yet. <Link to="/settings">Set one in Settings.</Link>
              </p>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Upcoming payment</h2>
              <Link to="/budgets" className="link">
                See all
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <p className="empty">Nothing due for the rest of this month.</p>
            ) : (
              <ul className="upcoming">
                {upcoming.slice(0, 3).map((item) => (
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
        </div>
      </div>

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
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Payment method</th>
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
                    <td data-label="Category">{titleCase(expense.category)}</td>
                    <td data-label="Date">{formatDay(expense.date)}</td>
                    <td data-label="Payment method">
                      {expense.paymentMethod ? titleCase(expense.paymentMethod.replace('_', ' ')) : '—'}
                    </td>
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
        )}
      </section>
    </>
  );
}
