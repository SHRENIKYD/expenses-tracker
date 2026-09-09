import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { available, permission, request } from '../data/messages.js';
import { readingMessages, setReadingMessages } from './MessageSuggestions.jsx';

// Turning the message reader on, and saying plainly what it does.
export default function MessagesCard() {
  const [on, setOn] = useState(readingMessages);
  const [granted, setGranted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    permission()
      .then((state) => setGranted(state.granted))
      .catch(() => setGranted(false));
  }, []);

  if (!available()) {
    return (
      <section className="card">
        <h2>
          <Icon name="bell" size={19} strokeWidth={1.9} />
          Bank messages
        </h2>
        <p className="hint">
          On the Android app, Tessera can read your bank’s SMS alerts and offer each one as a
          transaction to confirm. A browser cannot read messages, so this is only available there.
        </p>
      </section>
    );
  }

  async function enable() {
    setError('');
    const state = await request();
    setGranted(state.granted);
    if (!state.granted) {
      setError('Android did not grant permission, so messages cannot be read.');
      return;
    }
    setReadingMessages(true);
    setOn(true);
  }

  function disable() {
    setReadingMessages(false);
    setOn(false);
  }

  return (
    <section className="card">
      <h2>
        <Icon name="bell" size={19} strokeWidth={1.9} />
        Bank messages
      </h2>

      <p className="hint">
        Alerts from your bank are read on this phone and offered as transactions to confirm.
        Nothing is recorded until you tap Add, the messages themselves are never stored or sent
        anywhere, and Tessera reads only senders that look like a bank — never a person.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="button-row">
        {on && granted ? (
          <button type="button" className="secondary" onClick={disable}>
            Stop reading messages
          </button>
        ) : (
          <button type="button" onClick={enable}>
            Read my bank messages
          </button>
        )}
      </div>

      <p className="hint">
        {on && granted
          ? 'On. New alerts appear on the Overview, and the last three days are checked when the app opens.'
          : 'Off. Nothing is read.'}
      </p>
    </section>
  );
}
