// Turning a PDF into lines of text, in the browser.
//
// pdf.js reports a table row as a stream of disconnected cells. Grouping them
// back into rows is in ./pdf-lines.js, which is pure and therefore testable;
// this file is the part that needs a browser.

import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { groupIntoLines } from './pdf-lines.js';

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

    lines.push(
      ...groupIntoLines(
        content.items.map((item) => ({
          x: item.transform[4],
          y: item.transform[5],
          height: item.height,
          text: item.str
        }))
      )
    );
  }

  await doc.destroy();
  return { lines, text: lines.join('\n'), pages };
}
