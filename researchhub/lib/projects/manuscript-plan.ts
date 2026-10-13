export type ManuscriptProject = {
  objective?: string | null; research_question?: string | null; study_type?: string | null;
  population?: string | null; inclusion_criteria?: string | null; exclusion_criteria?: string | null;
  primary_outcome?: string | null; variables?: string | null; methods?: string | null;
  analysis_plan?: string | null; ethics_notes?: string | null;
};

export function manuscriptPlan(project: ManuscriptProject) {
  const line = (label: string, value?: string | null) => `${label}: ${value?.trim() || "[A preencher e confirmar]"}`;
  return {
    introduction: ["[Desenvolver o contexto com referências verificadas]", line("Pergunta de pesquisa", project.research_question), "[Explicitar a lacuna após revisar a literatura]", line("Objetivo", project.objective)].join("\n\n"),
    methods: ["PLANEJAMENTO DO PROTOCOLO — confirmar o que foi efetivamente realizado antes da submissão.", line("Desenho", project.study_type), line("População", project.population), line("Inclusão", project.inclusion_criteria), line("Exclusão", project.exclusion_criteria), line("Desfecho principal", project.primary_outcome), line("Variáveis", project.variables), line("Procedimentos previstos", project.methods), line("Análise prevista", project.analysis_plan), line("Ética e autorizações previstas", project.ethics_notes)].join("\n\n"),
    discussion: "[Interpretar somente os resultados obtidos]\n\n[Comparar os achados com referências verificadas]\n\n[Discutir implicações compatíveis com o desenho]",
    limitations: "[Registrar vieses, dados ausentes e limites de generalização identificados durante a execução]",
  };
}

export function applyManuscriptPlan<T extends { section_key: string; content: string }>(sections: T[], plan: Record<string, string>, selected: string[]) {
  return sections.map(section => selected.includes(section.section_key) && !section.content.trim() && plan[section.section_key]
    ? { ...section, content: plan[section.section_key] } : section);
}
