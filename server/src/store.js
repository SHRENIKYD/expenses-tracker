const fs = require('fs/promises');
const path = require('path');

const DATA_FILE = path.resolve(
  __dirname,
  '..',
  process.env.DATA_FILE || './data/expenses.json'
);

let queue = Promise.resolve();

async function readAll() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeAll(expenses) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(expenses, null, 2), 'utf8');
}

function withLock(fn) {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

module.exports = { readAll, writeAll, withLock, DATA_FILE };
