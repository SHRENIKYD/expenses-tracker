const WIDTH = 780;
const HEIGHT = 320;
const TOP = 40;
const FLOOR = 270;
const AXIS_X = 52;

// Round the axis up to a clean step so the gridline labels are readable numbers.
function niceMax(value) {
  if (value <= 0) return 10000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / 2;
  return Math.ceil(value / step) * step;
}

export default function CashFlowChart({ weekly = [], month }) {
  const peak = Math.max(...weekly.flatMap((week) => [week.income, week.expenses]), 0);
  const max = niceMax(peak);
  const plot = FLOOR - TOP;
  const slot = (WIDTH - AXIS_X) / Math.max(weekly.length, 1);
  const barWidth = Math.min(52, slot / 3.4);
  const gap = 8;

  const y = (value) => FLOOR - (value / max) * plot;
  const lines = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    value: max * fraction,
    y: FLOOR - fraction * plot
  }));

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Income and expenses for each week of the month"
      >
        {lines.map((line) => (
          <g key={line.value}>
            <line
              x1={AXIS_X}
              y1={line.y}
              x2={WIDTH}
              y2={line.y}
              className={line.value === 0 ? 'chart-axis' : 'chart-grid'}
            />
            <text x={AXIS_X - 10} y={line.y + 4} textAnchor="end" className="chart-tick">
              {Math.round(line.value).toLocaleString('en-IN')}
            </text>
          </g>
        ))}

        {weekly.map((week, index) => {
          const centre = AXIS_X + slot * index + slot / 2;
          const incomeX = centre - barWidth - gap / 2;
          const expenseX = centre + gap / 2;
          return (
            <g key={week.week}>
              {week.income > 0 && (
                <>
                  <rect
                    x={incomeX}
                    y={y(week.income)}
                    width={barWidth}
                    height={FLOOR - y(week.income)}
                    rx="6"
                    className="bar-income"
                  />
                  <text
                    x={incomeX + barWidth / 2}
                    y={y(week.income) - 9}
                    textAnchor="middle"
                    className="bar-label"
                  >
                    {Math.round(week.income).toLocaleString('en-IN')}
                  </text>
                </>
              )}
              {week.expenses > 0 && (
                <>
                  <rect
                    x={expenseX}
                    y={y(week.expenses)}
                    width={barWidth}
                    height={FLOOR - y(week.expenses)}
                    rx="6"
                    className="bar-expense"
                  />
                  <text
                    x={expenseX + barWidth / 2}
                    y={y(week.expenses) - 9}
                    textAnchor="middle"
                    className="bar-label"
                  >
                    {Math.round(week.expenses).toLocaleString('en-IN')}
                  </text>
                </>
              )}
              <text x={centre} y={FLOOR + 24} textAnchor="middle" className="bar-week">
                {week.label}
              </text>
              <text x={centre} y={FLOOR + 41} textAnchor="middle" className="chart-tick">
                {week.from}–{week.to}{' '}
                {new Date(`${month}-01T00:00:00Z`).toLocaleString('en-IN', {
                  month: 'short',
                  timeZone: 'UTC'
                })}
              </text>
            </g>
          );
        })}
      </svg>

      {peak === 0 && <p className="empty">Nothing recorded this month yet.</p>}
    </div>
  );
}
