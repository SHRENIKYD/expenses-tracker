import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import ForestArt from './ForestArt.jsx';
import { formatToday } from '../format.js';

const NAV = [
  { to: '/', label: 'Overview', icon: 'chart', end: true },
  { to: '/transactions', label: 'Transactions', icon: 'swap' },
  { to: '/accounts', label: 'Accounts', icon: 'accounts' },
  { to: '/budgets', label: 'Budgets', icon: 'budget' },
  { to: '/goals', label: 'Savings goals', icon: 'target' },
  { to: '/reports', label: 'Reports', icon: 'bills' }
];

const TABS = [NAV[0], NAV[1], NAV[3], NAV[5]];

const TITLES = {
  '/': { title: 'Your money, in focus.', subtitle: 'today' },
  '/transactions': { title: 'Every rupee, accounted for.', subtitle: 'Search, filter and edit what you have recorded' },
  '/accounts': { title: 'Where the money sits.', subtitle: 'This month by payment method' },
  '/budgets': { title: 'Limits that hold.', subtitle: 'Budgets and the payments that repeat' },
  '/goals': { title: 'Saving up for it.', subtitle: 'What you are putting money aside for' },
  '/reports': { title: 'The longer view.', subtitle: 'Where your money goes over time' },
  '/settings': { title: 'Settings', subtitle: 'Your account and preferences' },
  '/add': { title: 'Add transaction', subtitle: '' }
};

export default function AppShell({ context }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const page = TITLES[pathname] || TITLES['/'];
  const isTask = pathname === '/add';

  const { month, setMonth, error, undoable, handlers, session, settings, summary, filters, setFilters } =
    context;
  const name = settings?.displayName || session.user.displayName || '';
  const initial = (name || session.user.email).trim().charAt(0).toUpperCase();
  const dueSoon = summary?.dueSoon || 0;

  const [search, setSearch] = useState(filters.q);
  useEffect(() => setSearch(filters.q), [filters.q]);

  function runSearch(event) {
    event.preventDefault();
    setFilters((current) => ({ ...current, q: search }));
    if (pathname !== '/transactions') navigate('/transactions');
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="wallet" size={20} strokeWidth={1.9} />
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

        <ForestArt />

        <div className="sidebar-foot">
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
            <Icon name="settings" size={20} strokeWidth={1.9} />
            <span>Settings</span>
          </NavLink>

          <NavLink to="/settings" className="sidebar-user">
            <span className="sidebar-avatar">{initial}</span>
            <span className="sidebar-name">{name || session.user.email}</span>
            <Icon name="chevronRight" size={16} strokeWidth={2} />
          </NavLink>
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
              <form className="header-search" onSubmit={runSearch} role="search">
                <Icon name="search" size={17} strokeWidth={1.9} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search transactions, categories…"
                  aria-label="Search transactions"
                />
              </form>

              <button
                type="button"
                className={dueSoon > 0 ? 'icon-button bell due' : 'icon-button bell'}
                onClick={() => {
                  navigate('/');
                  requestAnimationFrame(() =>
                    document.getElementById('upcoming')?.scrollIntoView({ behavior: 'smooth' })
                  );
                }}
                aria-label={
                  dueSoon > 0 ? `${dueSoon} bills due within a week` : 'No bills due within a week'
                }
              >
                <Icon name="bell" size={19} strokeWidth={1.9} />
              </button>

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
        {TABS.slice(0, 2).map((item) => (
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

        {TABS.slice(2).map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
            <Icon name={item.icon} size={21} strokeWidth={1.9} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
