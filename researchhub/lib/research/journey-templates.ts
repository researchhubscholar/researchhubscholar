export type JourneyStep = {
  key: string;
  label: string;
  description: string;
  checklist: string[];
};

const common: JourneyStep[] = [
  { key: "theme", label: "Tema e recorte", description: "Delimite o problema, a população e o contexto.", checklist: ["Problema observado", "População ou contexto", "Recorte compatível com o prazo"] },
  { key: "question", label: "Pergunta e objetivos", description: "Alinhe pergunta, objetivo e desfecho principal.", checklist: ["Pergunta específica", "Objetivo responde à pergunta", "Desfecho mensurável"] },
  { key: "literature", label: "Revisão da literatura", description: "Registre a estratégia e leia criticamente as referências.", checklist: ["Estratégia registrada", "Referências centrais salvas", "Lacuna descrita sem extrapolar os artigos"] },
  { key: "design", label: "Desenho e métodos", description: "Defina desenho, critérios, variáveis e análise.", checklist: ["Desenho compatível", "Critérios explícitos", "Variáveis ligadas aos objetivos"] },
  { key: "ethics", label: "Ética e autorizações", description: "Mapeie consentimento, proteção de dados e aprovações aplicáveis.", checklist: ["Dados identificáveis mapeados", "Autorizações verificadas", "Submissão ética discutida"] },
  { key: "collection", label: "Coleta ou seleção", description: "Planeje recrutamento, extração ou seleção dos estudos.", checklist: ["Fonte definida", "Instrumento testado", "Responsáveis e período registrados"] },
  { key: "analysis", label: "Análise", description: "Relacione variáveis, objetivos e métodos analíticos.", checklist: ["Análise por objetivo", "Dados ausentes considerados", "Apoio estatístico identificado quando necessário"] },
  { key: "writing", label: "Escrita e revisão", description: "Organize resultados, discussão, limitações e referências.", checklist: ["Estrutura definida", "Limitações registradas", "Revisão de autoria planejada"] },
  { key: "submission", label: "Entrega ou submissão", description: "Confira normas, documentos e versão final.", checklist: ["Destino definido", "Normas conferidas", "Versão final aprovada"] },
];

function replace(steps: JourneyStep[], key: string, patch: Partial<JourneyStep>) {
  return steps.map((step) => step.key === key ? { ...step, ...patch } : step);
}

export function getJourneyTemplate(studyType = ""): JourneyStep[] {
  let steps = common.map((step) => ({ ...step, checklist: [...step.checklist] }));
  if (/revisão/i.test(studyType)) {
    steps = replace(steps, "design", { description: "Defina protocolo, bases, critérios e processo de seleção.", checklist: ["Tipo de revisão justificado", "Bases e estratégia definidas", "Critérios de seleção reproduzíveis"] });
    steps = replace(steps, "ethics", { description: "Registre a aplicabilidade ética e o tratamento de documentos e dados.", checklist: ["Necessidade de avaliação ética verificada", "Arquivos e dados protegidos", "Conflitos de interesse previstos"] });
    steps = replace(steps, "collection", { label: "Busca e seleção", description: "Execute a busca e registre o fluxo de seleção dos estudos.", checklist: ["Busca executada e datada", "Duplicados tratados", "Motivos de exclusão registrados"] });
    steps = replace(steps, "analysis", { label: "Síntese das evidências", description: "Compare resultados, qualidade e limitações dos estudos incluídos.", checklist: ["Matriz preenchida", "Qualidade ou risco de viés avaliado", "Divergências explicitadas"] });
  } else if (/relato de caso/i.test(studyType)) {
    steps = replace(steps, "question", { label: "Mensagem e objetivo", description: "Defina o aprendizado clínico central e por que o caso merece ser relatado.", checklist: ["Mensagem central explícita", "Singularidade justificada", "Objetivo compatível com relato de caso"] });
    steps = replace(steps, "design", { label: "Estrutura do caso", description: "Organize linha do tempo, dados clínicos relevantes e discussão.", checklist: ["Linha do tempo", "Dados essenciais anonimizados", "Diagnósticos diferenciais considerados"] });
    steps = replace(steps, "ethics", { description: "Confirme consentimento, anonimização e regras institucionais.", checklist: ["Consentimento verificado", "Identificadores removidos", "Regra institucional conferida"] });
    steps = replace(steps, "collection", { label: "Documentação do caso", description: "Reúna somente informações clínicas necessárias e autorizadas.", checklist: ["Documentos autorizados", "Cronologia conferida", "Imagens anonimizadas quando aplicável"] });
  } else if (/ensaio|coorte|caso-controle|transversal|observacional/i.test(studyType)) {
    steps = replace(steps, "collection", { description: "Planeje recrutamento, instrumento, qualidade e proteção da coleta.", checklist: ["População acessível", "Instrumento testado", "Controle de qualidade e segurança definido"] });
  }
  return steps;
}
