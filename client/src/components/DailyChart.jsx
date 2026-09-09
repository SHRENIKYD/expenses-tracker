import { useState } from 'react';
import { formatMoney, formatMoneyShort } from '../format.js';

const WIDTH = 420;
const HEIGHT = 96;
const AXIS = 14;

function daysInMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

export default function DailyChart({ month, daily }) {
  const [hovered, setHovered] = useState(null);

  const totals = new Map(daily.map((entry) => [entry.date, entry.total]));
  const days = Array.from({ length: daysInMonth(month) }, (_, index) => {
    const day = index + 1;
    const date = `${month}-${String(day).padStart(2, '0')}`;
    return { day, date, total: totals.get(date) ?? 0 };
  });

  const max = Math.max(...days.map((entry) => entry.total), 1);
  const slot = WIDTH / days.length;
  const barWidth = Math.max(slot - 1.5, 2);
  const plot = HEIGHT - AXIS;
  const active = hovered === null ? null : days[hovered];

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Spending for each day of the selected month"
      >
        <line x1="0" y1={plot} x2={WIDTH} y2={plot} className="chart-axis" />
        {days.map((entry, index) => {
          const barHeight = entry.total === 0 ? 0 : Math.max((entry.total / max) * (plot - 4), 2);
          const x = index * slot + 0.75;
          return (
            <g
              key={entry.date}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect x={x} y="0" width={barWidth} height={HEIGHT} fill="transparent" />
              {barHeight > 0 && (
                <rect
                  x={x}
                  y={plot - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx="2"
                  className={hovered === index ? 'bar bar-active' : 'bar'}
                />
              )}
              {(entry.day === 1 || entry.day % 7 === 0) && (
                <text x={x + barWidth / 2} y={HEIGHT - 3} textAnchor="middle" className="chart-tick">
                  {entry.day}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="chart-tip" role="status">
        {active ? (
          <>
            <strong>Day {active.day}</strong>{' '}
            {active.total === 0 ? 'no spending' : formatMoney(active.total)}
          </>
        ) : (
          <span className="muted">Busiest day {formatMoneyShort(max)} · hover for detail</span>
        )}
      </div>
    </div>
  );
}
