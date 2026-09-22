import type { Article } from "./types";

export type StudyDesign = "auto" | "systematic-review" | "clinical-trial" | "cohort" | "case-control" | "cross-sectional" | "qualitative" | "case-report" | "other";

export const studyDesignOptions: [StudyDesign, string][] = [
  ["auto", "Detectar pelos metadados"], ["systematic-review", "Revisão sistemática"], ["clinical-trial", "Ensaio clínico"],
  ["cohort", "Coorte"], ["case-control", "Caso-controle"], ["cross-sectional", "Transversal"],
  ["qualitative", "Qualitativo"], ["case-report", "Relato de caso"], ["other", "Outro desenho"],
];

export function inferStudyDesign(article: Pick<Article, "publicationTypes" | "title">): Exclude<StudyDesign, "auto"> {
  const text = `${article.publicationTypes.join(" ")} ${article.title}`.toLowerCase();
  if (/systematic review|meta-analysis|meta analysis|revis[aã]o sistem[aá]tica/.test(text)) return "systematic-review";
  if (/randomized|randomised|clinical trial|ensaio cl[ií]nico/.test(text)) return "clinical-trial";
  if (/case-control|case control|caso-controle/.test(text)) return "case-control";
  if (/cohort|coorte|longitudinal/.test(text)) return "cohort";
  if (/cross-sectional|cross sectional|transversal/.test(text)) return "cross-sectional";
  if (/qualitative|qualitativo|interview|focus group/.test(text)) return "qualitative";
  if (/case report|case series|relato de caso|s[eé]rie de casos/.test(text)) return "case-report";
  return "other";
}

export function resolvedStudyDesign(article: Pick<Article, "publicationTypes" | "title"> & { studyDesign?: StudyDesign }) {
  return article.studyDesign && article.studyDesign !== "auto" ? article.studyDesign : inferStudyDesign(article);
}

export const designLabels: Record<Exclude<StudyDesign, "auto">, string> = {
  "systematic-review": "Revisão sistemática", "clinical-trial": "Ensaio clínico", cohort: "Coorte",
  "case-control": "Caso-controle", "cross-sectional": "Transversal", qualitative: "Qualitativo",
  "case-report": "Relato de caso", other: "Outro desenho",
};

export function matrixGuidance(design: Exclude<StudyDesign, "auto">) {
  const guidance = {
    "systematic-review": "Registre bases pesquisadas, critérios de elegibilidade, avaliação de qualidade, número de estudos e método de síntese.",
    "clinical-trial": "Registre randomização, intervenção, comparador, perdas, desfechos e análise por intenção de tratar.",
    cohort: "Registre exposição, seguimento, perdas, desfechos, fatores de confusão e ajustes realizados.",
    "case-control": "Registre definição de casos e controles, seleção, exposição prévia, pareamento e controle de confundimento.",
    "cross-sectional": "Registre amostragem, momento da medida, prevalência ou associação e limites de temporalidade.",
    qualitative: "Registre referencial, recrutamento, produção dos dados, saturação, análise e reflexividade.",
    "case-report": "Registre linha do tempo, achados clínicos, intervenção, evolução, consentimento e aprendizado central.",
    other: "Descreva claramente população, desenho, medidas, análise, resultados e limitações.",
  } as const;
  return guidance[design];
}
