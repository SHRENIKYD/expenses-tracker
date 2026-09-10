import test from 'node:test';
import assert from 'node:assert/strict';

import { groupIntoLines } from '../src/pdf-lines.js';

// A row as a PDF actually carries it: each column on its own baseline, a
// fraction of a point away from its neighbours.
const NUDGE = [0, 0.4, -0.6, 0.9, -0.4, 1.4, -1.1, 0.6];
const COLUMNS = ['1', '06/09/2026', '07/09/2026', '-', 'UPI/129166379807/SWIGGY', '30.00', '0.00', '12,345.67'];
const X = [30, 60, 130, 200, 230, 560, 640, 720];

const row = (baseline) =>
  COLUMNS.map((text, index) => ({ x: X[index], y: baseline + NUDGE[index], height: 8, text }));

test('the columns of one row come back as one line, however their baselines differ', () => {
  const lines = groupIntoLines(row(500));

  assert.equal(lines.length, 1);
  assert.equal(lines[0], '1 06/09/2026 07/09/2026 - UPI/129166379807/SWIGGY 30.00 0.00 12,345.67');
});

test('rows stay separate, in the order they are read', () => {
  const lines = groupIntoLines([...row(460), ...row(500), ...row(480)]);

  assert.equal(lines.length, 3);
  for (const line of lines) assert.match(line, /^1 06\/09\/2026 .* 12,345\.67$/);
});

test('a cell is placed by where it sits, not by which bin it rounds into', () => {
  // Snapping to a three-point grid split these two: 499.4 rounds to 498 and
  // 501.4 to 501. They are on the same row and belong on the same line.
  const lines = groupIntoLines([
    { x: 130, y: 499.4, height: 8, text: 'left' },
    { x: 560, y: 501.4, height: 8, text: 'right' }
  ]);

  assert.deepEqual(lines, ['left right']);
});

test('a row twenty points below is a row of its own', () => {
  const lines = groupIntoLines([
    { x: 30, y: 500, height: 8, text: 'first' },
    { x: 30, y: 480, height: 8, text: 'second' }
  ]);

  assert.deepEqual(lines, ['first', 'second']);
});

test('cells drifting downwards do not walk one row into the next', () => {
  // Each cell is within tolerance of the one before it, but not of the row's
  // top; measuring from the top is what keeps them apart.
  const lines = groupIntoLines([
    { x: 10, y: 500, height: 8, text: 'a' },
    { x: 20, y: 497, height: 8, text: 'b' },
    { x: 30, y: 494, height: 8, text: 'c' },
    { x: 40, y: 491, height: 8, text: 'd' }
  ]);

  assert.ok(lines.length > 1, 'a drifting run collapsed into one line');
  assert.equal(lines.join(' '), 'a b c d');
});

test('empty cells are dropped rather than padding the line', () => {
  assert.deepEqual(
    groupIntoLines([
      { x: 10, y: 500, height: 8, text: '  ' },
      { x: 20, y: 500, height: 8, text: 'value' },
      { x: 30, y: 500, height: 8, text: '' }
    ]),
    ['value']
  );
});
