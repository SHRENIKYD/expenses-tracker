export const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);

export function monthRange(month) {
  const [year, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${last}` };
}

export function budgetAlert(categories = []) {
  return (
    [...categories]
      .filter((row) => row.budget > 0 && row.total / row.budget >= 0.85)
      .sort((a, b) => b.total / b.budget - a.total / a.budget)[0] || null
  );
}
