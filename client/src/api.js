import { readSession, clearSession } from './session.js';

const BASE = import.meta.env.VITE_API_URL || '/api';

// Set by App so a 401 anywhere drops the user back to the sign-in screen.
let onUnauthorised = () => {};
export const setUnauthorisedHandler = (handler) => {
  onUnauthorised = handler;
};

export function authHeaders(extra = {}) {
  const session = readSession();
  return session ? { ...extra, Authorization: `Bearer ${session.token}` } : extra;
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: authHeaders({ 'Content-Type': 'application/json', ...(options.headers || {}) })
  });

  // A 401 from the auth endpoints means bad credentials, not an expired session;
  // only the latter should bounce the user out and clear stored state.
  if (response.status === 401 && !path.startsWith('/auth/')) {
    clearSession();
    onUnauthorised();
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.errors?.join(', ') || payload?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

function toQuery(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export const listExpenses = (filters = {}) => request(`/expenses${toQuery(filters)}`);
export const listCategories = () => request('/expenses/categories');
export const createExpense = (expense) =>
  request('/expenses', { method: 'POST', body: JSON.stringify(expense) });
export const updateExpense = (id, patch) =>
  request(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
export const deleteExpense = (id) => request(`/expenses/${id}`, { method: 'DELETE' });

export const getSummary = (month) => request(`/summary${toQuery({ month })}`);

export const listRecurring = () => request('/recurring');
export const createRecurring = (template) =>
  request('/recurring', { method: 'POST', body: JSON.stringify(template) });
export const deleteRecurring = (id) => request(`/recurring/${id}`, { method: 'DELETE' });
export const applyRecurring = (month) =>
  request('/recurring/apply', { method: 'POST', body: JSON.stringify({ month }) });
export const listBudgets = () => request('/budgets');
export const setBudget = (category, monthlyLimit) =>
  request(`/budgets/${category}`, { method: 'PUT', body: JSON.stringify({ monthlyLimit }) });

export async function exportCsv(filters = {}) {
  const response = await fetch(`${BASE}/expenses/export${toQuery(filters)}`, {
    headers: authHeaders()
  });
  if (!response.ok) throw new Error(`Export failed (${response.status})`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'expenses.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function importCsv(text) {
  const response = await fetch(`${BASE}/expenses/import`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'text/csv' }),
    body: text
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.errors?.join(', ') || payload?.error || `Import failed (${response.status})`);
  }
  return payload;
}

export const register = (credentials) =>
  request('/auth/register', { method: 'POST', body: JSON.stringify(credentials) });
export const login = (credentials) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
export const logout = () => request('/auth/logout', { method: 'POST' });

export const getSettings = () => request('/settings');
export const saveSettings = (settings) =>
  request('/settings', { method: 'PUT', body: JSON.stringify(settings) });

export async function uploadReceipt(file) {
  const response = await fetch(`${BASE}/receipts`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': file.type }),
    body: file
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.errors?.join(', ') || payload?.error || `Upload failed (${response.status})`);
  }
  return payload;
}

export const receiptUsage = () => request('/receipts/usage');

export async function previewStatement(file, password) {
  const headers = authHeaders({ 'Content-Type': 'application/pdf' });
  if (password) headers['X-Statement-Password'] = password;

  const response = await fetch(`${BASE}/statements/preview`, { method: 'POST', headers, body: file });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(payload?.error || payload?.errors?.join(', ') || `Failed (${response.status})`);
    error.code = payload?.code;
    error.details = payload;
    throw error;
  }
  return payload;
}

export const importStatement = (transactions) =>
  request('/statements/import', { method: 'POST', body: JSON.stringify({ transactions }) });
