import test from 'node:test';
import assert from 'node:assert/strict';

import { groupIntoLines } from '../src/pdf-lines.js';
import { detectBank, parseStatement } from '../src/statement.js';

// The whole path, on a real PDF read by the real pdf.js: cells at the
// coordinates a statement generator writes them to, grouped back into rows,
// parsed into transactions. The unit tests use hand-built items, which cannot
// catch a wrong assumption about what pdf.js reports.
//
// The library is loaded through its legacy build, the one that runs outside a
// browser; the app loads the browser build, and the code under test is the same
// either way.
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

// A one-page PDF that places every cell at an exact baseline.
function buildPdf(cells) {
  const stream = cells
    .map(
      ({ x, y, text }) =>
        `BT /F1 8 Tf 1 0 0 1 ${x} ${y} Tm (${text.replace(/([()\\])/g, '\\$1')}) Tj ET`
    )
    .join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (const [index, body] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  }
  const startxref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

  return Uint8Array.from(pdf, (character) => character.charCodeAt(0) & 0xff);
}

async function linesFrom(cells) {
  const doc = await pdfjs.getDocument({
    data: buildPdf(cells),
    isEvalSupported: false,
    useSystemFonts: false
  }).promise;
  const content = await (await doc.getPage(1)).getTextContent();
  const lines = groupIntoLines(
    content.items.map((item) => ({
      x: item.transform[4],
      y: item.transform[5],
      height: item.height,
      text: item.str
    }))
  );
  await doc.destroy();
  return lines;
}

const X = [30, 60, 130, 200, 230, 560, 640, 720];
// No two columns of a row share a baseline, which is the case that broke.
const NUDGE = [0, 0.4, -0.6, 0.9, -0.4, 1.4, -1.1, 0.6];

const HEADER = [
  { x: 30, y: 560, text: 'Statement of Transactions in Saving Account no. 318301508036 in INR' },
  { x: 30, y: 545, text: 'ICICI BANK LIMITED, ICICIBANKLTD., HSG-J-KIADB' },
  ...['S No.', 'Value Date', 'Transaction Date', 'Cheque Number', 'Transaction Remarks',
    'Withdrawal Amount (INR)', 'Deposit Amount (INR)', 'Balance (INR)'
  ].map((text, index) => ({ x: X[index], y: 530 + NUDGE[index], text }))
];

const ROWS = [
  ['1', '06/09/2026', '07/09/2026', '-', 'UPI/129166379807/Payment/SWIGGY', '30.00', '0.00', '12,345.67'],
  ['2', '07/09/2026', '07/09/2026', '-', 'MMT/IMPS/629012345678/ACME PAYROLL SALARY', '0.00', '90,000.00', '1,02,345.67'],
  ['3', '08/09/2026', '08/09/2026', '-', 'UPI/994137/Payment to merchant', '22,819.00', '0.00', '79,526.67']
];

const STATEMENT = [
  ...HEADER,
  ...ROWS.flatMap((row, position) =>
    row.map((text, column) => ({ x: X[column], y: 500 - position * 20 + NUDGE[column], text }))
  )
];

test('a statement PDF becomes one line per row', async () => {
  const lines = await linesFrom(STATEMENT);

  assert.equal(lines.length, 6, 'two header lines, a column header, three rows');
  assert.equal(
    lines[3],
    '1 06/09/2026 07/09/2026 - UPI/129166379807/Payment/SWIGGY 30.00 0.00 12,345.67'
  );
});

test('and those rows become transactions', async () => {
  const lines = await linesFrom(STATEMENT);

  assert.deepEqual(detectBank(lines.join('\n')), { code: 'icici', name: 'ICICI Bank' });

  const { transactions, skipped } = parseStatement(lines);
  assert.equal(skipped.length, 0);
  assert.deepEqual(
    transactions.map((row) => [row.date, row.kind, row.amount, row.category]),
    [
      ['2026-09-07', 'expense', 30, 'food'],
      ['2026-09-07', 'income', 90000, 'salary'],
      ['2026-09-08', 'expense', 22819, 'other']
    ]
  );
  assert.equal(transactions[0].reference, '129166379807');
});
