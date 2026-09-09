import { titleCase } from '../format.js';

export default function Filters({ categories, filters, onChange, onReset }) {
  const update = (field) => (event) => onChange({ ...filters, [field]: event.target.value });
  const active = filters.q || filters.category || filters.from || filters.to;

  return (
    <div className="card filters">
      <div className="filter-row">
        <label className="grow">
          Search
          <input
            type="search"
            value={filters.q}
            onChange={update('q')}
            placeholder="Description contains…"
          />
        </label>

        <label>
          Category
          <select value={filters.category} onChange={update('category')}>
            <option value="">All</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {titleCase(category)}
              </option>
            ))}
          </select>
        </label>

        <label>
          From
          <input type="date" value={filters.from} onChange={update('from')} />
        </label>

        <label>
          To
          <input type="date" value={filters.to} onChange={update('to')} />
        </label>

        <button type="button" className="secondary" onClick={onReset} disabled={!active}>
          Clear
        </button>
      </div>
    </div>
  );
}
