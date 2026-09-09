import { useState } from 'react';
import { formatMoney, formatMoneyTrim, titleCase } from '../format.js';

const SIZE = 200;
const RADIUS = 76;
const STROKE = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const MAX_SLICES = 5;

// A single hue stepped dark to light reads as magnitude; the amber slot is
// reserved for the folded remainder so it never impersonates a category.
const SHADES = ['#14563f', '#1f7a58', '#4a9d7c', '#7dbb9e', '#a8d3bd'];
const OTHER = '#dfa63f';

function fold(categories) {
  const sorted = [...categories].filter((row) => row.total > 0).sort((a, b) => b.total - a.total);
  if (sorted.length <= MAX_SLICES) return sorted.map((row, i) => ({ ...row, colour: SHADES[i] }));

  const head = sorted.slice(0, MAX_SLICES - 1).map((row, i) => ({ ...row, colour: SHADES[i] }));
  const rest = sorted.slice(MAX_SLICES - 1);
  head.push({
    category: 'other',
    total: rest.reduce((sum, row) => sum + row.total, 0),
    count: rest.reduce((sum, row) => sum + row.count, 0),
    overBudget: false,
    colour: OTHER,
    folded: rest.length
  });
  return head;
}

export default function SpendingDonut({ categories, total }) {
  const [hovered, setHovered] = useState(null);
  const slices = fold(categories);

  if (slices.length === 0) {
    return <p className="empty">No spending recorded this month.</p>;
  }

  const sum = slices.reduce((acc, row) => acc + row.total, 0);
  // The centre label has to stay inside the ring's hole whatever the amount,
  // so it shrinks once the formatted string outgrows the space.
  const centreLabel = formatMoneyTrim(total);
  // Keep a clear margin between the label and the ring rather than filling the
  // hole edge to edge.
  const holeWidth = 2 * (RADIUS - STROKE / 2) - 26;
  const centreSize = Math.min(22, holeWidth / (centreLabel.length * 0.58));

  let offset = 0;
  const arcs = slices.map((row) => {
    const length = (row.total / sum) * CIRCUMFERENCE;
    const arc = { ...row, length, offset, share: row.total / sum };
    offset += length;
    return arc;
  });

  return (
    <div className="donut-row">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="donut-svg"
        role="img"
        aria-label="Share of this month's spending by category"
      >
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {arcs.map((arc) => (
            <circle
              key={arc.category}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={arc.colour}
              strokeWidth={hovered === arc.category ? STROKE + 5 : STROKE}
              strokeDasharray={`${Math.max(arc.length - 3, 0.5)} ${CIRCUMFERENCE}`}
              strokeDashoffset={-arc.offset}
              onMouseEnter={() => setHovered(arc.category)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </g>
        <text
          x={SIZE / 2}
          y={SIZE / 2 - 1}
          textAnchor="middle"
          className="donut-total"
          style={{ fontSize: `${centreSize}px` }}
        >
          {centreLabel}
        </text>
        <text x={SIZE / 2} y={SIZE / 2 + 18} textAnchor="middle" className="donut-caption">
          Total spent
        </text>
      </svg>

      <ul className="donut-legend">
        {arcs.map((arc) => (
          <li
            key={arc.category}
            onMouseEnter={() => setHovered(arc.category)}
            onMouseLeave={() => setHovered(null)}
            className={hovered === arc.category ? 'active' : undefined}
          >
            <span className="dot" style={{ background: arc.colour }} aria-hidden="true" />
            <span className="legend-name">
              {titleCase(arc.category)}
              {arc.folded ? ` (${arc.folded})` : ''}
              {arc.overBudget && <span className="over-flag"> ⚠</span>}
            </span>
            <span className="legend-value">{formatMoneyTrim(arc.total)}</span>
            <span className="legend-pct">{Math.round(arc.share * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
