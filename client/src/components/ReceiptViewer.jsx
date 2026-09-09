import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { deleteReceipt, fetchReceipt } from '../api.js';

export default function ReceiptViewer({ receiptId, name, onClose, onDeleted }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let revoked = null;
    fetchReceipt(receiptId)
      .then((loaded) => {
        revoked = loaded.url;
        setFile(loaded);
      })
      .catch((err) => setError(err.message));

    // The blob lives in this tab's memory until it is released.
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [receiptId]);

  async function remove() {
    setBusy(true);
    try {
      await deleteReceipt(receiptId);
      onDeleted();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="receipt-backdrop" role="dialog" aria-label={`Receipt for ${name}`}>
      <div className="card receipt-modal">
        <div className="card-head">
          <h2>
            <Icon name="camera" size={19} strokeWidth={1.9} />
            {name}
          </h2>
          <button type="button" className="link" onClick={onClose}>
            Close
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {!file && !error && <p className="empty">Loading…</p>}

        {file &&
          (file.type === 'application/pdf' ? (
            <object data={file.url} type="application/pdf" className="receipt-frame">
              <p className="hint">
                This PDF cannot be shown here.{' '}
                <a href={file.url} target="_blank" rel="noreferrer">
                  Open it in a new tab
                </a>
                .
              </p>
            </object>
          ) : (
            <img src={file.url} alt={`Receipt for ${name}`} className="receipt-image" />
          ))}

        <div className="button-row">
          {file && (
            <a className="secondary button-like" href={file.url} target="_blank" rel="noreferrer">
              Open full size
            </a>
          )}
          <button type="button" className="link danger" onClick={remove} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete receipt'}
          </button>
        </div>
      </div>
    </div>
  );
}
