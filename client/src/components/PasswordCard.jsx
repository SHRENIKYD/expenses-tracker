import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import RecoveryCodes from './RecoveryCodes.jsx';
import {
  backend,
  changePassword,
  recoveryCodeCount,
  regenerateRecoveryCodes,
  requestPasswordReset
} from '../data/index.js';

export default function PasswordCard({ email }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [count, setCount] = useState(null);
  const [codes, setCodes] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [codePassword, setCodePassword] = useState('');

  // Recovery codes belong to the API's own authentication. Supabase resets a
  // password by emailing a link instead, so the card offers that there rather
  // than asking for codes that do not exist.
  const hasCodes = backend !== 'supabase';

  useEffect(() => {
    if (!hasCodes) return;
    recoveryCodeCount().then(setCount).catch(() => setCount(null));
  }, [hasCodes]);

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

  async function regenerate(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await regenerateRecoveryCodes(codePassword);
      setCodes(result.recoveryCodes);
      setCount({ unused: result.recoveryCodes.length, total: result.recoveryCodes.length });
      setConfirming(false);
      setCodePassword('');
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

      {hasCodes ? (
        <div className="recovery-block">
          <h3>Recovery codes</h3>
          <p className="hint">
            {count === null
              ? 'Recovery codes let you back in if you forget your password.'
              : count.unused === 0
                ? 'No unused codes left. Generate a set and keep them somewhere safe.'
                : `${count.unused} unused code${count.unused === 1 ? '' : 's'} left.`}
          </p>

          {codes ? (
            <RecoveryCodes codes={codes} note="Your new codes. The old ones no longer work." />
          ) : confirming ? (
            <form className="goal-add" onSubmit={regenerate}>
              <input
                type="password"
                value={codePassword}
                onChange={(event) => setCodePassword(event.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                aria-label="Password"
                required
                autoFocus
              />
              <button type="submit" className="mint" disabled={busy}>
                Generate
              </button>
              <button type="button" className="link" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button type="button" className="secondary" onClick={() => setConfirming(true)}>
              Generate new codes
            </button>
          )}
        </div>
      ) : (
        <div className="recovery-block">
          <h3>Forgotten it?</h3>
          <p className="hint">
            A reset link is emailed to you, so there are no codes to keep safe.
          </p>
          <button type="button" className="secondary" onClick={sendResetLink} disabled={busy}>
            Email me a reset link
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  );
}
