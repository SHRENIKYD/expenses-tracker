import { Link, useOutletContext } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { formatMoney, formatMonth, paymentLabel } from '../format.js';

const METHOD_ICON = {
  upi: 'swap',
  card: 'accounts',
  cash: 'wallet',
  bank_transfer: 'briefcase',
  unassigned: 'other'
};

export default function Accounts() {
  const { summary, month, loading, setFilters } = useOutletContext();

  if (!summary) {
    return <p className="empty">{loading ? 'Loading…' : 'Nothing to show yet.'}</p>;
  }

  const { accounts } = summary;

  if (accounts.length === 0) {
    return <p className="empty">No transactions recorded in {formatMonth(month)}.</p>;
  }

  return (
    <div className="account-grid">
      {accounts.map((account) => {
        const label =
          account.method === 'unassigned' ? 'No method recorded' : paymentLabel(account.method);
        return (
          <section className="card account-card" key={account.method}>
            <div className="account-head">
              <span className="kpi-icon mint">
                <Icon name={METHOD_ICON[account.method] || 'other'} size={19} strokeWidth={1.9} />
              </span>
              <div>
                <h2>{label}</h2>
                <p className="hint">
                  {account.count} transaction{account.count === 1 ? '' : 's'} in{' '}
                  {formatMonth(month)}
                </p>
              </div>
            </div>

            <dl className="account-figures">
              <div>
                <dt>Money in</dt>
                <dd className="amount-in">{formatMoney(account.income)}</dd>
              </div>
              <div>
                <dt>Money out</dt>
                <dd className="amount-out">{formatMoney(account.expenses)}</dd>
              </div>
              <div>
                <dt>Net</dt>
                <dd>{formatMoney(account.income - account.expenses)}</dd>
              </div>
            </dl>

            {account.method !== 'unassigned' && (
              <Link
                to="/transactions"
                className="link see-all"
                onClick={() =>
                  setFilters((current) => ({ ...current, paymentMethod: account.method }))
                }
              >
                See transactions <Icon name="chevronRight" size={15} strokeWidth={2.1} />
              </Link>
            )}
          </section>
        );
      })}
    </div>
  );
}
