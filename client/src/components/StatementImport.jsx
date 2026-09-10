import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { formatMoney, formatDay, titleCase } from '../format.js';
import { previewStatement, importStatement } from '../data/index.js';

export default function StatementImport({ onImported, accounts = [], categories }) {
  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [preview, setPreview] = useState(null);
  const [chosen, setChosen] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [details, setDetails] = useState(null);
  const [destination, setDestination] = useState({ accountId: '', paymentMethod: '' });

  function reset() {
    setFile(null);
    setPreview(null);
    setChosen(new Set());
    setPassword('');
    setNeedsPassword(false);
    setError('');
    setDetails(null);
  }

  async function run(selected, withPassword) {
    setBusy(true);
    setError('');
    setResult('');
    setDetails(null);
    try {
      const data = await previewStatement(selected, withPassword);
      setPreview(data);
      // Rows that already exist start unticked, so importing twice is a no-op.
      setChosen(new Set(data.transactions.map((_, i) => i).filter((i) => !data.transactions[i].duplicate)));
      setNeedsPassword(false);
    } catch (err) {
      setPreview(null);
      if (err.code === 'password') setNeedsPassword(true);
      setError(err.message);
      setDetails(err.details || null);
    } finally {
      setBusy(false);
    }
  }

  async function choose(event) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    setFile(selected);
    await run(selected, '');
  }

  const recategorise = (index, category) =>
    setPreview((current) => ({
      ...current,
      transactions: current.transactions.map((row, position) =>
        position === index ? { ...row, category, remembered: false } : row
      )
    }));

  const toggle = (index) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  async function commit() {
    setBusy(true);
    setError('');
    try {
      const rows = preview.transactions.filter((_, index) => chosen.has(index));
      const outcome = await importStatement(rows, destination);
      setResult(
        `Imported ${outcome.imported}` +
          (outcome.duplicates ? `, skipped ${outcome.duplicates} already recorded` : '')
      );
      setPreview(null);
      setChosen(new Set());
      setFile(null);
      await onImported();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>
          <Icon name="bills" size={19} strokeWidth={1.9} />
          Import a bank statement
        </h2>
        {preview && (
          <button type="button" className="link" onClick={reset}>
            Start over
          </button>
        )}
      </div>

      {!preview && (
        <>
          <p className="hint">
            Upload a PDF statement. Transactions you already have are detected and left unticked.
          </p>
          <div className="button-row">
            <button type="button" className="secondary" onClick={() => fileInput.current.click()} disabled={busy}>
              <Icon name="bills" size={16} /> {busy ? 'Reading…' : 'Choose PDF'}
            </button>
            {file && <span className="hint">{file.name}</span>}
          </div>
          <input ref={fileInput} type="file" accept="application/pdf" onChange={choose} hidden />
        </>
      )}

      {needsPassword && (
        <div className="password-row">
          <label>
            Statement password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Often your PAN and date of birth"
            />
          </label>
          <button type="button" onClick={() => run(file, password)} disabled={busy || !password}>
            Unlock
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {details && (
        <details className="statement-details">
          <summary>What the parser saw</summary>
          <p className="hint">
            {details.bank ? `${details.bank.name}, ` : 'Bank not recognised, '}
            {details.pages} page{details.pages === 1 ? '' : 's'}, {details.lines} lines of text.
          </p>
          {details.counts && (
            <p className="hint">
              {details.counts.dated} lines carry a date, {details.counts.money} carry an amount,
              {' '}
              {details.counts.both} carry both.
            </p>
          )}
          {details.sample?.length > 0 && (
            <pre className="statement-sample">{details.sample.join('\n')}</pre>
          )}
          {details.dated?.length > 0 && (
            <>
              <p className="hint">Lines with a date</p>
              <pre className="statement-sample">{details.dated.join('\n')}</pre>
            </>
          )}
          {details.money?.length > 0 && (
            <>
              <p className="hint">Lines with an amount</p>
              <pre className="statement-sample">{details.money.join('\n')}</pre>
            </>
          )}
          {details.skipped?.length > 0 && (
            <ul className="statement-skipped">
              {details.skipped.map((row) => (
                <li key={row.line}>
                  <code>{row.line}</code> — {row.reason}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
      {result && <p className="hint">{result}</p>}

      {preview && (
        <>
          <p className="hint">
            {preview.bank ? <strong>{preview.bank.name}</strong> : 'Bank not recognised'} ·{' '}
            {preview.count} transactions found · {preview.duplicates} already recorded
            {preview.skipped.length > 0 && ` · ${preview.skipped.length} rows could not be read`}
          </p>
          <p className="hint">
            Correct a category here and it is remembered: the same merchant is categorised that way
            next time.
          </p>

          <div className="statement-destination">
            <label>
              Account
              <select
                value={destination.accountId}
                onChange={(event) => setDestination({ ...destination, accountId: event.target.value })}
              >
                <option value="">Leave unassigned</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Paid by
              <select
                value={destination.paymentMethod}
                onChange={(event) =>
                  setDestination({ ...destination, paymentMethod: event.target.value })
                }
              >
                <option value="">Not set</option>
                {(categories?.paymentMethods || []).map((method) => (
                  <option key={method} value={method}>
                    {titleCase(method.replace('_', ' '))}
                  </option>
                ))}
              </select>
            </label>
            <span className="hint">Applied to every row imported from this statement.</span>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th aria-label="Include" />
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th className="numeric">Amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.transactions.map((row, index) => (
                  <tr key={`${row.date}-${index}`} className={row.duplicate ? 'is-duplicate' : undefined}>
                    <td data-label="Include">
                      <input
                        type="checkbox"
                        checked={chosen.has(index)}
                        onChange={() => toggle(index)}
                        aria-label={`Include ${row.description}`}
                      />
                    </td>
                    <td data-label="Date">{formatDay(row.date)}</td>
                    <td data-label="Description">
                      {row.description}
                      {row.duplicate && <span className="dup-flag"> already recorded — {row.duplicateReason}</span>}
                    </td>
                    <td data-label="Category">
                      <select
                        value={row.category}
                        onChange={(event) => recategorise(index, event.target.value)}
                        aria-label={`Category for ${row.description}`}
                        className={row.remembered ? 'remembered' : undefined}
                        title={row.remembered ? 'Remembered from a previous import' : undefined}
                      >
                        {(categories?.[row.kind] || [row.category]).map((name) => (
                          <option key={name} value={name}>
                            {titleCase(name)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="numeric" data-label="Amount">
                      <span className={row.kind === 'income' ? 'amount-in' : 'amount-out'}>
                        {row.kind === 'income' ? '+' : '−'}
                        {formatMoney(row.amount)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="button-row">
            <button type="button" onClick={commit} disabled={busy || chosen.size === 0}>
              {busy ? 'Importing…' : `Import ${chosen.size} selected`}
            </button>
            <button type="button" className="secondary" onClick={reset}>
              Cancel
            </button>
          </div>
        </>
      )}
    </section>
  );
}
