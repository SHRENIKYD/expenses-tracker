import { useState } from 'react';
import { formatMoney, formatMoneyShort, formatMonth } from '../format.js';

const WIDTH = 420;
const HEIGHT = 140;
const AXIS = 18;

export default function TrendChart({ trend }) {
  const [hovered, setHovered] = useState(null);

  const max = Math.max(...trend.map((point) => point.total), 1);
  const slot = WIDTH / trend.length;
  const barWidth = Math.max(slot - 2, 4);
  const plot = HEIGHT - AXIS;

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Total spending for each of the last twelve months"
      >
        <line x1="0" y1={plot} x2={WIDTH} y2={plot} className="chart-axis" />
        {trend.map((point, index) => {
          const barHeight = point.total === 0 ? 0 : Math.max((point.total / max) * (plot - 6), 3);
          const x = index * slot + 1;
          return (
            <g
              key={point.month}
              onMouseEnter={() => setHovered(point.month)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect x={x} y="0" width={barWidth} height={HEIGHT} fill="transparent" />
              {barHeight > 0 && (
                <rect
                  x={x}
                  y={plot - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  className={hovered === point.month ? 'bar bar-active' : 'bar'}
                />
              )}
              {index % 2 === (trend.length - 1) % 2 && (
                <text x={x + barWidth / 2} y={HEIGHT - 5} textAnchor="middle" className="chart-tick">
                  {formatMonth(point.month)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="chart-tip" role="status">
        {hovered ? (
          <>
            <strong>{formatMonth(hovered)}</strong>{' '}
            {formatMoney(trend.find((point) => point.month === hovered).total)}
          </>
        ) : (
          <span className="muted">Peak {formatMoneyShort(max)} · hover a bar for detail</span>
        )}
      </div>
    </div>
  );
}
