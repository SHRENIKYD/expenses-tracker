import { useState } from 'react';
import { formatMoney, titleCase } from '../format.js';

const SIZE = 180;
const RADIUS = 70;
const STROKE = 26;
const GAP = 2;
const MAX_SLICES = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function fold(categories) {
  const sorted = [...categories].filter((row) => row.total > 0).sort((a, b) => b.total - a.total);
  if (sorted.length <= MAX_SLICES + 1) return sorted.map((row, i) => ({ ...row, slot: i }));

  const head = sorted.slice(0, MAX_SLICES).map((row, i) => ({ ...row, slot: i }));
  const rest = sorted.slice(MAX_SLICES);
  head.push({
    category: 'other categories',
    total: rest.reduce((sum, row) => sum + row.total, 0),
    count: rest.reduce((sum, row) => sum + row.count, 0),
    budget: null,
    overBudget: false,
    slot: MAX_SLICES,
    folded: rest.length
  });
  return head;
}

export default function CategoryChart({ categories }) {
  const [hovered, setHovered] = useState(null);

  const slices = fold(categories);
  if (slices.length === 0) {
    return <p className="empty">No spending in this month yet.</p>;
  }

  const total = slices.reduce((sum, row) => sum + row.total, 0);
  let offset = 0;

  const arcs = slices.map((row) => {
    const length = (row.total / total) * CIRCUMFERENCE;
    const arc = { ...row, length, offset };
    offset += length;
    return arc;
  });

  const active = hovered === null ? null : arcs.find((arc) => arc.category === hovered);

  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Share of this month's spending by category">
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {arcs.map((arc) => (
              <circle
                key={arc.category}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                strokeWidth={hovered === arc.category ? STROKE + 4 : STROKE}
                strokeDasharray={`${Math.max(arc.length - GAP, 0.5)} ${CIRCUMFERENCE - Math.max(arc.length - GAP, 0.5)}`}
                strokeDashoffset={-arc.offset}
                className={`slice slice-${arc.slot}`}
                onMouseEnter={() => setHovered(arc.category)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </g>
          <text x={SIZE / 2} y={SIZE / 2 - 4} textAnchor="middle" className="donut-total">
            {active ? `${Math.round((active.total / total) * 100)}%` : formatMoney(total)}
          </text>
          <text x={SIZE / 2} y={SIZE / 2 + 14} textAnchor="middle" className="donut-caption">
            {active ? titleCase(active.category) : 'this month'}
          </text>
        </svg>
      </div>

      <ul className="legend">
        {arcs.map((arc) => (
          <li
            key={arc.category}
            onMouseEnter={() => setHovered(arc.category)}
            onMouseLeave={() => setHovered(null)}
            className={hovered === arc.category ? 'active' : undefined}
          >
            <span className={`swatch slice-${arc.slot}`} aria-hidden="true" />
            <span className="legend-name">
              {titleCase(arc.category)}
              {arc.folded ? ` (${arc.folded})` : ''}
              {arc.overBudget && <span className="over-flag"> ⚠ over</span>}
            </span>
            <span className="legend-value">{formatMoney(arc.total)}</span>
            <span className="legend-pct">{Math.round((arc.total / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
