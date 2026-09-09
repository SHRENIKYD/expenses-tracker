import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import GoalCard from '../components/GoalCard.jsx';
export default function Goals() {
  const { goals, handlers } = useOutletContext();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    const result = await handlers.createGoal({ name, target });
    setBusy(false);
    if (result) {
      setName('');
      setTarget('');
    }
  }
  return (
    <>
      <section className="card">
        <h2>Create a savings goal</h2>
        <form className="portfolio-form" onSubmit={submit}>
          <label>
            Goal name
            <input
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New laptop"
            />
          </label>
          <label>
            Target amount (₹)
            <input
              required
              type="number"
              min="0.01"
              max="9999999999.99"
              step="0.01"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="75,000"
            />
          </label>
          <button disabled={busy}>{busy ? 'Creating…' : 'Create goal'}</button>
        </form>
      </section>
      <div className="portfolio-grid">
        {goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} handlers={handlers} />
        ))}
      </div>
      {!goals.length && (
        <p className="empty">Create your first goal, then record contributions as you save.</p>
      )}
    </>
  );
}
