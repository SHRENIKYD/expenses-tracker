import { useState } from 'react';
import { formatMoney, formatMoneyShort, titleCase } from '../format.js';

const ROW_HEIGHT = 30;
const BAR_HEIGHT = 14;
const LABEL_WIDTH = 104;

export default function CategoryChart({ categories }) {
  const [hovered, setHovered] = useState(null);

  if (categories.length === 0) {
    return <p className="empty">No spending in this month yet.</p>;
  }

  const rows = [...categories].sort((a, b) => b.total - a.total);
  const max = Math.max(...rows.map((row) => row.total), 1);
  const height = rows.length * ROW_HEIGHT;

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 420 ${height}`}
        role="img"
        aria-label="Spending by category for the selected month"
        preserveAspectRatio="xMinYMin meet"
      >
        {rows.map((row, index) => {
          const y = index * ROW_HEIGHT;
          const width = Math.max((row.total / max) * (420 - LABEL_WIDTH - 74), 2);
          return (
            <g
              key={row.category}
              onMouseEnter={() => setHovered(row.category)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect x="0" y={y} width="420" height={ROW_HEIGHT} fill="transparent" />
              <text x="0" y={y + ROW_HEIGHT / 2} dominantBaseline="middle" className="chart-label">
                {titleCase(row.category)}
              </text>
              <rect
                x={LABEL_WIDTH}
                y={y + (ROW_HEIGHT - BAR_HEIGHT) / 2}
                width={width}
                height={BAR_HEIGHT}
                rx="4"
                className={row.overBudget ? 'bar bar-over' : 'bar'}
              />
              <text
                x={LABEL_WIDTH + width + 8}
                y={y + ROW_HEIGHT / 2}
                dominantBaseline="middle"
                className="chart-value"
              >
                {formatMoneyShort(row.total)}
                {row.overBudget && ' \u26a0 over'}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div className="chart-tip" role="status">
          {(() => {
            const row = rows.find((entry) => entry.category === hovered);
            return (
              <>
                <strong>{titleCase(row.category)}</strong> {formatMoney(row.total)} ·{' '}
                {row.count} {row.count === 1 ? 'entry' : 'entries'}
                {row.budget !== null && ` · budget ${formatMoney(row.budget)}`}
                {row.overBudget && ' · ⚠ Over budget'}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
