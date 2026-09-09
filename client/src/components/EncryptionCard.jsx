import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import RecoveryKey from './RecoveryKey.jsx';
import { dataHealth, protectData, recentDiagnostics, reissueRecoveryKey, sealExisting, vaultState } from '../data/index.js';

// Encryption, and the only honest way to debug it.
//
// Nothing here can read a transaction on the server's behalf: the checks run in
// this page, where the key is, and what they report — codes, counts, row ids —
// carries no content at all.
export default function EncryptionCard() {
  const [state, setState] = useState(vaultState);
  const [password, setPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState(null);
  const [health, setHealth] = useState(null);
  const [log, setLog] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => setState(vaultState()), []);

  const run = async (name, work) => {
    setBusy(name);
    setError('');
    try {
      await work();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const protect = (event) => {
    event.preventDefault();
    return run('protect', async () => {
      const result = await protectData(password);
      setPassword('');
      setRecoveryKey(result.recoveryKey);
      setStatus(`${result.sealed} transaction${result.sealed === 1 ? '' : 's'} encrypted.`);
      setState(vaultState());
    });
  };

  const check = () =>
    run('check', async () => {
      const result = await dataHealth();
      setHealth(result);
      setLog(await recentDiagnostics(20));
    });

  const download = () => {
    // A report to send on, with the row ids and codes and nothing else.
    const report = { at: new Date().toISOString(), health, log };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'expenses-diagnostics.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card">
      <h2>
        <Icon name="settings" size={19} strokeWidth={1.9} />
        Encryption
      </h2>

      {!state.exists ? (
        <>
          <p className="hint">
            Your transactions are stored in the clear. Turning this on encrypts them in this
            browser before they are sent, so the database holds only ciphertext — the amounts,
            descriptions and categories become unreadable to anyone but you.
          </p>
          <form className="form" onSubmit={protect}>
            <label>
              Confirm your password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <span className="hint">
                The key is derived from it. Changing your password later re-wraps the key and
                leaves every transaction alone.
              </span>
            </label>
            <button type="submit" disabled={busy === 'protect'}>
              {busy === 'protect' ? 'Encrypting…' : 'Encrypt my data'}
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="hint">
            Transactions and receipts are encrypted in this browser before they are stored. The
            key never leaves this device, so a copy of the database is unreadable without your
            password or your recovery key.
          </p>

          <div className="button-row">
            <button type="button" className="secondary" onClick={check} disabled={busy === 'check'}>
              {busy === 'check' ? 'Checking…' : 'Check my data'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => run('seal', async () => {
                const { sealed } = await sealExisting();
                setStatus(
                  sealed === 0 ? 'Nothing was left unencrypted.' : `${sealed} more encrypted.`
                );
              })}
              disabled={busy === 'seal'}
            >
              {busy === 'seal' ? 'Encrypting…' : 'Encrypt anything left over'}
            </button>
            <button
              type="button"
              className="link"
              onClick={() => run('key', async () => setRecoveryKey((await reissueRecoveryKey()).recoveryKey))}
              disabled={busy === 'key'}
            >
              New recovery key
            </button>
          </div>
        </>
      )}

      {status && <p className="hint">{status}</p>}
      {error && <p className="error">{error}</p>}

      {recoveryKey && (
        <RecoveryKey
          value={recoveryKey}
          note="Write this down. It replaces any previous key and is shown once."
          onDone={() => setRecoveryKey(null)}
        />
      )}

      {health && (
        <div className="recovery-block">
          <h3>Data health</h3>
          <p className="hint">
            {health.total} transaction{health.total === 1 ? '' : 's'} · {health.sealed} encrypted ·{' '}
            {health.readable} still in the clear ·{' '}
            {health.failures.length === 0
              ? 'all of them opened'
              : `${health.failures.length} would not open`}
          </p>

          {health.failures.length > 0 && (
            <ul className="statement-skipped">
              {health.failures.map((row) => (
                <li key={row.id}>
                  <code>{row.id}</code> — {row.code}
                </li>
              ))}
            </ul>
          )}

          {log?.length > 0 && (
            <details className="statement-details">
              <summary>Recent diagnostics ({log.length})</summary>
              <pre className="statement-sample">
                {log
                  .map((entry) => `${entry.at.slice(0, 19)}  ${entry.code}  ${JSON.stringify(entry.detail)}`)
                  .join('\n')}
              </pre>
            </details>
          )}

          <div className="button-row">
            <button type="button" className="secondary" onClick={download}>
              <Icon name="export" size={16} /> Download report
            </button>
          </div>
          <p className="hint">
            The report holds codes, row identifiers and counts. It contains no description, amount
            or category — there is deliberately no way to produce one that does.
          </p>
        </div>
      )}
    </section>
  );
}
