import Icon from './Icon.jsx';

// Shown once, at setup, and never again: it is not stored anywhere that could
// hand it back. Written down, it is the only way into an account whose password
// has been forgotten.
export default function RecoveryKey({ value, note, onDone }) {
  return (
    <div className="recovery-codes">
      <p className="hint">{note}</p>
      <p className="recovery-key">{value}</p>
      <div className="button-row">
        <button
          type="button"
          className="secondary"
          onClick={() => navigator.clipboard?.writeText(value)}
        >
          <Icon name="export" size={16} /> Copy
        </button>
        {onDone && (
          <button type="button" onClick={onDone}>
            I have written it down
          </button>
        )}
      </div>
    </div>
  );
}
