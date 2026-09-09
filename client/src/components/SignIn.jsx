import { useState } from 'react';

export default function SignIn({ onAuthenticated, onSubmit }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isRegister = mode === 'register';
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = isRegister
        ? { email: form.email, password: form.password, displayName: form.displayName }
        : { email: form.email, password: form.password };
      const result = await onSubmit(mode, payload);
      onAuthenticated(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <div className="card signin-card">
        <h1>Expenses Tracker</h1>
        <p className="hint">
          {isRegister ? 'Create an account to start tracking.' : 'Sign in to see your expenses.'}
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

          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={update('password')}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={isRegister ? 8 : undefined}
              required
            />
            {isRegister && <span className="hint">At least 8 characters.</span>}
          </label>

          <button type="submit" disabled={busy}>
            {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="hint signin-switch">
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
        </p>
      </div>
    </div>
  );
}
