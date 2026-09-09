const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

export default function Summary({ expenses }) {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  const byCategory = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});

  const ranked = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div className="card summary">
      <h2>Summary</h2>
      <p className="total">{currency.format(total)}</p>
      <p className="count">
        {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
      </p>
      <ul>
        {ranked.map(([category, amount]) => (
          <li key={category}>
            <span className="tag">{category}</span>
            <span>{currency.format(amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
