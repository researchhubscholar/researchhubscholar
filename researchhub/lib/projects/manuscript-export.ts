import { wordDocument, type WordBlock } from "../exports/ooxml";
import type { ResultsWorkspace } from "../results/data";
import { resultsWordBlocks, type ExportFigure } from "../results/word";

export type ManuscriptExport = {
  title: string; subtitle: string; authors: string; affiliations: string; keywords: string;
  sections: { section_key: string; heading: string; content: string }[];
  references: string[];
};

export function manuscriptWordBlocks(input: ManuscriptExport, results?: ResultsWorkspace | null, figure?: ExportFigure | null): WordBlock[] {
  const blocks: WordBlock[] = [{ text: input.title || "Manuscrito", style: "title" }];
  if (input.subtitle.trim()) blocks.push({ text: input.subtitle, style: "subtitle" });
  for (const text of [input.authors, input.affiliations]) if (text.trim()) blocks.push({ text });
  if (input.keywords.trim()) blocks.push({ text: `Palavras-chave: ${input.keywords}` });
  let includedResults = false;
  for (const section of input.sections) {
    const text = section.section_key === "references" && input.references.length ? input.references.join("\n\n") : section.content;
    const resultBlocks = section.section_key === "results" && results ? resultsWordBlocks(results, figure) : [];
    if (!text.trim() && !resultBlocks.length) continue;
    blocks.push({ text: section.heading, heading: true });
    if (text.trim()) blocks.push({ text });
    if (resultBlocks.length) { blocks.push(...resultBlocks); includedResults = true; }
  }
  // Keep exports complete even when a custom section list omits a standard section.
  if (results && !includedResults) {
    const resultBlocks = resultsWordBlocks(results, figure);
    if (resultBlocks.length) blocks.push({ text: "Resultados", heading: true }, ...resultBlocks);
  }
  if (input.references.length && !input.sections.some(section => section.section_key === "references")) {
    blocks.push({ text: "Referências", heading: true }, { text: input.references.join("\n\n") });
  }
  return blocks;
}

export function manuscriptDocument(input: ManuscriptExport, results?: ResultsWorkspace | null, figure?: ExportFigure | null) {
  return wordDocument(manuscriptWordBlocks(input, results, figure));
}
