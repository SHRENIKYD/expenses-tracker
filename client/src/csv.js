// Reading and writing the CSV the Import/export card offers.
//
// Ported from the Express API so the file is built and parsed on the device.
// One column is new: `kind`. The API's export left it out, which quietly turned
// every income row into an expense on the way back in — the reason a salary of
// ₹1,00,000 came back as spending when this data was first moved.

export const COLUMNS = ['date', 'description', 'category', 'amount', 'kind'];
const REQUIRED = ['date', 'description', 'category', 'amount'];

function escapeCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(expenses) {
  const lines = [COLUMNS.join(',')];
  for (const expense of expenses) {
    lines.push(COLUMNS.map((column) => escapeCell(expense[column])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((field) => field.trim() !== ''));
}

export function csvToExpenses(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return { errors: ['file is empty'], records: [] };

  const header = rows[0].map((name) => name.trim().toLowerCase());
  // `kind` is optional so a file exported before this column existed still
  // imports; its rows are read as expenses unless the category says otherwise.
  const missing = REQUIRED.filter((column) => !header.includes(column));
  if (missing.length) {
    return { errors: [`missing column(s): ${missing.join(', ')}`], records: [] };
  }

  const index = Object.fromEntries(COLUMNS.map((column) => [column, header.indexOf(column)]));
  const records = rows.slice(1).map((cells) => ({
    date: (cells[index.date] || '').trim(),
    description: (cells[index.description] || '').trim(),
    category: (cells[index.category] || '').trim().toLowerCase(),
    amount: (cells[index.amount] || '').trim(),
    kind: (cells[index.kind] || '').trim().toLowerCase()
  }));

  return { errors: [], records };
}
