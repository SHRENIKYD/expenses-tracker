const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...options
  });

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
  const response = await fetch(`${BASE}/expenses/export${toQuery(filters)}`);
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
    headers: { 'Content-Type': 'text/csv' },
    body: text
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.errors?.join(', ') || payload?.error || `Import failed (${response.status})`);
  }
  return payload;
}
