// The bridge to the phone's message reader.
//
// On the web there is no reader, so everything here answers "not available"
// rather than throwing: the same build runs in both places.

import { registerPlugin, Capacitor } from '@capacitor/core';
import { looksLikeBank, readMessage } from '../sms.js';

const Sms = registerPlugin('Sms');

export const available = () => Capacitor.isNativePlatform();

export async function permission() {
  if (!available()) return { granted: false, supported: false };
  const { granted } = await Sms.checkPermission();
  return { granted, supported: true };
}

export async function request() {
  if (!available()) return { granted: false, supported: false };
  const { granted } = await Sms.requestPermission();
  return { granted, supported: true };
}

/**
 * Start listening. `onSuggestion` is handed a transaction read out of an alert;
 * messages that are not transactions, or that cannot be read with confidence,
 * never reach it.
 */
export async function listen(onSuggestion) {
  if (!available()) return () => {};

  const handle = await Sms.addListener('smsReceived', (event) => {
    if (!looksLikeBank(event.sender)) return;
    const suggestion = readMessage(event);
    if (suggestion) onSuggestion(suggestion);
  });

  await Sms.start();
  return async () => {
    await Sms.stop().catch(() => {});
    handle.remove();
  };
}

/** What arrived while the app was closed. */
export async function recent(days = 7) {
  if (!available()) return [];
  const { messages } = await Sms.recent({ days });
  return messages
    .filter((message) => looksLikeBank(message.sender))
    .map(readMessage)
    .filter(Boolean);
}
