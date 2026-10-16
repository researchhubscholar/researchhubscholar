// Small standards-based OOXML writer. ZIP entries use STORE (no compression).
const encoder = new TextEncoder();
const xml = (v: unknown) => String(v ?? "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
function crc32(bytes: Uint8Array) { let crc = -1; for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ -1) >>> 0; }
export function zip(entries: Record<string, string | Uint8Array>): Uint8Array {
  const local: Uint8Array[] = [], central: Uint8Array[] = []; let offset = 0;
  for (const [path, value] of Object.entries(entries)) {
    const name = encoder.encode(path), data = typeof value === "string" ? encoder.encode(value) : value, crc = crc32(data);
    const header = new Uint8Array(30 + name.length), h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); header.set(name, 30);
    const dir = new Uint8Array(46 + name.length), d = new DataView(dir.buffer);
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x800, true); d.setUint32(16, crc, true); d.setUint32(20, data.length, true); d.setUint32(24, data.length, true); d.setUint16(28, name.length, true); d.setUint32(42, offset, true); dir.set(name, 46);
    local.push(header, data); central.push(dir); offset += header.length + data.length;
  }
  const size = central.reduce((n, b) => n + b.length, 0), end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, central.length, true); e.setUint16(10, central.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
  const out = new Uint8Array(offset + size + 22); let pos = 0; for (const chunk of [...local, ...central, end]) { out.set(chunk, pos); pos += chunk.length; } return out;
}
const types = (overrides: string) => `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides}</Types>`;
const rel = (target: string, type: string) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/></Relationships>`;
export function workbook(sheets: { name: string; rows: unknown[][] }[]) {
  const entries: Record<string, string> = {
    "[Content_Types].xml": types(`<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}`),
    "_rels/.rels": rel("xl/workbook.xml", "officeDocument"),
    "xl/workbook.xml": `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xml(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`,
  };
  const column = (n: number): string => n < 26 ? String.fromCharCode(65 + n) : column(Math.floor(n / 26) - 1) + column(n % 26);
  sheets.forEach((s, i) => { entries[`xl/worksheets/sheet${i + 1}.xml`] = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><sheetData>${s.rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => typeof v === "number" && Number.isFinite(v) ? `<c r="${column(c)}${r + 1}"><v>${v}</v></c>` : `<c r="${column(c)}${r + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`; });
  return zip(entries);
}
export type WordBlock = { text: string; heading?: boolean; style?: "title" | "subtitle" } | { table: unknown[][] } | { image: Uint8Array; width: number; height: number; caption: string };
export function wordDocument(blocks: WordBlock[]) {
  const entries: Record<string, string | Uint8Array> = {}; let images = 0;
  const pageWidth = 9638;
  const paragraph = (text: string, style?: string) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
  const body = blocks.map(b => {
    if ("table" in b) {
      if (!b.table.length) return "";
      const columns = Math.max(1, ...b.table.map(row => row.length));
      const weights = Array.from({ length: columns }, (_, i) => Math.max(8, Math.min(24, Math.max(...b.table.map(row => String(row[i] ?? "").length)))));
      const total = weights.reduce((sum, value) => sum + value, 0);
      const widths = weights.map(value => Math.floor(value / total * pageWidth));
      widths[columns - 1] += pageWidth - widths.reduce((sum, value) => sum + value, 0);
      const fontSize = columns >= 8 ? 18 : 20;
      return `<w:tbl><w:tblPr><w:tblW w:w="${pageWidth}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(x => `<w:${x} w:val="single" w:sz="4" w:color="CCD8D4"/>`).join("")}</w:tblBorders></w:tblPr><w:tblGrid>${widths.map(width => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>${b.table.map((row, index) => `<w:tr>${index === 0 ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${widths.map((width, column) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${index === 0 ? '<w:shd w:fill="EDF3F1"/>' : ""}</w:tcPr><w:p><w:pPr><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:sz w:val="${fontSize}"/>${index === 0 ? "<w:b/>" : ""}</w:rPr><w:t xml:space="preserve">${xml(row[column])}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
    }
    if ("image" in b) {
      images++; entries[`word/media/image${images}.png`] = b.image;
      const scale = Math.min(1, 620 / b.width, 800 / b.height);
      const w = Math.round(b.width * scale * 9525), h = Math.round(b.height * scale * 9525);
      return `<w:p><w:pPr><w:keepNext/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline><wp:extent cx="${w}" cy="${h}"/><wp:docPr id="${images}" name="Figura ${images}" descr="${xml(b.caption)}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${images}" name="Figura"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rImg${images}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>${paragraph(b.caption, "Caption")}`;
    }
    const style = b.style === "title" ? "Title" : b.style === "subtitle" ? "Subtitle" : b.heading ? "Heading1" : undefined;
    return b.text.split(/\r?\n/).map(text => paragraph(text, style)).join("");
  }).join("");
  entries["[Content_Types].xml"] = types(`<Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>`);
  entries["_rels/.rels"] = rel("word/document.xml", "officeDocument");
  entries["word/_rels/document.xml.rels"] = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${Array.from({ length: images }, (_, i) => `<Relationship Id="rImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${i + 1}.png"/>`).join("")}</Relationships>`;
  entries["word/styles.xml"] = `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/><w:color w:val="111111"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:after="220"/></w:pPr><w:rPr><w:b/><w:sz w:val="34"/><w:color w:val="000000"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="20"/></w:rPr></w:style></w:styles>`;
  entries["word/document.xml"] = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
  return zip(entries);
}
export function downloadBinary(bytes: Uint8Array, filename: string, type: string) { const buffer = new ArrayBuffer(bytes.length); new Uint8Array(buffer).set(bytes); const url = URL.createObjectURL(new Blob([buffer], { type })); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function htmlWord(html: string) { const doc = new DOMParser().parseFromString(html, "text/html"); const blocks: WordBlock[] = []; for (const node of doc.body.querySelectorAll("h1,h2,h3,p,.field,li,table")) { if (node.closest("table") !== node && node.closest("table")) continue; if (node.tagName === "TABLE") blocks.push({ table: Array.from(node.querySelectorAll("tr")).map(r => Array.from(r.querySelectorAll("th,td")).map(c => c.textContent || "")) }); else blocks.push({ text: node.classList.contains("field") ? Array.from(node.children).map(n=>n.textContent||"").join(": ") : node.textContent || "", heading: /^H/.test(node.tagName) }); } return wordDocument(blocks); }
