const KEY = 'expenses-tracker.session';

export function readSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.token) return null;
    if (session.expiresAt && new Date(session.expiresAt) <= new Date()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function writeSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // storage can be unavailable (private mode); the token still works for this page load
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to do
  }
}
