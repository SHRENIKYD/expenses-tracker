import { useRef, useState } from 'react';
import Icon from './Icon.jsx';

export default function ImportExport({ onExport, onImport }) {
  const fileInput = useRef(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setResult('');
    const text = await file.text();
    const outcome = await onImport(text);
    setBusy(false);
    event.target.value = '';

    if (outcome) {
      const skipped = outcome.rejected?.length ?? 0;
      setResult(
        `Imported ${outcome.imported} row${outcome.imported === 1 ? '' : 's'}` +
          (skipped ? `, skipped ${skipped} invalid` : '')
      );
    }
  }

  async function handleExport() {
    setBusy(true);
    setResult('');
    await onExport();
    setBusy(false);
  }

  return (
    <div className="card">
      <h2>
          <Icon name="export" size={19} strokeWidth={1.9} />
          Import / export
        </h2>
      <p className="hint">CSV columns: date, description, category, amount</p>
      <div className="button-row">
        <button type="button" className="secondary" onClick={handleExport} disabled={busy}>
          Export CSV
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => fileInput.current.click()}
          disabled={busy}
        >
          Import CSV
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          hidden
        />
      </div>
      {result && <p className="hint">{result}</p>}
    </div>
  );
}
