import { useState } from 'react';
import Icon from './Icon.jsx';

export default function RecoveryCodes({ codes, note }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="recovery">
      <p className="hint">{note}</p>
      <ul className="recovery-codes">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <button type="button" className="secondary" onClick={copy}>
        <Icon name="export" size={16} /> {copied ? 'Copied' : 'Copy all'}
      </button>
    </div>
  );
}
