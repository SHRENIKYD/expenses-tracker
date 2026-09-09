import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import PasswordCard from '../components/PasswordCard.jsx';
import EncryptionCard from '../components/EncryptionCard.jsx';
import MessagesCard from '../components/MessagesCard.jsx';
import ResetData from '../components/ResetData.jsx';
import { formatMoney } from '../format.js';
import { receiptUsage, vaultState } from '../data/index.js';

const build = import.meta.env.VITE_APP_VERSION || 'dev';

// Settings as a list rather than a stack of essays.
//
// Five cards of prose meant scrolling past four of them to reach the fifth.
// Each area is a row that says its own state — "27 sealed", "notifications on" —
// and opens where it stands. The one destructive thing is last, in red, behind
// a word that has to be typed.
export default function SettingsPage() {
  const { settings, session, handlers, onSignOut, summary } = useOutletContext();
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState({ displayName: '', monthlyBudget: '' });
  const [saved, setSaved] = useState('');
  const [usage, setUsage] = useState(null);
  const [lock, setLock] = useState(vaultState);

  useEffect(() => {
    setForm({
      displayName: settings.displayName || '',
      monthlyBudget: settings.monthlyBudget ? String(settings.monthlyBudget) : ''
    });
  }, [settings.displayName, settings.monthlyBudget]);

  useEffect(() => {
    receiptUsage().then(setUsage).catch(() => setUsage(null));
    setLock(vaultState());
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

  const count = summary?.count ?? 0;

  const SECTIONS = [
    {
      title: 'You',
      rows: [
        {
          id: 'details',
          icon: 'settings',
          title: 'Your details',
          note: `${settings.displayName || 'No name set'} · ${
            settings.monthlyBudget ? `${formatMoney(settings.monthlyBudget)} a month` : 'no budget'
          }`,
          detail: (
            <form className="form setting-detail" onSubmit={submit}>
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
              <button type="submit">Save</button>
              {saved && <p className="hint">{saved}</p>}
            </form>
          )
        }
      ]
    },
    {
      title: 'Security',
      rows: [
        {
          id: 'password',
          icon: 'settings',
          title: 'Password',
          note: 'Change it, or email yourself a reset link',
          detail: <PasswordCard email={session.user.email} bare />
        },
        {
          id: 'encryption',
          icon: 'target',
          title: 'Encryption',
          note: lock.exists ? 'On — your data is sealed on this device' : 'Off — your data is stored in the clear',
          state: lock.exists ? 'on' : 'off',
          detail: <EncryptionCard bare />
        },
        {
          id: 'messages',
          icon: 'bell',
          title: 'Bank messages',
          note: 'Read alerts and offer them as transactions',
          detail: <MessagesCard bare />
        }
      ]
    },
    {
      title: 'Data',
      rows: [
        {
          id: 'export',
          icon: 'export',
          title: 'Export everything',
          note: 'A CSV of every transaction',
          action: handlers.exportCsv
        },
        {
          id: 'receipts',
          icon: 'camera',
          title: 'Receipts',
          note: usage
            ? `${usage.count} file${usage.count === 1 ? '' : 's'} · ${(usage.bytes / 1024 / 1024).toFixed(2)} MB`
            : '—',
          detail: (
            <p className="hint setting-detail">
              Receipts live in Supabase Storage, encrypted before they are uploaded, and count
              against the free plan's gigabyte. Each file is limited to 2&nbsp;MB.
            </p>
          )
        },
        {
          id: 'reset',
          icon: 'close',
          title: 'Delete all transactions',
          note: `${count} in the selected period · keeps accounts, budgets and goals`,
          danger: true,
          detail: (
            <ResetData count={count} onExport={handlers.exportCsv} onDone={handlers.refresh} />
          )
        }
      ]
    }
  ];

  return (
    <div className="settings-list">
      {SECTIONS.map((section) => (
        <section key={section.title} className="setting-group">
          <h2>{section.title}</h2>
          {section.rows.map((row) => (
            <div key={row.id} className={row.danger ? 'setting-row danger' : 'setting-row'}>
              <button
                type="button"
                className="setting-open"
                aria-expanded={row.detail ? open === row.id : undefined}
                onClick={() => (row.action ? row.action() : setOpen(open === row.id ? null : row.id))}
              >
                <span className="setting-icon">
                  <Icon name={row.icon} size={18} strokeWidth={1.9} />
                </span>
                <span className="setting-text">
                  <span className="setting-title">{row.title}</span>
                  <span className="setting-note">{row.note}</span>
                </span>
                {row.state && <span className={`setting-pill ${row.state}`}>{row.state}</span>}
                {row.detail && (
                  <Icon name={open === row.id ? 'chevronDown' : 'chevronRight'} size={17} />
                )}
              </button>
              {row.detail && open === row.id && row.detail}
            </div>
          ))}
        </section>
      ))}

      <section className="setting-group">
        <h2>Account</h2>
        <div className="setting-row">
          <div className="setting-open static">
            <span className="setting-icon">
              <Icon name="accounts" size={18} strokeWidth={1.9} />
            </span>
            <span className="setting-text">
              <span className="setting-title">{session.user.email}</span>
              <span className="setting-note" title={build}>
                Tessera {build.split('+')[0]}
              </span>
            </span>
          </div>
        </div>
        <div className="setting-row">
          <button type="button" className="setting-open" onClick={onSignOut}>
            <span className="setting-icon">
              <Icon name="logout" size={18} strokeWidth={1.9} />
            </span>
            <span className="setting-text">
              <span className="setting-title">Sign out</span>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
