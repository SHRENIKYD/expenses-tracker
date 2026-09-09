import { useState } from 'react';
import RecoveryKey from './RecoveryKey.jsx';
import { requestPasswordReset } from '../data/index.js';

export default function SignIn({ onAuthenticated, onSubmit }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isRegister = mode === 'register';
  const isRecover = mode === 'recover';
  const [sent, setSent] = useState('');
  // Registration makes the encryption key and hands back the one way back in if
  // the password is ever forgotten. The account is not usable until it is seen.
  const [recoveryKey, setRecoveryKey] = useState(null);
  const [pending, setPending] = useState(null);
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isRecover) {
        await requestPasswordReset(form.email);
        setSent(`A reset link is on its way to ${form.email}.`);
        return;
      }

      const payload = isRegister
        ? { email: form.email, password: form.password, displayName: form.displayName }
        : { email: form.email, password: form.password };
      const result = await onSubmit(mode, payload);
      if (isRegister && result.recoveryKey) {
        setRecoveryKey(result.recoveryKey);
        setPending(result);
        return;
      }
      onAuthenticated(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (recoveryKey) {
    return (
      <div className="signin">
        <div className="card signin-card">
          <h1>Save your recovery key</h1>
          <RecoveryKey
            value={recoveryKey}
            note="Your transactions are encrypted before they are stored, so nobody but you can read them — not even from the database. This key is the only way in if you forget your password. It is shown once."
            onDone={() => onAuthenticated(pending)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="signin">
      <div className="card signin-card">
        <h1>Expenses Tracker</h1>
        <p className="hint">
          {isRegister && 'Create an account to start tracking.'}
          {isRecover && 'Give your email address and a reset link will be sent to it.'}
          {!isRegister && !isRecover && 'Sign in to see your expenses.'}
        </p>

        {error && <p className="error">{error}</p>}
        {sent && <p className="hint">{sent}</p>}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <label>
              Name
              <input
                type="text"
                value={form.displayName}
                onChange={update('displayName')}
                autoComplete="name"
                placeholder="Shrenik"
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={update('email')}
              autoComplete="email"
              required
            />
          </label>

          {/* The reset link sets the new password, so there is nothing to type. */}
          {!isRecover && (
            <label>
              {isRecover ? 'New password' : 'Password'}
              <input
                type="password"
                value={form.password}
                onChange={update('password')}
                autoComplete={isRegister || isRecover ? 'new-password' : 'current-password'}
                minLength={isRegister || isRecover ? 8 : undefined}
                required
              />
              {(isRegister || isRecover) && <span className="hint">At least 8 characters.</span>}
            </label>
          )}

          <button type="submit" disabled={busy}>
            {busy
              ? 'Please wait…'
              : isRegister
                ? 'Create account'
                : isRecover
                  ? 'Email me a reset link'
                  : 'Sign in'}
          </button>
        </form>

        <p className="hint signin-switch">
          {isRecover ? (
            <>
              Remembered it?{' '}
              <button
                type="button"
                className="link"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              {isRegister ? 'Already have an account?' : 'No account yet?'}{' '}
              <button
                type="button"
                className="link"
                onClick={() => {
                  setMode(isRegister ? 'login' : 'register');
                  setError('');
                }}
              >
                {isRegister ? 'Sign in' : 'Create one'}
              </button>
            </>
          )}
        </p>

        {!isRegister && !isRecover && (
          <p className="hint signin-switch">
            <button
              type="button"
              className="link"
              onClick={() => {
                setMode('recover');
                setError('');
              }}
            >
              Forgotten your password?
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
