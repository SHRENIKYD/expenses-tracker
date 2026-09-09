import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import Frame from './Frame.jsx';
import {
  available,
  notificationAccess,
  openNotificationAccess,
  permission,
  request
} from '../data/messages.js';
import { readingMessages, setReadingMessages } from './MessageSuggestions.jsx';

// Turning the message reader on, and saying plainly what it does.
export default function MessagesCard({ bare = false }) {
  const [on, setOn] = useState(readingMessages);
  const [granted, setGranted] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [error, setError] = useState('');

  const check = () => {
    permission()
      .then((state) => setGranted(state.granted))
      .catch(() => setGranted(false));
    notificationAccess().then(setNotifications).catch(() => setNotifications(false));
  };

  useEffect(() => {
    check();
    // Notification access is granted on Android's own screen, so the answer
    // only changes while this page is in the background.
    const recheck = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', recheck);
    return () => document.removeEventListener('visibilitychange', recheck);
  }, []);

  if (!available()) {
    return (
      <Frame bare={bare} icon="bell" title="Bank messages">
        <p className="hint">
          On the Android app, Tessera can read your bank’s SMS alerts and offer each one as a
          transaction to confirm. A browser cannot read messages, so this is only available there.
        </p>
      </Frame>
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
    <Frame bare={bare} icon="bell" title="Bank messages">

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

      <div className="recovery-block">
        <h3>Notifications</h3>
        <p className="hint">
          The same alerts, read from the notification shade instead. Android does not restrict
          this one, so it needs none of the unlocking that SMS does on a sideloaded app — and it
          catches alerts from your bank’s own app, not only from SMS. Either source is enough;
          both together simply mean whichever arrives first is the one you see.
        </p>
        {notifications ? (
          <p className="hint">
            Granted. Bank and payment notifications are read on this phone.
          </p>
        ) : (
          <button type="button" className="secondary" onClick={() => openNotificationAccess()}>
            Give notification access
          </button>
        )}
      </div>
    </Frame>
  );
}
