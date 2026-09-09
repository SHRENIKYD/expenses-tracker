import { useState } from 'react';
import RecoveryCodes from './RecoveryCodes.jsx';

export default function SignIn({ onAuthenticated, onSubmit }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', displayName: '', code: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Registration hands back recovery codes once; the account is not usable
  // until they have been seen and acknowledged.
  const [codes, setCodes] = useState(null);
  const [pending, setPending] = useState(null);

  const isRegister = mode === 'register';
  const isRecover = mode === 'recover';
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (isRecover) {
        const result = await onSubmit('recover', {
          email: form.email,
          code: form.code,
          newPassword: form.password
        });
        onAuthenticated(result);
        return;
      }

      const payload = isRegister
        ? { email: form.email, password: form.password, displayName: form.displayName }
        : { email: form.email, password: form.password };
      const result = await onSubmit(mode, payload);

      if (isRegister && result.recoveryCodes) {
        setCodes(result.recoveryCodes);
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

  if (codes) {
    return (
      <div className="signin">
        <div className="card signin-card">
          <h1>Save your recovery codes</h1>
          <RecoveryCodes
            codes={codes}
            note="These are the only way back in if you forget your password. They are shown once."
          />
          <button type="button" onClick={() => onAuthenticated(pending)}>
            I have saved them
          </button>
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
          {isRecover && 'Enter one of the recovery codes you saved when you signed up.'}
          {!isRegister && !isRecover && 'Sign in to see your expenses.'}
        </p>

        {error && <p className="error">{error}</p>}

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

          {isRecover && (
            <label>
              Recovery code
              <input
                type="text"
                value={form.code}
                onChange={update('code')}
                placeholder="ABCD-EFGH-JKLM"
                required
              />
            </label>
          )}

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

          <button type="submit" disabled={busy}>
            {busy
              ? 'Please wait…'
              : isRegister
                ? 'Create account'
                : isRecover
                  ? 'Set a new password'
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
