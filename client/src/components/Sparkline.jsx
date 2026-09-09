const BARS = 5;
const WIDTH = 44;
const HEIGHT = 36;
const BAR = 6;

// Five bars sized against the largest value in the series, so the shape is
// comparable within one tile. A flat series draws flat, not full height.
export default function Sparkline({ values, tone = 'accent' }) {
  const series = values.slice(-BARS);
  while (series.length < BARS) series.unshift(0);

  const peak = Math.max(...series.map((value) => Math.abs(value)), 0);
  const gap = (WIDTH - BARS * BAR) / (BARS - 1);

  return (
    <svg
      className={`sparkline ${tone}`}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      aria-hidden="true"
    >
      {series.map((value, index) => {
        const height = peak === 0 ? 2 : Math.max((Math.abs(value) / peak) * HEIGHT, 2);
        return (
          <rect
            key={index}
            x={index * (BAR + gap)}
            y={HEIGHT - height}
            width={BAR}
            height={height}
            rx="2"
          />
        );
      })}
    </svg>
  );
}
