import { useState } from 'react';
import useElementWidth from '../useElementWidth.js';
import { formatMoney, formatMoneyShort } from '../format.js';
import { buildArea } from './areaPath.js';

// Drawn at the card's own width (see useElementWidth), with room either side
// for the first and last labels, which are centred on their points.
const INITIAL_WIDTH = 420;
const INSET = 22;
const HEIGHT = 150;
const FLOOR = 132;

function daysInMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

export default function DailyChart({ month, daily }) {
  const [hovered, setHovered] = useState(null);
  const [box, measured] = useElementWidth(INITIAL_WIDTH);
  const outer = Math.max(240, measured);
  const WIDTH = outer - INSET * 2;

  const totals = new Map(daily.map((entry) => [entry.date, entry.total]));
  const days = Array.from({ length: daysInMonth(month) }, (_, index) => {
    const day = index + 1;
    return { day, index, value: totals.get(`${month}-${String(day).padStart(2, '0')}`) ?? 0 };
  });

  const { line, area, coords, max, step } = buildArea(days, { width: WIDTH, floor: FLOOR, count: days.length });
  const active = hovered === null ? null : days[hovered];

  return (
    <div className="chart area" ref={box}>
      <svg
        viewBox={`0 0 ${outer} ${HEIGHT}`}
        width={outer}
        height={HEIGHT}
        role="img"
        aria-label="Spending for each day of the selected month"
      >
        <g transform={`translate(${INSET},0)`}>
        <path d={area} className="area-fill" />
        <path d={line} className="area-line" />
        <line x1="0" y1={FLOOR} x2={WIDTH} y2={FLOOR} className="chart-axis" />

        {active && (
          <>
            <line
              x1={coords[hovered].x}
              y1="0"
              x2={coords[hovered].x}
              y2={FLOOR}
              className="crosshair"
            />
            <circle cx={coords[hovered].x} cy={coords[hovered].y} r="5" className="area-marker" />
          </>
        )}

        {days.map((entry, index) => (
          <g key={entry.day}>
            <rect
              x={index * step - step / 2}
              y="0"
              width={Math.max(step, 4)}
              height={FLOOR}
              fill="transparent"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
            />
            {(entry.day === 1 || entry.day % 7 === 0) && (
              <text x={index * step} y={HEIGHT - 3} textAnchor="middle" className="chart-tick">
                {entry.day}
              </text>
            )}
          </g>
        ))}
        </g>
      </svg>

      <div className="chart-tip" role="status">
        {active ? (
          <>
            <strong>Day {active.day}</strong>{' '}
            {active.value === 0 ? 'no spending' : formatMoney(active.value)}
          </>
        ) : (
          <span className="muted">Busiest day {formatMoneyShort(max)} · hover for detail</span>
        )}
      </div>
    </div>
  );
}
