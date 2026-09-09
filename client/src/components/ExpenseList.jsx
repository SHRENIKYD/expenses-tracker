const currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

export default function ExpenseList({ expenses, onDelete }) {
  if (expenses.length === 0) {
    return (
      <div className="card">
        <h2>Expenses</h2>
        <p className="empty">No expenses yet. Add your first one.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Expenses</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th className="numeric">Amount</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {expenses.map((expense) => (
            <tr key={expense.id}>
              <td>{expense.date}</td>
              <td>{expense.description}</td>
              <td>
                <span className="tag">{expense.category}</span>
              </td>
              <td className="numeric">{currency.format(expense.amount)}</td>
              <td>
                <button type="button" className="link" onClick={() => onDelete(expense.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
