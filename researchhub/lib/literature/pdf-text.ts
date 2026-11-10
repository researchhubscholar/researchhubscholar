export const pdfReadingLimits = { pages: 40, characters: 18000 };
export type PdfTextPage = { page: number; text: string };
export const normalizePdfText = (text: string) => text.normalize("NFKC").replace(/\s+/g, " ").trim();

export async function extractPdfText(file: Blob) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false, disableFontFace: true, useSystemFonts: false });
  try {
    const doc = await task.promise;
    const pages: PdfTextPage[] = [];
    let remaining = pdfReadingLimits.characters, clipped = false, inspected = 0;
    for (let page = 1; page <= Math.min(doc.numPages, pdfReadingLimits.pages) && remaining > 0; page++) {
      const item = await doc.getPage(page);
      const content = await item.getTextContent();
      const text = normalizePdfText(content.items.map(value => "str" in value ? value.str : "").join(" "));
      item.cleanup();
      inspected = page;
      if (!text) continue;
      clipped ||= text.length > remaining;
      pages.push({ page, text: text.slice(0, remaining) });
      remaining -= text.length;
    }
    return { pages, totalPages: doc.numPages, partial: clipped || inspected < doc.numPages || pages.length < inspected };
  } finally { await task.destroy(); }
}
