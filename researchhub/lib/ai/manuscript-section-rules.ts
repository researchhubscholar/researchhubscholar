/** Guardrails for multi-section manuscript drafting. Article citation grounding
 * is handled separately; the sections below rely on saved, author-supplied data. */
export type BetaSection = "introduction" | "methods" | "results" | "discussion" | "limitations" | "conclusion" | "abstract";
export type SectionContents = Partial<Record<BetaSection, string>>;
export const proseDraftSections: BetaSection[] = ["methods", "results", "limitations", "conclusion", "abstract"];
export const literatureDraftSections: BetaSection[] = ["introduction", "discussion"];

const trimmed = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function sectionDraftRequirements(
  section: BetaSection, project: Record<string, unknown>, saved: SectionContents
): string[] {
  const problems: string[] = [];
  if (!trimmed(project.research_question) || !trimmed(project.objective)) {
    problems.push("Defina a pergunta e o objetivo do projeto antes de utilizar a escrita automática.");
  }
  if (section === "methods" && (!trimmed(project.study_type) || !trimmed(project.methods))) {
    problems.push("Para Métodos, defina o tipo de estudo e o plano metodológico no protocolo.");
  }
  if (section === "discussion" || section === "conclusion") {
    if (trimmed(saved.results).length < 100) problems.push("Salve primeiro os resultados efetivamente obtidos no manuscrito.");
  }
  if (section === "discussion" && trimmed(saved.methods).length < 80) {
    problems.push("Salve também a seção Métodos para contextualizar corretamente os resultados.");
  }
  if (section === "abstract") {
    const required: BetaSection[] = ["introduction", "methods", "results", "discussion", "conclusion"];
    for (const part of required) {
      if (trimmed(saved[part]).length < 80) {
        problems.push("Para preparar o Resumo, complete e salve antes a seção " +
          ({introduction:"Introdução",methods:"Métodos",results:"Resultados",discussion:"Discussão",conclusion:"Conclusão"} as Record<string,string>)[part] + ".");
      }
    }
  }
  return problems;
}

function numbersIn(value: string): Set<string> {
  const stripped = value.replace(/\[(?:S\d+|\d+(?:,\s*\d+)*)\]/g, "");
  return new Set((stripped.match(/\b\d+(?:[,.]\d+)?%?\b/g)||[]).map(number => number.replace(",", ".")));
}

/** This only detects invented numeric values. It does not certify the validity
 * of an author-reported result or the model's scientific reasoning. */
export function validateProseDraft(
  section: BetaSection, content: string, saved: SectionContents, project: Record<string, unknown>
): void {
  if (!content.trim() || content.length > 6000) {
    throw new Error("O rascunho retornado está vazio ou excedeu o limite da seção.");
  }
  if (/\[S\d+\]/.test(content)) throw new Error("O texto contém citações sem fontes verificadas.");
  if (section === "results" && trimmed(saved.results).length < 100) {
    // No data were provided. The result must explicitly be a fill-in template.
    if (!/\[(?:a preencher|inserir|informar|preencher|pendente|to fill|pending|por completar|completar|dato pendiente)[^\]]*\]/i.test(content)) {
      throw new Error("Sem resultados salvos, a IA só pode preparar um roteiro com campos a preencher.");
    }
  }
  if (["results", "discussion", "conclusion", "abstract"].includes(section)) {
    const trusted = [
      saved.results || "",
      saved.methods || "",
      saved.discussion || "",
      saved.conclusion || "",
      trimmed(project.research_question),
      trimmed(project.objective)
    ].join("\n");
    const existing = numbersIn(trusted);
    const invented = [...numbersIn(content)].filter(number => !existing.has(number));
    if (invented.length) {
      throw new Error("O texto acrescentou números não presentes nos dados salvos: " + invented.slice(0,5).join(", ") + ".");
    }
  }
}

export function cleanSavedDraftSections(
  rows: Array<{section_key:string;content:string|null}>
): SectionContents {
  const result: SectionContents = {};
  for (const row of rows) {
    if (["abstract","introduction","methods","results","discussion","limitations","conclusion"].includes(row.section_key)) {
      result[row.section_key as BetaSection] = trimmed(row.content).slice(0,12000);
    }
  }
  return result;
}
