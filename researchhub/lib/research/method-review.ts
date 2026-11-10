import { studyFormat } from "./study-format";

export type ReviewAlert = { title: string; excerpt?: string; reason: string; question: string };
const clip = (value: string) => value.trim().length > 240 ? value.trim().slice(0, 237) + "…" : value.trim();

export function protocolReview(draft: { studyType: string; inclusion: string; exclusion: string; population: string; variables: string; methods: string; outcome: string; analysis: string }, locale: string): ReviewAlert[] {
  const format = studyFormat(draft.studyType);
  if (!["transverse", "caseControl"].includes(format) && !/observacional|observational|coorte|cohort/i.test(draft.studyType)) return [];
  const es = locale === "es";
  const eligibility = [draft.inclusion, draft.exclusion].filter(s => s.trim()).join(" / ");
  const convenience = /conveni[eê]ncia|conveniencia|convenience/i.test([draft.methods, draft.population, eligibility].join(" "));
  const items: ReviewAlert[] = [];
  if (!eligibility || convenience) items.push({
    title: es ? "Selección de participantes" : "Seleção de participantes",
    excerpt: clip(convenience ? [eligibility, draft.population, draft.methods].find(s => /conveni[eê]ncia|conveniencia|convenience/i.test(s)) || "" : draft.population),
    reason: convenience ? (es ? "El muestreo por conveniencia puede limitar a quién representan los resultados." : "A amostragem por conveniência pode limitar quem os resultados representam.") : (es ? "Los campos de elegibilidad están vacíos." : "Os campos de elegibilidade estão vazios."),
    question: es ? "¿Quién podría quedar fuera y cómo se documentará la selección?" : "Quem pode ficar de fora e como a seleção será documentada?",
  });
  if (!draft.outcome.trim() || !draft.methods.trim()) items.push({
    title: es ? "Medición del desenlace" : "Medição do desfecho", excerpt: clip(draft.outcome || draft.variables),
    reason: es ? "Falta completar el desenlace o los métodos; no se puede revisar cómo se medirá." : "Falta preencher o desfecho ou os métodos; ainda não dá para conferir como ele será medido.",
    question: es ? "¿Qué instrumento, criterio y momento de medición se usarán?" : "Qual instrumento, critério e momento de medição serão usados?",
  });
  if (!/confus|confound|ajust|adjust|estratific|stratif/i.test(draft.analysis)) items.push({
    title: es ? "Factores de confusión" : "Fatores de confusão", excerpt: clip(draft.analysis),
    reason: es ? "El plan no menciona explícitamente la confusión ni cómo se abordará." : "O plano não menciona explicitamente a confusão nem como ela será tratada.",
    question: es ? "¿Qué variables podrían explicar la asociación y cómo se tendrán en cuenta?" : "Quais variáveis poderiam explicar a associação e como serão consideradas?",
  });
  return items;
}

export function manuscriptReview(design: string, conclusion: string, results: string, locale: string): ReviewAlert[] {
  const es = locale === "es";
  const format = studyFormat(design);
  const items: ReviewAlert[] = [];
  if (["transverse", "caseControl", "caseReport"].includes(format)) {
    const causal = conclusion.split(/(?<=[.!?])\s+|\n+/).filter(sentence => {
      const normalized = sentence.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
      return /\b(causou|causo|caused|provocou|provoco|levou a|llevo a|led to|foi responsavel por|fue responsable de)\b/.test(normalized)
        && !/\b(nao|not|cannot|nunca|never|pode|puede|may|might)\b|\bno\s+(se|causo|provoco|llevo|fue|podemos)\b/.test(normalized);
    });
    for (const sentence of causal.slice(0, 2)) items.push({
      title: es ? "Posible afirmación causal" : "Possível afirmação causal", excerpt: clip(sentence),
      reason: es ? "La frase atribuye una causa que este diseño, por sí solo, no permite establecer." : "O trecho atribui uma causa que esse desenho, por si só, não permite estabelecer.",
      question: es ? "¿Cómo describir lo observado sin atribuir causalidad?" : "Como descrever o que foi observado sem atribuir causalidade?",
    });
  }
  if (conclusion.trim() && !results.trim()) items.push({
    title: es ? "Resultados por documentar" : "Resultados a documentar", excerpt: clip(conclusion),
    reason: es ? "La sección de resultados aún no tiene texto para contrastar con la conclusión." : "A seção de resultados ainda não tem texto para conferir a conclusão.",
    question: es ? "¿Qué hallazgo documentado respalda esta conclusión?" : "Qual achado documentado sustenta essa conclusão?",
  });
  return items;
}
