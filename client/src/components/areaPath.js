export function buildArea(points, { width, floor, count }) {
  if (points.length === 0) return { line: '', area: '', coords: [], max: 1, step: 0 };

  const max = Math.max(...points.map((point) => point.value), 1);
  const step = count <= 1 ? width : width / (count - 1);
  const coords = points.map((point) => ({
    index: point.index,
    x: count <= 1 ? width / 2 : point.index * step,
    y: floor - (point.value / max) * (floor - 4)
  }));

  const line = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`)
    .join(' ');

  const first = coords[0];
  const last = coords[coords.length - 1];
  const area =
    coords.length === 1
      ? ''
      : `${line} L${last.x.toFixed(2)},${floor} L${first.x.toFixed(2)},${floor} Z`;

  return { line, area, coords, max, step };
}
