import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { formatToday } from '../format.js';

const NAV = [
  { to: '/', label: 'Overview', icon: 'chart', end: true },
  { to: '/transactions', label: 'Transactions', icon: 'swap' },
  { to: '/budgets', label: 'Budgets', icon: 'budget' },
  { to: '/reports', label: 'Reports', icon: 'bills' }
];

const TITLES = {
  '/': { title: 'Your money, in focus.', subtitle: 'today' },
  '/transactions': { title: 'Every rupee, accounted for.', subtitle: 'Search, filter and edit what you have recorded' },
  '/budgets': { title: 'Limits that hold.', subtitle: 'Budgets and the payments that repeat' },
  '/reports': { title: 'The longer view.', subtitle: 'Where your money goes over time' },
  '/settings': { title: 'Settings', subtitle: 'Your account and preferences' },
  '/add': { title: 'Add transaction', subtitle: '' }
};

export default function AppShell({ context }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const page = TITLES[pathname] || TITLES['/'];
  const isTask = pathname === '/add';

  const { month, setMonth, error, undoable, handlers, session, onSignOut, settings } = context;
  const name = settings?.displayName || session.user.displayName || '';
  const initial = (name || session.user.email).trim().charAt(0).toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="wallet" size={21} strokeWidth={1.9} />
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
              <Icon name={item.icon} size={20} strokeWidth={1.9} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <p className="sidebar-motto">
          Better
          <br />
          habits
          <br />
          brighter
          <br />
          tomorrows.
          <span className="sidebar-rule" />
        </p>

        <svg className="sidebar-hills" viewBox="0 0 258 150" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,150 L52,72 L88,110 L132,44 L176,104 L214,68 L258,120 L258,150 Z" fill="none" stroke="#59a487" strokeWidth="1.4" />
          <path d="M0,150 L40,104 L74,128 L118,86 L160,124 L206,96 L258,138 L258,150 Z" fill="#1b5540" fillOpacity="0.55" stroke="#4b9077" strokeWidth="1" />
        </svg>

        <div className="sidebar-foot">
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <Icon name="settings" size={20} strokeWidth={1.9} />
            <span>Settings</span>
          </NavLink>

          <button type="button" className="sidebar-user" onClick={onSignOut} title="Sign out">
            <span className="sidebar-avatar">{initial}</span>
            <span className="sidebar-name">{name || session.user.email}</span>
            <Icon name="logout" size={16} strokeWidth={1.9} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="page-header">
          <div className="page-title">
            {isTask && (
              <button type="button" className="icon-button" onClick={() => navigate(-1)} aria-label="Go back">
                <Icon name="back" size={19} />
              </button>
            )}
            <div>
              <h1>{page.title}</h1>
              {page.subtitle && (
                <p className="page-subtitle">
                  {page.subtitle === 'today' ? formatToday() : page.subtitle}
                </p>
              )}
            </div>
          </div>

          {!isTask && (
            <div className="header-tools">
              <span className="avatar" aria-hidden="true">
                {initial}
              </span>
            </div>
          )}
        </header>

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
            <button type="button" className="secondary" onClick={handlers.exportCsv}>
              <Icon name="export" size={16} /> Export
            </button>
            <NavLink to="/add" className="button-primary">
              <Icon name="plus" size={18} strokeWidth={2.1} /> Add transaction
            </NavLink>
          </div>
        )}

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
            <Icon name={item.icon} size={21} strokeWidth={1.9} />
            <span>{item.label}</span>
          </NavLink>
        ))}

        <NavLink to="/add" className="tab-fab" aria-label="Add transaction">
          <Icon name="plus" size={25} strokeWidth={2.3} />
        </NavLink>

        {NAV.slice(2, 4).map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
            <Icon name={item.icon} size={21} strokeWidth={1.9} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
