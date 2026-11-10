import type { Locale } from "../i18n/locale";
import { exportCopy } from "../i18n/export-copy";
import { wordDocument, type WordBlock } from "../exports/ooxml";
import type { ResultsWorkspace } from "../results/data";
import { resultsWordBlocks, type ExportFigure } from "../results/word";

export type ManuscriptExport = {
  title: string; subtitle: string; authors: string; affiliations: string; keywords: string;
  sections: { section_key: string; heading: string; content: string }[];
  references: string[];
  screening?: { title: string; counts: [string, number][]; exclusionHeaders: string[]; exclusions: string[][] };
  studyTable?: { title: string; headers: string[]; rows: string[][] };
};

const standardHeadings: Record<string, string> = {
  abstract: "Resumo", introduction: "Introdução", methods: "Métodos", results: "Resultados",
  discussion: "Discussão", limitations: "Limitações", conclusion: "Conclusão", references: "Referências",
};

export function manuscriptWordBlocks(input: ManuscriptExport, results?: ResultsWorkspace | null, figure?: ExportFigure | null, locale: Locale = "pt-BR"): WordBlock[] {
  const blocks: WordBlock[] = [{ text: input.title || exportCopy(locale, "Manuscrito"), style: "title" }];
  if (input.subtitle.trim()) blocks.push({ text: input.subtitle, style: "subtitle" });
  for (const text of [input.authors, input.affiliations]) if (text.trim()) blocks.push({ text });
  if (input.keywords.trim()) blocks.push({ text: `${exportCopy(locale, "Palavras-chave:")} ${input.keywords}` });
  const resultMaterial: WordBlock[] = results ? resultsWordBlocks(results, figure, locale) : [];
  if (input.screening) {
    const { title, counts, exclusionHeaders, exclusions } = input.screening;
    resultMaterial.push({ text: title, heading: true }, { table: [[locale === "es" ? "Estado" : "Situação", "N"], ...counts] });
    if (exclusions.length) resultMaterial.push({ table: [exclusionHeaders, ...exclusions] });
  }
  if (input.studyTable?.rows.length) resultMaterial.push(
    { text: input.studyTable.title, heading: true },
    { table: [input.studyTable.headers, ...input.studyTable.rows] },
  );
  let includedResults = false;
  for (const section of input.sections) {
    const text = section.section_key === "references" && input.references.length ? input.references.join("\n\n") : section.content;
    const resultBlocks = section.section_key === "results" ? resultMaterial : [];
    if (!text.trim() && !resultBlocks.length) continue;
    blocks.push({ text: section.heading === standardHeadings[section.section_key] ? exportCopy(locale, section.heading) : section.heading, heading: true });
    if (text.trim()) blocks.push({ text });
    if (resultBlocks.length) { blocks.push(...resultBlocks); includedResults = true; }
  }
  // Keep exports complete even when a custom section list omits a standard section.
  if (!includedResults && resultMaterial.length) blocks.push({ text: exportCopy(locale, "Resultados"), heading: true }, ...resultMaterial);
  if (input.references.length && !input.sections.some(section => section.section_key === "references")) {
    blocks.push({ text: exportCopy(locale, "Referências"), heading: true }, { text: input.references.join("\n\n") });
  }
  return blocks;
}

export function manuscriptDocument(input: ManuscriptExport, results?: ResultsWorkspace | null, figure?: ExportFigure | null, locale: Locale = "pt-BR") {
  return wordDocument(manuscriptWordBlocks(input, results, figure, locale), locale);
}
