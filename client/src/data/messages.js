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

/* ------------------------------------------------- bank notifications */

// Reading notifications is not a restricted permission, so a sideloaded build
// can be granted it without unlocking anything — and it catches alerts posted
// by bank apps, not only by SMS.

export async function notificationAccess() {
  if (!available()) return false;
  const { granted } = await Sms.notificationAccess();
  return granted;
}

// There is no dialog for this one; Android opens its own screen and the user
// finds the app in a list.
export const openNotificationAccess = () =>
  available() ? Sms.openNotificationAccess() : Promise.resolve();

// The apps whose notifications are worth reading: a bank's own app, a payment
// app, or the messaging app carrying a bank's SMS.
const BANK_APP = /(bank|hdfc|icici|sbi|axis|kotak|idfc|indusind|yesbank|pnb|bob|federal|rbl|upi|phonepe|paytm|bhim|googlepay|nbplus)/i;
const MESSAGING_APP = /(messaging|\.mms|\.sms)/i;

export async function listenNotifications(onSuggestion) {
  if (!available()) return () => {};

  const handle = await Sms.addListener('notificationPosted', (event) => {
    const fromBank = BANK_APP.test(event.app || '');
    // A messaging app puts the sender in the title, which is the only way to
    // tell a bank's alert from a friend's message.
    const fromBankSms = MESSAGING_APP.test(event.app || '') && looksLikeBank(event.title);
    if (!fromBank && !fromBankSms) return;

    const suggestion = readMessage({
      sender: event.title || event.app,
      body: event.body,
      at: event.at
    });
    if (suggestion) onSuggestion(suggestion);
  });

  await Sms.startNotifications();
  return async () => {
    await Sms.stopNotifications().catch(() => {});
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
