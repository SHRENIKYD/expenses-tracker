import { useOutletContext } from 'react-router-dom';
import Budgets from '../components/Budgets.jsx';
import Recurring from '../components/Recurring.jsx';

export default function BudgetsPage() {
  const { summary, categories, budgets, recurring, month, handlers } = useOutletContext();

  return (
    <div className="two-col">
      {summary && (
        <Budgets
          categories={categories.expense}
          budgets={budgets}
          spending={summary.categories}
          onSave={handlers.setBudget}
        />
      )}
      <Recurring
        month={month}
        categories={categories.expense}
        templates={recurring}
        onAdd={handlers.addRecurring}
        onDelete={handlers.removeRecurring}
        onApply={handlers.applyRecurring}
      />
    </div>
  );
}
