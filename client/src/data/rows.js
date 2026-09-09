// The database speaks snake_case and the app speaks camelCase. Every row that
// crosses between them goes through here, so a column rename is one edit rather
// than a hunt through the pages.

export const toTransaction = (row) => ({
  id: row.id,
  kind: row.kind,
  description: row.description,
  amount: Number(row.amount),
  category: row.category,
  date: row.date,
  paymentMethod: row.payment_method || null,
  accountId: row.account_id || null,
  note: row.note || '',
  receiptId: row.receipt_path || null,
  source: row.source || 'manual',
  externalRef: row.external_ref || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export function fromTransaction(input) {
  const row = {};
  const set = (column, value) => {
    if (value !== undefined) row[column] = value;
  };

  set('kind', input.kind);
  set('description', input.description?.trim());
  set('amount', input.amount === undefined ? undefined : Number(input.amount));
  set('category', input.category);
  set('date', input.date);
  set('note', input.note);
  set('source', input.source);
  set('external_ref', input.externalRef);
  // These three are nullable, so an explicit null has to survive the trip.
  if ('paymentMethod' in input) row.payment_method = input.paymentMethod || null;
  if ('accountId' in input) row.account_id = input.accountId || null;
  if ('receiptId' in input) row.receipt_path = input.receiptId || null;

  return row;
}

export const toAccount = (row) => ({
  id: row.id,
  name: row.name,
  openingBalance: Number(row.opening_balance),
  balance: Number(row.balance ?? row.opening_balance),
  transactions: Number(row.transactions ?? 0)
});

export const toGoal = (row) => {
  const target = Number(row.target_amount);
  const saved = Number(row.saved ?? row.saved_amount ?? 0);
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    target,
    saved,
    progress: target > 0 ? Math.min(saved / target, 1) : 0
  };
};

export const toBudget = (row) => ({
  category: row.category,
  monthlyLimit: Number(row.monthly_limit)
});

export const toRecurring = (row) => ({
  id: row.id,
  description: row.description,
  amount: Number(row.amount),
  category: row.category,
  dayOfMonth: row.day_of_month,
  paymentMethod: row.payment_method || null
});

export const toContribution = (row) => ({
  id: row.id,
  amount: Number(row.amount),
  date: row.created_at
});
