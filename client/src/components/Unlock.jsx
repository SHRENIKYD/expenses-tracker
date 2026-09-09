import { useState } from 'react';
import Icon from './Icon.jsx';

// A fresh tab has the session but not the key: the session lives in
// localStorage, the key never does. Nothing can be shown until this is answered,
// because nothing can be read.
export default function Unlock({ email, onUnlock, onUnlockWithKey, onSignOut }) {
  const [password, setPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [byKey, setByKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (byKey) await onUnlockWithKey(recoveryKey);
      else await onUnlock(password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <div className="card signin-card">
        <h1>
          <Icon name="settings" size={22} strokeWidth={2} /> Locked
        </h1>
        <p className="hint">
          Your transactions are encrypted on this device before they are stored, so {email} needs
          to unlock them here.
        </p>

        {error && <p className="error">{error}</p>}

        <form onSubmit={submit}>
          {byKey ? (
            <label>
              Recovery key
              <input
                type="text"
                value={recoveryKey}
                onChange={(event) => setRecoveryKey(event.target.value)}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                autoComplete="off"
                required
                autoFocus
              />
            </label>
          ) : (
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                autoFocus
              />
            </label>
          )}

          <button type="submit" disabled={busy}>
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>

        <p className="hint signin-switch">
          <button
            type="button"
            className="link"
            onClick={() => {
              setByKey((current) => !current);
              setError('');
            }}
          >
            {byKey ? 'Use my password instead' : 'Use my recovery key instead'}
          </button>
        </p>
        <p className="hint signin-switch">
          <button type="button" className="link" onClick={onSignOut}>
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
