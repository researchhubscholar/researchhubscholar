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
    // A provisional abstract is allowed before Discussion / Conclusion have been
    // authored, but cannot misrepresent their findings as completed.
    const required: BetaSection[] = ["introduction", "methods", "results"];
    for (const part of required) {
      if (trimmed(saved[part]).length < 80) {
        problems.push("Para preparar o Resumo, complete e salve antes a seção " +
          ({introduction:"Introdução",methods:"Métodos",results:"Resultados",discussion:"Discussão",conclusion:"Conclusão"} as Record<string,string>)[part] + ".");
      }
    }
  }
  return problems;
}

export function missingAbstractSections(saved: SectionContents): BetaSection[] {
  const key: BetaSection[] = ["introduction", "methods", "results", "discussion", "conclusion"];
  return key.filter(section => trimmed(saved[section]).length < 80);
}

export function markProvisionalAbstract(content: string, missing: BetaSection[], language = "pt-BR"): string {
  if (!missing.length) return content.trim();
  const es = language === "es", en = language.startsWith("en");
  const header = en ? "PROVISIONAL ABSTRACT — not ready for submission" :
    es ? "RESUMEN PROVISIONAL — no listo para envío" : "RESUMO PROVISÓRIO — não pronto para submissão";
  const names: Record<string,string> = en ? {
    introduction:"Introduction",methods:"Methods",results:"Results",discussion:"Discussion",conclusion:"Conclusion"
  } : es ? {
    introduction:"Introducción",methods:"Métodos",results:"Resultados",discussion:"Discusión",conclusion:"Conclusión"
  } : {
    introduction:"Introdução",methods:"Métodos",results:"Resultados",discussion:"Discussão",conclusion:"Conclusão"
  };
  const placeholder = (section: BetaSection) => en ? "[" + names[section] + " pending]" :
    es ? "[" + names[section] + " pendiente]" : "[" + names[section] + " pendente]";
  return header + "\n\n" + content.trim() + "\n\n" + missing.map(placeholder).join("\n");
}

function numbersIn(value: string): Set<string> {
  const stripped = value.replace(/\[(?:S\d+|\d+(?:,\s*\d+)*)\]/g, "");
  return new Set((stripped.match(/\b\d+(?:[,.]\d+)?%?\b/g)||[]).map(number => number.replace(",", ".")));
}

/** This only detects invented numeric values. It does not certify the validity
 * of an author-reported result or the model's scientific reasoning. */
export function validateProseDraft(
  section: BetaSection, content: string, saved: SectionContents, project: Record<string, unknown>,
  trustedFacts = "", resultsMode: "data" | "outline" = "data"
): void {
  if (!content.trim() || content.length > 6000) {
    throw new Error("O rascunho retornado está vazio ou excedeu o limite da seção.");
  }
  if (/\[S\d+\]/.test(content)) throw new Error("O texto contém citações sem fontes verificadas.");
  if (section === "results" && (resultsMode === "outline" || (trimmed(saved.results).length < 100 && !trustedFacts.trim()))) {
    // No data were provided. The result must explicitly be a fill-in template.
    if (!/\[(?:a preencher|inserir|informar|preencher|pendente|to fill|to be completed|pending|por completar|completar|dato pendiente)[^\]]*\]/i.test(content)) {
      throw new Error("Sem resultados salvos, a IA só pode preparar um roteiro com campos a preencher.");
    }
  }
  if (["results", "discussion", "conclusion", "abstract"].includes(section)) {
    const trusted = [
      saved.results || "",
      saved.introduction || "",
      saved.methods || "",
      saved.discussion || "",
      saved.conclusion || "",
      trimmed(project.research_question),
      trimmed(project.objective),
      trustedFacts
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


/** Minimize long manuscripts and avoid sending unrelated sections to the AI.
 * Requirements are checked against the full saved versions before trimming. */
export function relevantSavedDraftSections(
  section: BetaSection, saved: SectionContents
): SectionContents {
  const scope: Record<BetaSection, BetaSection[]> = {
    introduction: [],
    methods: [],
    results: ["results"],
    discussion: ["methods","results"],
    limitations: ["methods","results","discussion"],
    conclusion: ["methods","results"],
    abstract: ["introduction","methods","results","discussion","conclusion"]
  };
  const selected: SectionContents = {};
  for (const key of scope[section]) {
    const limit = key==="results" ? 6000 : 3500;
    selected[key]=(saved[key] || "").slice(0,limit);
  }
  return selected;
}


export function manuscriptPlaceholder(language: string) {
  return language === "en" ? "To be completed" : language === "es" ? "Por completar" : "A preencher";
}

export function localizeManuscriptPlaceholders(content: string, language: string) {
  return content.replace(/\[(?:A preencher|To be completed|Por completar)(?=\s*[:\]])/gi,
    "[" + manuscriptPlaceholder(language));
}
