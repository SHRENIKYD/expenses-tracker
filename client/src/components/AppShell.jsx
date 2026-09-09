import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';

const NAV = [
  { to: '/', label: 'Overview', icon: 'home', end: true },
  { to: '/transactions', label: 'Transactions', icon: 'list' },
  { to: '/budgets', label: 'Budgets', icon: 'pie' },
  { to: '/reports', label: 'Reports', icon: 'chart' },
  { to: '/settings', label: 'Settings', icon: 'settings' }
];

const TITLES = {
  '/': { title: 'Overview', subtitle: 'Your money, at a glance' },
  '/transactions': { title: 'Transactions', subtitle: 'Everything you have recorded' },
  '/budgets': { title: 'Budgets', subtitle: 'Limits and recurring payments' },
  '/reports': { title: 'Reports', subtitle: 'Where your money goes over time' },
  '/settings': { title: 'Settings', subtitle: 'Your account and preferences' },
  '/add': { title: 'Add expense', subtitle: '' }
};

export default function AppShell({ context }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const page = TITLES[pathname] || TITLES['/'];
  // The add screen is a task, not a dashboard: a month picker and a second
  // "Add expense" button there would do nothing useful.
  const isTask = pathname === '/add';
  const { month, setMonth, error, undoable, handlers, session, onSignOut } = context;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="wallet" size={18} />
          </span>
          <span className="brand-name">Expense Tracker</span>
        </div>

        <nav>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <span className="sidebar-user">{session.user.displayName || session.user.email}</span>
          <button type="button" className="link" onClick={onSignOut}>
            <Icon name="logout" size={15} /> Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="page-header">
          <div className="page-title">
            {isTask && (
              <button
                type="button"
                className="icon-button"
                onClick={() => navigate(-1)}
                aria-label="Go back"
              >
                <Icon name="back" size={19} />
              </button>
            )}
            <div>
              <h1>{page.title}</h1>
              {page.subtitle && <p className="page-subtitle">{page.subtitle}</p>}
            </div>
          </div>

          {!isTask && (
          <div className="page-actions">
            <label className="month-select">
              <Icon name="calendar" size={16} />
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                aria-label="Month"
              />
            </label>
            <NavLink to="/add" className="button-primary">
              <Icon name="plus" size={17} /> Add expense
            </NavLink>
          </div>
          )}
        </header>

        {error && <p className="error">{error}</p>}

        {undoable && (
          <p className="undo-bar" role="status">
            <span>Deleted “{undoable.description}”</span>
            <button type="button" className="link" onClick={handlers.undo}>
              Undo
            </button>
          </p>
        )}

        <Outlet context={context} />
      </div>

      <nav className="tabbar">
        {NAV.slice(0, 2).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}

        <NavLink to="/add" className="tab-fab" aria-label="Add expense">
          <Icon name="plus" size={24} strokeWidth={2.2} />
        </NavLink>

        {NAV.slice(2, 4).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
          >
            <Icon name={item.icon} size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
