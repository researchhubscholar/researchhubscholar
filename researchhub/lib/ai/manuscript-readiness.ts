import { manuscriptAuditSections, type ManuscriptAuditSection } from "./manuscript-coherence";

export type ReadinessIssue = {
  id: string;
  level: "missing" | "review";
  label: string;
  explanation: string;
  section: ManuscriptAuditSection | null;
};
export type ReadinessSection = {
  key: ManuscriptAuditSection;
  characters: number;
  provisional: boolean;
  state: "missing" | "draft" | "provisional" | "written";
};
export type ManuscriptReadiness = {
  sections: ReadinessSection[];
  issues: ReadinessIssue[];
  comparable: number;
  canCompare: boolean;
};

const headings: Record<ManuscriptAuditSection, string> = {
  abstract: "Resumo",
  introduction: "Introdução",
  methods: "Métodos",
  results: "Resultados",
  discussion: "Discussão",
  limitations: "Limitações",
  conclusion: "Conclusão"
};
const pendingPattern = /\[(?:a preencher|a confirmar|inserir|informar|to fill|to confirm|pending|not reported|por completar|dato pendiente)[^\]]{0,140}\]|RESUMO PROVISÓRIO|PROVISIONAL ABSTRACT|RESUMEN PROVISIONAL/i;
const textValue = (value: unknown) => typeof value === "string" ? value.trim() : "";

/**
 * Deterministic, zero-token readiness hints, NOT a scientific validity score.
 * These are intentionally editorial checks; a manuscript can be rigorous even
 * when it does not use conventional section lengths or research designs.
 */
export function assessManuscriptReadiness(
  project: Record<string, unknown>,
  rows: { section_key: string; content: string | null }[]
): ManuscriptReadiness {
  const byKey = new Map(rows.map(row => [row.section_key, textValue(row.content)]));
  const sections: ReadinessSection[] = manuscriptAuditSections.map(key => {
    const content = byKey.get(key) || "";
    const provisional = pendingPattern.test(content);
    const characters = content.length;
    return {
      key, characters, provisional,
      state: !characters ? "missing" : provisional ? "provisional" : characters < 60 ? "draft" : "written"
    };
  });
  const issues: ReadinessIssue[] = [];
  const add = (id: string, level: ReadinessIssue["level"], label: string,
    explanation: string, section: ManuscriptAuditSection | null) =>
    issues.push({ id, level, label, explanation, section });

  if (!textValue(project.research_question))
    add("research-question", "missing", "Pergunta de pesquisa não definida",
      "Registre a pergunta no projeto para permitir a comparação entre objetivo, método e conclusão.", null);
  if (!textValue(project.objective))
    add("objective", "missing", "Objetivo do estudo não definido",
      "Registre o objetivo no protocolo antes de interpretar a coerência das conclusões.", null);
  if (!textValue(project.study_type))
    add("study-type", "review", "Desenho do estudo não identificado",
      "Verifique se o tipo de estudo está definido no protocolo.", null);

  for (const section of sections) {
    if (section.state === "missing") {
      add("section-" + section.key, "missing", headings[section.key] + " ainda não escrito",
        "A auditoria pode comparar seções existentes, mas não avaliar a coerência desta seção vazia.", section.key);
    } else if (section.state === "draft") {
      add("short-" + section.key, "review", headings[section.key] + " com pouco conteúdo",
        "Um trecho muito curto limita a capacidade de detectar inconsistências; confira se é uma versão completa.", section.key);
    } else if (section.state === "provisional") {
      add("provisional-" + section.key, "review", headings[section.key] + " contém campos pendentes",
        "Complete os marcadores editoriais e confira as informações antes de tratar esta seção como final.", section.key);
    }
  }
  // Cautious deterministic cross-check: a percentage in the conclusion that
  // cannot be located in Results deserves a manual check, not a diagnosis.
  const percentages = (value: string) =>
    new Set([...value.matchAll(/\b\d+(?:[.,]\d+)?\s*%/g)]
      .map(match => match[0].replace(/\s/g, "").replace(",", ".")));
  const resultsText = byKey.get("results") || "";
  const conclusionText = byKey.get("conclusion") || "";
  if (resultsText.length >= 60 && conclusionText.length >= 60) {
    const reported = percentages(resultsText);
    const untraced = [...percentages(conclusionText)].filter(value => !reported.has(value));
    if (untraced.length) {
      add("conclusion-percentages", "review", "Conferir percentuais da Conclusão",
        "Estes percentuais não foram localizados literalmente em Resultados: " +
        untraced.slice(0, 3).join(", ") +
        ". Podem ter outra origem ou formatação; confirme os dados antes de utilizá-los.", "conclusion");
    }
  }
  if (conclusionText.length >= 60 && !resultsText.trim()) {
    add("conclusion-without-results", "review", "Conclusão sem Resultados registrados",
      "A conclusão já possui texto, mas a seção Resultados está vazia. Confira se as afirmações têm dados de suporte.", "conclusion");
  }

  const comparable = sections.filter(item => item.characters >= 60).length;
  return { sections, issues, comparable, canCompare: comparable >= 2 };
}
