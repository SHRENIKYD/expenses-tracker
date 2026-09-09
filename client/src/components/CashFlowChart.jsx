const WIDTH = 760;
const HEIGHT = 320;
const TOP = 34;
const FLOOR = 262;
// wide enough for a seven-figure tick such as 1,00,000
const AXIS_X = 72;
const MAX_BAR = 52;
const GAP = 6;

// The axis is drawn in quarters, so the top has to be a multiple of four steps
// or the gridlines read 63,750 instead of 60,000.
function niceMax(value) {
  if (value <= 0) return 40000;
  const magnitude = 10 ** Math.floor(Math.log10(value / 4));
  for (const multiple of [1, 2, 2.5, 5, 10]) {
    const step = multiple * magnitude;
    if (step * 4 >= value) return step * 4;
  }
  return magnitude * 40;
}

// A rectangle rounded on its top corners only, the way the reference draws bars.
function barPath(x, y, width, height, radius = 4) {
  const r = Math.min(radius, height);
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
}

export default function CashFlowChart({ series, monthLabel }) {
  const peak = Math.max(...series.flatMap((group) => [group.income, group.expenses]), 0);
  const max = niceMax(peak);
  const plot = FLOOR - TOP;
  const slot = (WIDTH - AXIS_X) / series.length;
  // Weekly draws the reference's 52px bars; a denser series narrows them to fit.
  const BAR = Math.max(Math.min(MAX_BAR, slot / 2 - GAP), 3);

  const y = (value) => FLOOR - (value / max) * plot;
  const lines = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    value: max * fraction,
    y: FLOOR - fraction * plot
  }));

  return (
    <div className="chart cashflow">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Income and expenses per period">
        {lines.map((line) => (
          <g key={line.value}>
            <line
              x1={AXIS_X}
              y1={line.y}
              x2={WIDTH}
              y2={line.y}
              className={line.value === 0 ? 'chart-axis' : 'chart-grid'}
            />
            <text x={AXIS_X - 12} y={line.y + 4} textAnchor="end" className="chart-tick">
              {Math.round(line.value).toLocaleString('en-IN')}
            </text>
          </g>
        ))}

        {series.map((group) => {
          const centre = AXIS_X + slot * (group.index - 1) + slot / 2;
          const incomeX = centre - BAR - GAP / 2;
          const expenseX = centre + GAP / 2;
          return (
            <g key={group.label}>
              {group.income > 0 && (
                <>
                  <path d={barPath(incomeX, y(group.income), BAR, FLOOR - y(group.income))} className="bar-income" />
                  <text x={incomeX + BAR / 2} y={y(group.income) - 10} textAnchor="middle" className="bar-label">
                    {Math.round(group.income).toLocaleString('en-IN')}
                  </text>
                </>
              )}
              {group.expenses > 0 && (
                <>
                  <path d={barPath(expenseX, y(group.expenses), BAR, FLOOR - y(group.expenses))} className="bar-expense" />
                  <text x={expenseX + BAR / 2} y={y(group.expenses) - 10} textAnchor="middle" className="bar-label">
                    {Math.round(group.expenses).toLocaleString('en-IN')}
                  </text>
                </>
              )}
              <text x={centre} y={FLOOR + 26} textAnchor="middle" className="bar-period">
                {group.label}
              </text>
              <text x={centre} y={FLOOR + 45} textAnchor="middle" className="bar-range">
                {group.range}
              </text>
            </g>
          );
        })}
      </svg>

      {peak === 0 && <p className="empty">Nothing recorded in {monthLabel} yet.</p>}
    </div>
  );
}
