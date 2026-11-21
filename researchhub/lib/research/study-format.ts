export function studyFormat(design = "") {
  const value = design.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const review = explicitReviewMode(design);
  if (review) return review === "systematic" ? "systematic" : "review";
  if (/\b(meta[\s-]?analy[sz]is|meta[\s-]?anali[sz]e?s)\b|\b(revisao|revision|review)\b.*\bsistematic|\bsystematic review\b/.test(value)) return "systematic";
  if (/\b(transversal|cross[\s-]sectional)\b/.test(value)) return "transverse";
  if (/\b(casos?\s+[ey]\s+controles|casos?[\s–—-]+control(?:e|es)?|case[\s–—-]+control)\b/.test(value)) return "caseControl";
  if (/\b(relato de casos?|reporte de casos?|serie de casos|case reports?|case series)\b/.test(value)) return "caseReport";
  if (/\b(revisao|revision|review)\b(?!\s+(de\s+(prontuarios?|registros?|historias clinicas)|of\s+(medical\s+)?records?|chart))/.test(value) && !/\b(chart review|record review|coorte|cohort|ensaio|trial|observacional|observational)\b/.test(value)) return "review";
  return "general";
}

export function studyFormatText(design: string, locale: string) {
  const es = locale === "es";
  const formats = {
    transverse: es ? "Tabla de datos y resultados descriptivos" : "Tabela de dados e resultados descritivos",
    caseControl: es ? "Tabla de datos y comparación de casos y controles" : "Tabela de dados e comparação entre casos e controles",
    caseReport: es ? "Cronología del caso" : "Linha do tempo do caso",
    systematic: es ? "Selección y matriz de estudios" : "Triagem e matriz de estudos",
    review: es ? "Matriz de estudios" : "Matriz de estudos",
    general: es ? "Editor general de resultados" : "Editor geral de resultados",
  };
  return `${es ? "Tipo de estudio" : "Tipo de estudo"}: ${design.trim() || (es ? "Sin definir" : "Não definido")} · Formato de resultados: ${formats[studyFormat(design)]}`;
}

export const reviewModes = ["narrative", "systematic", "scoping"] as const;
export type ReviewMode = typeof reviewModes[number];

export function explicitReviewMode(design: string): ReviewMode | undefined {
  const value = design.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
  if (/^(?:(?:revisao|revision) sistematica|systematic review)(?:\b|$)/.test(value)) return "systematic";
  if (/^(?:(?:revisao|revision) narrativa|narrative review)(?:\b|$)/.test(value)) return "narrative";
  if (/^(?:(?:revisao|revision) de (?:escopo|alcance)|scoping review)(?:\b|$)/.test(value)) return "scoping";
}

export function reviewModeLabel(mode: ReviewMode, locale: string) {
  return (locale === "es"
    ? { narrative: "Revisión narrativa", systematic: "Revisión sistemática", scoping: "Revisión de alcance" }
    : { narrative: "Revisão narrativa", systematic: "Revisão sistemática", scoping: "Revisão de escopo" })[mode];
}

export function reviewProtocolGuidance(mode: ReviewMode, locale: string) {
  return (locale === "es" ? {
    narrative: ["Delimita el tema y la pregunta orientadora.", "Describe las fuentes y cómo organizarás la síntesis crítica por temas."],
    systematic: ["Estructura la pregunta con PICO u otro marco adecuado. Define criterios de elegibilidad.", "Planifica la búsqueda reproducible, la selección, la extracción, el riesgo de sesgo y la síntesis."],
    scoping: ["Formula la pregunta con población, concepto y contexto (PCC).", "Define criterios, fuentes y campos para el mapeo de evidencias y vacíos."],
  } : {
    narrative: ["Delimite o tema e a pergunta orientadora.", "Descreva as fontes e como vai organizar a síntese crítica por temas."],
    systematic: ["Estruture a pergunta com PICO ou outra estrutura adequada. Defina critérios de elegibilidade.", "Planeje a busca reproduzível, a seleção, a extração, o risco de viés e a síntese."],
    scoping: ["Formule a pergunta com população, conceito e contexto (PCC).", "Defina critérios, fontes e campos para mapear evidências e lacunas."],
  })[mode];
}
