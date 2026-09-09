import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArea } from '../src/components/areaPath.js';

const pts = (values) => values.map((value, index) => ({ index, value }));

test('returns empty paths for no points', () => {
  const { line, area } = buildArea([], { width: 100, floor: 50, count: 0 });
  assert.equal(line, '');
  assert.equal(area, '');
});

test('spreads points across the full width', () => {
  const { coords } = buildArea(pts([1, 2, 3]), { width: 100, floor: 50, count: 3 });
  assert.equal(coords[0].x, 0);
  assert.equal(coords[2].x, 100);
});

test('the tallest point sits near the top and the axis is the floor', () => {
  const { coords } = buildArea(pts([0, 10]), { width: 100, floor: 50, count: 2 });
  assert.equal(coords[0].y, 50);
  assert.ok(coords[1].y < 10);
});

test('a subset keeps its position on the full axis', () => {
  // months 8..11 of a 12-month axis should start at 8/11 of the width
  const subset = [8, 9, 10, 11].map((index) => ({ index, value: index }));
  const { coords } = buildArea(subset, { width: 110, floor: 50, count: 12 });
  assert.equal(coords[0].x, 80);
  assert.equal(coords[3].x, 110);
});

test('all-zero values do not divide by zero', () => {
  const { coords } = buildArea(pts([0, 0]), { width: 100, floor: 50, count: 2 });
  assert.ok(coords.every((c) => c.y === 50));
});

test('the area path closes back to the floor', () => {
  const { area } = buildArea(pts([1, 2]), { width: 100, floor: 50, count: 2 });
  assert.ok(area.endsWith('Z'));
  assert.ok(area.includes(',50'));
});
