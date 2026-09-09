import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// The service worker caches the app shell so the tracker opens on a phone with
// no signal; it never stores anything from the API. Registration is skipped in
// development, where an old worker would serve stale bundles, and in the
// Android build, where the shell is already on the device and a worker would
// only add a second, staler copy of it.
if ('serviceWorker' in navigator && import.meta.env.PROD && !import.meta.env.VITE_TARGET) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(() => {
        // an unsupported or blocked worker must not break the app
      });
  });
}
