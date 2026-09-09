import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import GoalCard from '../components/GoalCard.jsx';
import { formatMoney } from '../format.js';
import { CardsSkeleton } from '../components/Skeleton.jsx';

const ICONS = ['target', 'savings', 'laptop', 'transport', 'housing', 'education', 'health', 'entertainment', 'briefcase', 'other'];

export default function SavingsGoals() {
  const { goals, loading, handlers } = useOutletContext();
  const [form, setForm] = useState({ name: '', target: '', icon: 'target' });
  const [busy, setBusy] = useState(false);

  const saved = goals.reduce((sum, goal) => sum + goal.saved, 0);
  const target = goals.reduce((sum, goal) => sum + goal.target, 0);

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim() || !(Number(form.target) > 0)) return;
    setBusy(true);
    const created = await handlers.addGoal({
      name: form.name.trim(),
      target: Number(form.target),
      icon: form.icon
    });
    setBusy(false);
    if (created) setForm({ name: '', target: '', icon: 'target' });
  }

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>
            <Icon name="target" size={19} strokeWidth={1.9} />
            Your goals
          </h2>
          {goals.length > 0 && (
            <span className="hint">
              {formatMoney(saved)} saved of {formatMoney(target)}
            </span>
          )}
        </div>

        {goals.length === 0 && loading ? (
          <CardsSkeleton count={2} label="Loading savings goals" />
        ) : goals.length === 0 ? (
          <p className="empty">Nothing being saved for yet. Add a goal below.</p>
        ) : (
          <div className="portfolio-grid">{goals.map(goal => <GoalCard key={goal.id} goal={goal} handlers={handlers} />)}</div>
        )}
      </section>

      <section className="card">
        <h2>Add a goal</h2>
        <form className="goal-form" onSubmit={submit}>
          <label>
            Name
            <input
              value={form.name}
              maxLength={60}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="New laptop"
              required
            />
          </label>
          <label>
            Target amount
            <input
              type="number"
              min="1"
              step="0.01"
              value={form.target}
              onChange={(event) => setForm({ ...form, target: event.target.value })}
              required
            />
          </label>
          <label>
            Icon
            <select
              value={form.icon}
              onChange={(event) => setForm({ ...form, icon: event.target.value })}
            >
              {ICONS.map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="button-primary" disabled={busy}>
            <Icon name="plus" size={17} strokeWidth={2.1} /> Add goal
          </button>
        </form>
      </section>
    </>
  );
}
