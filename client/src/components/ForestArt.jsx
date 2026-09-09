// The sidebar's lower band, in the reference, is a layered pine silhouette.
// Two rows of firs drawn from a fixed table, the nearer row darker, sized in
// the same units as the rendered box so nothing stretches.
const FLOOR = 168;
const WIDTH = 250;

const BACK = [
  { x: 0, w: 54, h: 78 },
  { x: 38, w: 46, h: 62 },
  { x: 74, w: 58, h: 86 },
  { x: 122, w: 46, h: 64 },
  { x: 156, w: 56, h: 82 },
  { x: 202, w: 48, h: 66 }
];

const FRONT = [
  { x: -18, w: 56, h: 62 },
  { x: 24, w: 48, h: 50 },
  { x: 62, w: 60, h: 68 },
  { x: 112, w: 48, h: 52 },
  { x: 150, w: 58, h: 66 },
  { x: 196, w: 50, h: 54 },
  { x: 232, w: 56, h: 60 }
];

// A fir: three overlapping tiers, each wider than the one above, on a short trunk.
function fir({ x, w, h }) {
  const cx = x + w / 2;
  const top = FLOOR - h;
  const tier = h / 3.6;
  const parts = [];
  for (let i = 0; i < 3; i += 1) {
    const width = w * (0.62 + 0.19 * i);
    const y = top + tier * i * 0.9;
    parts.push(
      `M${cx},${y} L${cx + width / 2},${y + tier * 1.85} L${cx - width / 2},${y + tier * 1.85} Z`
    );
  }
  parts.push(`M${cx - 2.4},${FLOOR} L${cx - 2.4},${FLOOR - tier * 0.6} L${cx + 2.4},${FLOOR - tier * 0.6} L${cx + 2.4},${FLOOR} Z`);
  return parts.join(' ');
}

export default function ForestArt() {
  return (
    <svg
      className="sidebar-trees"
      viewBox={`0 0 ${WIDTH} ${FLOOR}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect x="0" y={FLOOR - 16} width={WIDTH} height="16" fill="#0e4030" />
      <path d={BACK.map(fir).join(' ')} fill="#16523c" />
      <path d={FRONT.map(fir).join(' ')} fill="#0e4030" />
    </svg>
  );
}
