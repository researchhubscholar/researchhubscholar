export function studyFormat(design = "") {
  const value = design.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (/\b(transversal|cross[\s-]sectional)\b/.test(value)) return "transverse";
  if (/\b(casos?\s+[ey]\s+controles|casos?[\s–—-]+control(?:es)?|case[\s–—-]+control)\b/.test(value)) return "caseControl";
  if (/\b(relato de casos?|reporte de casos?|serie de casos|case reports?|case series)\b/.test(value)) return "caseReport";
  if (/\b(meta[\s-]?analy[sz]is|meta[\s-]?anali[sz]e?s)\b|\b(revisao|revision|review)\b.*\bsistematic|\bsystematic review\b/.test(value)) return "systematic";
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
