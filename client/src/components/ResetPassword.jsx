import { useEffect, useState } from 'react';
import BrandMark from './BrandMark.jsx';
import { completeRecovery, recoveryDetails } from '../data/index.js';

// Where the emailed reset link lands. The link has signed this tab in for one
// thing: choosing a new password. The forgotten one was also what opened the
// data key, so an encrypted account gives its recovery key here, once, and the
// new password opens everything from then on.
export default function ResetPassword({ onDone, onCancel }) {
  const [details, setDetails] = useState(null);
  const [password, setPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    recoveryDetails()
      .then(setDetails)
      .catch((err) => setDetails({ valid: false, needsKey: false, error: err.message }));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(await completeRecovery({ newPassword: password, recoveryKey }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (details && !details.valid) {
    return (
      <div className="signin">
        <div className="signin-card">
          <BrandMark size={40} />
          <h1>Link expired</h1>
          <p className="hint">
            {details.error || 'This reset link has expired or has already been used.'} Ask for a
            new one from the sign-in page.
          </p>
          <button type="button" onClick={onCancel}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="signin">
      <div className="signin-card">
        <BrandMark size={40} />
        <h1>Set a new password</h1>
        <p className="hint">
          {details?.email ? `For ${details.email}. ` : ''}
          {details?.needsKey
            ? 'Your transactions are encrypted with your old password, so your recovery key opens them this once. The new password opens them from then on.'
            : 'Choose the password you will sign in with from now on.'}
        </p>

        {error && <p className="error">{error}</p>}

        <form onSubmit={submit}>
          <label>
            New password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              autoFocus
            />
            <span className="hint">At least 8 characters.</span>
          </label>

          {details?.needsKey && (
            <label>
              Recovery key
              <input
                type="text"
                value={recoveryKey}
                onChange={(event) => setRecoveryKey(event.target.value)}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                autoComplete="off"
                spellCheck={false}
                required
              />
              <span className="hint">The key you were shown when the account was made.</span>
            </label>
          )}

          <button type="submit" disabled={busy || !details}>
            {busy ? 'Please wait…' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  );
}
