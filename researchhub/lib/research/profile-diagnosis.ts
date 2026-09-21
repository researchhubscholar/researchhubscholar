export type ScholarProfileDiagnosis = {
  main_goal?: string | null;
  research_experience?: string | null;
  weekly_availability?: string | null;
  project_deadline?: string | null;
  advisor_access?: string | null;
  data_access?: string | null;
  current_research_stage?: string | null;
  main_difficulty?: string | null;
};

export type ProfileDiagnosis = {
  readiness: number;
  title: string;
  focus: string;
  alerts: string[];
  nextAction: string;
};

const stageActions: Record<string, string> = {
  idea: "Delimite o problema, a população e o resultado que pretende observar.",
  question: "Converta o tema em uma pergunta específica e mensurável.",
  literature: "Registre uma estratégia de busca reproduzível e selecione as referências centrais.",
  methods: "Alinhe desenho, população, variáveis e plano de análise.",
  collection: "Confira autorizações, instrumento e rotina de coleta antes de iniciar.",
  analysis: "Relacione cada objetivo às variáveis e análises previstas.",
  writing: "Organize as seções e registre quais resultados sustentam cada conclusão.",
  submission: "Revise normas, autoria, documentos e versão final para entrega.",
};

const difficultyFocus: Record<string, string> = {
  topic: "recorte do tema",
  question: "pergunta de pesquisa",
  advisor: "preparação para orientação",
  literature: "estratégia de busca e leitura",
  methodology: "coerência metodológica",
  statistics: "plano de análise",
  writing: "estrutura da escrita",
  organization: "prioridades e prazos",
  submission: "entrega e submissão",
};

export function buildProfileDiagnosis(profile: ScholarProfileDiagnosis, now = new Date()): ProfileDiagnosis {
  const fields = ["main_goal", "research_experience", "weekly_availability", "advisor_access", "data_access", "current_research_stage", "main_difficulty"] as const;
  const answered = fields.filter((key) => Boolean(profile[key])).length + (profile.project_deadline ? 1 : 0);
  const readiness = Math.round((answered / 8) * 100);
  const alerts: string[] = [];

  if (!profile.advisor_access || profile.advisor_access === "none" || profile.advisor_access === "searching") {
    alerts.push("Transforme as dúvidas abertas em uma pauta objetiva para buscar ou conversar com um orientador.");
  }
  if (profile.data_access === "unknown" || profile.data_access === "none") {
    alerts.push("Confirme a fonte e a disponibilidade dos dados antes de fechar o desenho do estudo.");
  }
  if (profile.weekly_availability === "under_2h") {
    alerts.push("Sua disponibilidade informada é curta; prefira um recorte menor e entregas semanais simples.");
  }
  if (profile.project_deadline) {
    const deadline = new Date(`${profile.project_deadline}T12:00:00Z`);
    const days = Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000);
    if (days < 0) alerts.push("O prazo informado já passou. Atualize a data e reorganize as etapas pendentes.");
    else if (days <= 30) alerts.push("O prazo está próximo. Priorize decisões essenciais e valide o escopo antes de ampliar o projeto.");
  }

  const focus = difficultyFocus[profile.main_difficulty || ""] || "estruturação do projeto";
  const nextAction = stageActions[profile.current_research_stage || "idea"];
  const title = readiness < 60 ? "Complete seu diagnóstico" : alerts.length > 1 ? "Projeto exige decisões de viabilidade" : "Base pronta para avançar";
  return { readiness, title, focus, alerts, nextAction };
}
