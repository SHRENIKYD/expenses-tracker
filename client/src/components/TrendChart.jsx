import { useState } from 'react';
import { formatMoney, formatMoneyShort, formatMonth } from '../format.js';
import { buildArea } from './areaPath.js';

const WIDTH = 420;
const HEIGHT = 150;
const FLOOR = 128;

export default function TrendChart({ trend }) {
  const [hovered, setHovered] = useState(null);

  const all = trend.map((point, index) => ({ ...point, index, value: point.total }));
  const firstWithData = all.findIndex((point) => point.value > 0);
  const plotted = firstWithData === -1 ? [] : all.slice(firstWithData);

  const { line, area, coords, max, step } = buildArea(plotted, {
    width: WIDTH,
    floor: FLOOR,
    count: all.length
  });

  const coordFor = (index) => coords.find((coord) => coord.index === index);
  const active = hovered === null ? null : all[hovered];
  const activeCoord = active ? coordFor(active.index) : null;

  return (
    <div className="chart area">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Total spending for each of the last twelve months">
        <path d={area} className="area-fill" />
        <path d={line} className="area-line" />
        <line x1="0" y1={FLOOR} x2={WIDTH} y2={FLOOR} className="chart-axis" />

        {activeCoord && (
          <>
            <line x1={activeCoord.x} y1="0" x2={activeCoord.x} y2={FLOOR} className="crosshair" />
            <circle cx={activeCoord.x} cy={activeCoord.y} r="5" className="area-marker" />
          </>
        )}

        {all.map((point, index) => (
          <g key={point.month}>
            <rect
              x={index * step - step / 2}
              y="0"
              width={Math.max(step, 4)}
              height={FLOOR}
              fill="transparent"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
            />
            {index % 2 === (all.length - 1) % 2 && (
              <text x={index * step} y={HEIGHT - 4} textAnchor="middle" className="chart-tick">
                {formatMonth(point.month)}
              </text>
            )}
          </g>
        ))}
      </svg>

      <div className="chart-tip" role="status">
        {active ? (
          <>
            <strong>{formatMonth(active.month)}</strong>{' '}
            {active.index < firstWithData ? 'no data' : formatMoney(active.total)}
          </>
        ) : (
          <span className="muted">Peak {formatMoneyShort(max)} · hover for detail</span>
        )}
      </div>
    </div>
  );
}
