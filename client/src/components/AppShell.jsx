import { useEffect, useState } from 'react';
import { budgetAlert, money } from '../dashboard.js';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import ForestArt from './ForestArt.jsx';
import RangePicker from './RangePicker.jsx';
import GlobalSearch from './GlobalSearch.jsx';
import { formatToday } from '../format.js';

const NAV = [
  { to: '/', label: 'Overview', icon: 'chart', end: true },
  { to: '/transactions', label: 'Transactions', icon: 'swap' },
  { to: '/accounts', label: 'Accounts', icon: 'accounts' },
  { to: '/budgets', label: 'Budgets', icon: 'budget' },
  { to: '/goals', label: 'Savings goals', icon: 'health' },
  { to: '/reports', label: 'Reports', icon: 'bills' }
];

const TITLES = {
  '/': { title: 'Your money, in focus.', subtitle: 'today' },
  '/accounts': {
    title: 'Your accounts.',
    subtitle: 'Balances based on your recorded transactions'
  },
  '/goals': {
    title: 'Make room for your goals.',
    subtitle: 'Build your savings, one contribution at a time'
  },
  '/transactions': {
    title: 'Every rupee, accounted for.',
    subtitle: 'Search, filter and edit what you have recorded'
  },
  '/budgets': {
    title: 'Limits that hold.',
    subtitle: 'Budgets and the payments that repeat'
  },
  '/reports': {
    title: 'The longer view.',
    subtitle: 'Where your money goes over time'
  },
  '/settings': { title: 'Settings', subtitle: 'Your account and preferences' },
  '/add': { title: 'Add transaction', subtitle: '' }
};

export default function AppShell({ context }) {
  const [alertsOpen, setAlertsOpen] = useState(false);
  // The choice is the reader's, and it should survive a reload.
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'yes'
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const page = TITLES[pathname] || TITLES['/'];

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', collapsed ? 'yes' : 'no');
  }, [collapsed]);
  const isTask = pathname === '/add';

  const {
    range,
    setRange,
    error,
    undoable,
    handlers,
    session,
    onSignOut,
    settings,
    filters,
    setFilters,
    summary
  } = context;
  const pressure = budgetAlert(summary?.categories);
  const bills = summary?.upcoming || [];
  const name = settings?.displayName || session.user.displayName || '';
  const initial = (name || session.user.email).trim().charAt(0).toUpperCase();

  return (
    <div className="shell">
      <aside className={collapsed ? 'sidebar collapsed' : 'sidebar'}>
        <div className="brand">
          <span className="brand-mark">
            <Icon name="wallet" size={30} strokeWidth={2.4} />
          </span>
          <span className="brand-name">Expense Tracker</span>
        </div>

        <nav>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              // Collapsed, the label is gone from view but not from reach.
              title={item.label}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <Icon name={item.icon} size={24} strokeWidth={1.8} />
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
          <NavLink
            to="/settings"
            className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
          >
            <Icon name="settings" size={20} strokeWidth={1.9} />
            <span>Settings</span>
          </NavLink>

          <NavLink to="/settings" className="sidebar-user" aria-label="Profile and settings">
            <span className="sidebar-avatar">{initial}</span>
            <span className="sidebar-name">{name || session.user.email}</span>
            <Icon name="chevronRight" size={18} strokeWidth={1.9} />
          </NavLink>
        </div>
      </aside>

      <div className="main">
        <header className="page-header">
          <div className="page-title">
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setCollapsed((current) => !current)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
              title={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
            >
              <Icon name="panelLeft" size={19} strokeWidth={1.9} />
            </button>
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
              {page.subtitle && (
                <p className="page-subtitle">
                  {page.subtitle === 'today' ? formatToday() : page.subtitle}
                </p>
              )}
            </div>
          </div>

          {!isTask && (
            <div className="header-tools">
              <GlobalSearch
                onSeeAll={(value) =>
                  setFilters({ ...filters, q: value, from: '', to: '', searchAll: true })
                }
              />
              <div className="alerts-container">
                <button
                  className="notification-button"
                  aria-label="Budget and bill notifications"
                  aria-expanded={alertsOpen}
                  onClick={() => setAlertsOpen(!alertsOpen)}
                >
                  <Icon name="bell" size={23} />
                  {(pressure || bills.length > 0) && <i className="notification-dot" />}
                </button>
                {alertsOpen && (
                  <section
                    className="notification-panel"
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setAlertsOpen(false);
                    }}
                  >
                    <h2>Notifications</h2>
                    {pressure && (
                      <NavLink to="/budgets" onClick={() => setAlertsOpen(false)}>
                        {pressure.category} budget: {money(pressure.total)} of{' '}
                        {money(pressure.budget)} used
                      </NavLink>
                    )}
                    {bills.slice(0, 3).map((bill) => (
                      <NavLink key={bill.id} to="/budgets" onClick={() => setAlertsOpen(false)}>
                        {bill.description} · {money(bill.amount)} · {bill.date}
                      </NavLink>
                    ))}
                    {!pressure && !bills.length && (
                      <p className="hint">No budget or bill alerts this month.</p>
                    )}
                    <button className="link" onClick={() => setAlertsOpen(false)}>
                      Close
                    </button>
                  </section>
                )}
              </div>
              <NavLink to="/settings" className="avatar" aria-label="Profile and settings">
                {initial}
              </NavLink>
              <button
                className="icon-button mobile-menu-button"
                aria-label="Open navigation"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <Icon name="list" />
              </button>
            </div>
          )}
        </header>

        {menuOpen && (
          <nav className="mobile-menu" aria-label="More navigation">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/settings" onClick={() => setMenuOpen(false)}>
              Settings
            </NavLink>
            <button className="link" onClick={onSignOut}>
              Sign out
            </button>
          </nav>
        )}
        {!isTask && (
          <div className="page-actions">
            <RangePicker range={range} onChange={setRange} busy={context.periodLoading} />
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

        {NAV.filter((item) => ['/budgets', '/reports'].includes(item.to)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
          >
            <Icon name={item.icon} size={21} strokeWidth={1.9} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
