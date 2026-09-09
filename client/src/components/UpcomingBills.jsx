import { Link } from 'react-router-dom';
import Icon, { CATEGORY_ICON } from './Icon.jsx';
import { formatDayFull, formatMoneyTrim } from '../format.js';

export default function UpcomingBills({ upcoming, limit = 4 }) {
  return (
    <section className="card" id="upcoming">
      <div className="card-head">
        <h2>
          <Icon name="calendar" size={19} strokeWidth={1.9} />
          Upcoming bills
        </h2>
        <Link to="/budgets" className="link see-all">
          View all <Icon name="chevronRight" size={15} strokeWidth={2.1} />
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <p className="empty">Nothing due for the rest of this month.</p>
      ) : (
        <ul className="bill-list">
          {upcoming.slice(0, limit).map((item) => (
            <li key={item.id}>
              <span className="bill-icon">
                <Icon name={CATEGORY_ICON[item.category] || 'other'} size={19} strokeWidth={1.8} />
              </span>
              <span className="bill-name">{item.description}</span>
              <span className="bill-meta">
                {formatMoneyTrim(item.amount)} · {formatDayFull(item.date)}
              </span>
              <Icon name="chevronRight" size={16} strokeWidth={2} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
