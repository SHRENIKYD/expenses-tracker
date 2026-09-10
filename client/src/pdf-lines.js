// Grouping a PDF's text items back into the rows a reader sees.
//
// pdf.js reports a table as a stream of disconnected cells, each with its own
// baseline. The cells of one visual row are close in y but not equal: a
// statement generator nudges each column by a fraction of a point, so a row
// spans a couple of units.
//
// Snapping y to a fixed grid — the first attempt — splits a row in two whenever
// its cells straddle a bin boundary, which for a 24-page statement was most of
// them: the date landed on one line and its amounts on another, and no row ever
// carried both. Rows are clustered by proximity instead, which has no
// boundaries to straddle.

// How far from the top of a row a cell may sit and still belong to it. Rows on
// a statement are ten points apart or more, and cells within one row differ by
// one or two, so this separates them with room to spare.
const nearness = (height) => Math.min(4, Math.max(2, (height || 8) * 0.4));

/**
 * @param {{x: number, y: number, text: string, height?: number}[]} items
 * @returns {string[]} one line per visual row, top to bottom
 */
export function groupIntoLines(items) {
  const cells = items
    .filter((item) => item.text && item.text.trim())
    .sort((a, b) => b.y - a.y);

  const rows = [];
  let current = null;

  for (const cell of cells) {
    // The top of the row decides its extent, so a run of cells drifting
    // downwards cannot walk a row into the one beneath it.
    if (current && current.top - cell.y <= nearness(cell.height)) {
      current.cells.push(cell);
      continue;
    }
    current = { top: cell.y, cells: [cell] };
    rows.push(current);
  }

  return rows.map((row) =>
    row.cells
      .sort((a, b) => a.x - b.x)
      .map((cell) => cell.text.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}
