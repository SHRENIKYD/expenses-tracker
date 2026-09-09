// Turning a PDF into lines of text, in the browser.
//
// pdf.js reports a table row as a stream of disconnected cells, so items are
// grouped by their y position and ordered by x: one visual row becomes one
// line, which is what the parser expects.

import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Parsing runs off the main thread, so a long statement does not freeze the UI.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractText(buffer, password) {
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    password: password || undefined,
    isEvalSupported: false,
    useSystemFonts: false
  });

  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    if (err?.name === 'PasswordException') {
      const needsPassword = err.code === 1;
      const error = new Error(
        needsPassword
          ? 'This statement is password protected. Enter the password and try again.'
          : 'That password did not open the statement.'
      );
      error.code = 'password';
      throw error;
    }
    throw new Error('That file could not be read as a PDF.');
  }

  const pages = doc.numPages;
  const lines = [];
  for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();

    const rows = new Map();
    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const key = Math.round(y / 3) * 3;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ x: item.transform[4], text: item.str });
    }

    for (const [, cells] of [...rows.entries()].sort((a, b) => b[0] - a[0])) {
      lines.push(
        cells
          .sort((a, b) => a.x - b.x)
          .map((cell) => cell.text.trim())
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
      );
    }
  }

  await doc.destroy();
  return { lines, text: lines.join('\n'), pages };
}
