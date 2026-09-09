import Icon from './Icon.jsx';
import { formatMoney } from '../format.js';

// The phone's header, on the Overview: the number is the header.
//
// A phone was spending about 380px — a title, a date, a search row and a
// control row — before showing a single figure. The app is opened to see one
// number, so that number sits at the top, in the brand's green, and everything
// else is an icon or a chip beside it. The desktop header is untouched: it has
// the width to spell things out.
export default function PhoneHeader({
  initial,
  summary,
  periodLabel,
  title,
  showFigure,
  onSearch,
  onNotifications,
  hasAlerts,
  onPeriod,
  busy
}) {
  const remaining = summary ? summary.remaining : null;

  return (
    <header className="phone-header">
      <div className="phone-header-bar">
        <span className="phone-avatar">{initial}</span>
        <span className="phone-brand">Tessera</span>

        <button type="button" className="phone-icon" onClick={onSearch} aria-label="Search transactions">
          <Icon name="search" size={18} strokeWidth={1.9} />
        </button>
        <button
          type="button"
          className="phone-icon"
          onClick={onNotifications}
          aria-label="Budget and bill notifications"
        >
          <Icon name="bell" size={18} strokeWidth={1.9} />
          {hasAlerts && <i className="notification-dot" />}
        </button>
      </div>

      <div className="phone-figure">
        {showFigure ? (
          <>
            <span className="phone-figure-label">Remaining income</span>
            <p className="phone-figure-amount">
              {remaining === null ? <span className="phone-figure-wait" /> : formatMoney(remaining)}
            </p>
          </>
        ) : (
          // Every other page has no single figure to lead with, so it leads
          // with its name instead and keeps the same shape.
          <p className="phone-figure-title">{title}</p>
        )}

        <div className="phone-figure-row">
          <button type="button" className="phone-chip" onClick={onPeriod} disabled={busy}>
            {periodLabel}
            <Icon name="chevronDown" size={15} strokeWidth={2.1} />
          </button>

          {summary && showFigure && (
            <span className="phone-figure-split">
              <span>
                <Icon name="arrowUpRight" size={14} strokeWidth={2.2} /> {formatMoney(summary.income)}
              </span>
              <span>
                <Icon name="arrowDownRight" size={14} strokeWidth={2.2} /> {formatMoney(summary.total)}
              </span>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
