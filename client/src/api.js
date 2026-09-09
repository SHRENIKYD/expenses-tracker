const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
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

export const listExpenses = () => request('/expenses');
export const listCategories = () => request('/expenses/categories');
export const createExpense = (expense) =>
  request('/expenses', { method: 'POST', body: JSON.stringify(expense) });
export const deleteExpense = (id) => request(`/expenses/${id}`, { method: 'DELETE' });
