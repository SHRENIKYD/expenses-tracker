import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Budgets from '../components/Budgets.jsx';
import Recurring from '../components/Recurring.jsx';
import { formatMoney, formatMonthLong } from '../format.js';
import { CardsSkeleton } from '../components/Skeleton.jsx';

export default function BudgetsPage() {
  const { summary, categories, budgets, recurring, settings, month, loading, handlers } =
    useOutletContext();
  const [limit, setLimit] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setLimit(settings.monthlyBudget ? String(settings.monthlyBudget) : '');
  }, [settings.monthlyBudget]);

  async function saveLimit(event) {
    event.preventDefault();
    const saved = await handlers.saveSettings({
      displayName: settings.displayName || '',
      monthlyBudget: limit === '' ? 0 : Number(limit)
    });
    if (saved) setEditing(false);
  }

  // The budget is monthly, so this page only reports against it when the
  // selected range is a whole month.
  const monthSelected = Boolean(summary?.month);
  const overall = summary?.overallBudget ?? 0;
  const used = summary?.total ?? 0;
  const left = summary?.budgetLeft;
  const pct = overall > 0 ? Math.round((used / overall) * 100) : null;

  if (!summary && loading) return <CardsSkeleton count={2} label="Loading budgets" />;

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>
            <Icon name="target" size={19} strokeWidth={1.9} />
            Whole-month budget
          </h2>
          {!editing && (
            <button type="button" className="link" onClick={() => setEditing(true)}>
              {overall > 0 ? 'Change' : 'Set a budget'}
            </button>
          )}
        </div>

        {editing ? (
          <form className="goal-add" onSubmit={saveLimit}>
            <input
              type="number"
              min="0"
              step="1"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              placeholder="0 to clear"
              aria-label="Whole-month budget"
              autoFocus
            />
            <button type="submit" className="mint">
              Save
            </button>
            <button type="button" className="link" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
        ) : !monthSelected ? (
          <p className="empty">
            Budgets are monthly. Pick a month in the period selector to see how this one is
            tracking.
          </p>
        ) : overall > 0 ? (
          <>
            <p className="budget-figures">
              {formatMoney(used)} <span className="muted">of {formatMoney(overall)}</span>
            </p>
            <div className="budget-meter-row">
              <div className="meter">
                <div
                  className={pct > 100 ? 'meter-fill over' : 'meter-fill'}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className="budget-pct-small">{pct}%</span>
            </div>
            <p className="hint">
              {left >= 0
                ? `${formatMoney(left)} left for the rest of ${formatMonthLong(month)}`
                : `${formatMoney(Math.abs(left))} over budget in ${formatMonthLong(month)}`}
            </p>
          </>
        ) : (
          <p className="empty">No whole-month budget yet.</p>
        )}
      </section>

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
    </>
  );
}
