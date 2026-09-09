import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { money } from '../dashboard.js';
import { CardsSkeleton } from '../components/Skeleton.jsx';
export default function Accounts() {
  const { accounts, summary, loading, handlers, setFilters } = useOutletContext();
  const [name, setName] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    const result = await handlers.createAccount({ name, openingBalance });
    setBusy(false);
    if (result) {
      setName('');
      setOpeningBalance('0');
    }
  }
  return (
    <>
      <section className="card">
        <h2>Add an account</h2>
        <p className="hint">
          Enter its balance before the transactions you plan to record. Balances reflect your
          records, not a live bank connection.
        </p>
        <form className="portfolio-form" onSubmit={submit}>
          <label>
            Account name
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Savings account"
            />
          </label>
          <label>
            Opening balance (₹)
            <input
              required
              type="number"
              step="0.01"
              min="-9999999999.99"
              max="9999999999.99"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
            />
          </label>
          <button disabled={busy}>{busy ? 'Adding…' : 'Add account'}</button>
        </form>
      </section>
      {loading && !accounts.length && <CardsSkeleton count={2} label="Loading accounts" />}

      <div className="portfolio-grid">
        {accounts.map((account) => (
          <section className="card account-card" key={account.id}>
            <h2>
              <Icon name="accounts" />
              {account.name}
            </h2>
            <strong className="account-balance">{money(account.balance)}</strong>
            <p className="hint">
              Opening balance {money(account.openingBalance)} · {account.transactions} transactions
            </p>
            <div className="button-row">
              <Link className="link" to="/add">
                Add transaction
              </Link>
              <button
                className="link danger"
                disabled={busy || account.transactions > 0}
                title={
                  account.transactions
                    ? 'Unassign existing transactions before deleting'
                    : 'Delete empty account'
                }
                onClick={async () => {
                  if (window.confirm(`Delete “${account.name}”?`)) {
                    setBusy(true);
                    await handlers.removeAccount(account.id);
                    setBusy(false);
                  }
                }}
              >
                Delete account
              </button>
            </div>
          </section>
        ))}
      </div>
      {!accounts.length && !loading && (
        <p className="empty">Add your bank, card, or cash account to track its balance.</p>
      )}
      {summary?.accounts?.length > 0 && <section className="card"><h2>This month by payment method</h2><div className="portfolio-grid">{summary.accounts.map(method => <div key={method.method}><h3>{method.method.replace('_', ' ')}</h3><p>Income {money(method.income)} · Expenses {money(method.expenses)}</p><Link className="link" to="/transactions" onClick={() => setFilters({q:'',category:'',kind:'',from:'',to:'',paymentMethod:method.method === 'unassigned' ? '' : method.method})}>View transactions</Link></div>)}</div></section>}
    </>
  );
}
