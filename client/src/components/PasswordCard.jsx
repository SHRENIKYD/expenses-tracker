import { useState } from 'react';
import Icon from './Icon.jsx';
import { changePassword, requestPasswordReset } from '../data/index.js';

export default function PasswordCard({ email }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendResetLink() {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await requestPasswordReset(email);
      setStatus(`A reset link is on its way to ${email}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await changePassword(form.currentPassword, form.newPassword);
      setForm({ currentPassword: '', newPassword: '' });
      setStatus('Password changed. Every other device has been signed out.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>
        <Icon name="settings" size={19} strokeWidth={1.9} />
        Password
      </h2>

      <form className="form" onSubmit={submit}>
        <label>
          Current password
          <input
            type="password"
            value={form.currentPassword}
            onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
            autoComplete="current-password"
            required
          />
        </label>

        <label>
          New password
          <input
            type="password"
            value={form.newPassword}
            onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <span className="hint">At least 8 characters.</span>
        </label>

        <button type="submit" disabled={busy}>
          Change password
        </button>
        {status && <p className="hint">{status}</p>}
      </form>

      <div className="recovery-block">
        <h3>Forgotten it?</h3>
        <p className="hint">A reset link is emailed to you, so there are no codes to keep safe.</p>
        <button type="button" className="secondary" onClick={sendResetLink} disabled={busy}>
          Email me a reset link
        </button>
      </div>

      {error && <p className="error">{error}</p>}
    </section>
  );
}
