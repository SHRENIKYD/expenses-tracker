import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { SIDEBAR_THEMES } from '../sidebarThemes.js';
import PasswordCard from '../components/PasswordCard.jsx';
import EncryptionCard from '../components/EncryptionCard.jsx';
import { useOutletContext } from 'react-router-dom';
import { formatMoney } from '../format.js';
import { receiptUsage } from '../data/index.js';

export default function SettingsPage() {
  const { settings, session, handlers, onSignOut, sidebarTheme, setSidebarTheme } = useOutletContext();
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
        <h2>
          <Icon name="settings" size={19} strokeWidth={1.9} />
          Your details
        </h2>
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
        <h2>Appearance</h2>
        <fieldset className="sidebar-theme-picker">
          <legend>Sidebar background</legend>
          <p className="hint">Applies instantly and is remembered on this browser.</p>
          <div className="sidebar-theme-options">
            {SIDEBAR_THEMES.map((theme) => (
              <label key={theme.id} className="sidebar-theme-option">
                <input
                  type="radio"
                  name="sidebar-theme"
                  value={theme.id}
                  checked={sidebarTheme === theme.id}
                  onChange={() => setSidebarTheme(theme.id)}
                />
                <span className="sidebar-theme-preview" style={{ backgroundImage: `url("${theme.image}")` }} aria-hidden="true" />
                <span className="sidebar-theme-label">{theme.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <PasswordCard email={session.user.email} />

      <EncryptionCard />

      <section className="card">
        <h2>
          <Icon name="accounts" size={19} strokeWidth={1.9} />
          Account
        </h2>
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
          Receipts live in Supabase Storage, which is capped at 1&nbsp;GB on the free plan. Each
          file is limited to 2&nbsp;MB.
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
