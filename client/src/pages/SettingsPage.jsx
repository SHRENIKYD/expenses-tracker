import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../format.js';
import { receiptUsage } from '../api.js';

export default function SettingsPage() {
  const { settings, session, handlers, onSignOut } = useOutletContext();
  const [form, setForm] = useState({ displayName: '', monthlyBudget: '' });
  const [saved, setSaved] = useState('');
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    setForm({
      displayName: settings.displayName || '',
      monthlyBudget: settings.monthlyBudget ? String(settings.monthlyBudget) : ''
    });
  }, [settings.displayName, settings.monthlyBudget]);

  useEffect(() => {
    receiptUsage().then(setUsage).catch(() => setUsage(null));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setSaved('');
    const result = await handlers.saveSettings({
      displayName: form.displayName,
      monthlyBudget: form.monthlyBudget === '' ? 0 : Number(form.monthlyBudget)
    });
    if (result) setSaved('Saved');
  }

  return (
    <div className="two-col">
      <section className="card">
        <h2>Your details</h2>
        <form className="form" onSubmit={submit}>
          <label>
            Display name
            <input
              type="text"
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              placeholder="Shrenik"
            />
          </label>

          <label>
            Monthly budget (₹)
            <input
              type="number"
              min="0"
              step="100"
              value={form.monthlyBudget}
              onChange={(event) => setForm({ ...form, monthlyBudget: event.target.value })}
              placeholder="30000"
            />
            <span className="hint">Leave blank to turn the budget card off.</span>
          </label>

          <button type="submit">Save settings</button>
          {saved && <p className="hint">{saved}</p>}
        </form>
      </section>

      <section className="card">
        <h2>Account</h2>
        <dl className="detail-list">
          <div>
            <dt>Signed in as</dt>
            <dd>{session.user.email}</dd>
          </div>
          <div>
            <dt>Receipts stored</dt>
            <dd>
              {usage
                ? `${usage.count} file${usage.count === 1 ? '' : 's'} · ${(usage.bytes / 1024 / 1024).toFixed(2)} MB`
                : '—'}
            </dd>
          </div>
        </dl>
        <p className="hint">
          Receipts live in the database, which is capped at 1&nbsp;GB on the free plan. Each file is
          limited to 2&nbsp;MB.
        </p>

        <div className="button-row">
          <button type="button" className="secondary" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
