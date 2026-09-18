export type Diagnosis = {
  population: string; measure: string; setting: string; access: string;
  months: string; instrument?: string; support?: string; availableSample?: string;
  authorization?: string; requirements?: string;
};
export function diagnose(c: Diagnosis): string[] {
  return [
    ...(!c.population.trim() ? ['Defina a população ou o grupo de estudos elegíveis.'] : []),
    ...(!c.measure.trim() ? ['Escolha um desfecho específico: o que será medido ou extraído dos artigos?'] : []),
    ...(!c.setting.trim() ? ['Delimite o serviço, especialidade, país ou contexto ao qual a pergunta se aplica.'] : []),
    ...(!c.instrument?.trim() ? ['Informe como o desfecho será medido; na revisão, quais medidas serão aceitas.'] : []),
    ...(c.access !== 'literature' && !c.availableSample?.trim() ? ['Estime quantos participantes ou registros são acessíveis; isso ainda não é cálculo amostral.'] : []),
    ...(c.access !== 'literature' && c.authorization !== 'confirmed' ? ['Confirme o acesso ao serviço e planeje as autorizações e a avaliação ética aplicável.'] : []),
    ...(c.support !== 'yes' ? ['Defina quem orientará o método e a análise antes de fechar o protocolo.'] : []),
    ...(Number(c.months) <= 3 ? ['Prazo curto: restrinja o recorte e verifique tempo para seleção, autorizações e execução.'] : []),
  ];
}
export type Protocol = { question: string; objective: string; population: string; outcome: string; studyType: string; variables: string; methods: string; analysis: string };
function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
function mentioned(term: string, text: string) {
  const words = normalize(term).match(/[a-z0-9]+/g)?.filter(word => word.length > 3) || [];
  return !words.length || words.some(word => normalize(text).includes(word));
}
export function protocolChecks(p: Protocol): string[] {
  const checks: string[] = [];
  for (const [label, text] of [['pergunta', p.question], ['objetivo', p.objective]] as const) {
    if (text.trim() && p.population.trim() && !mentioned(p.population, text)) checks.push(`Confira se a ${label} explicita a população registrada.`);
    if (text.trim() && p.outcome.trim() && !mentioned(p.outcome, text)) checks.push(`Confira se a ${label} aborda o desfecho principal registrado.`);
  }
  if (p.outcome.trim() && p.variables.trim() && !mentioned(p.outcome, p.variables)) checks.push('Confira se as variáveis incluem a medida do desfecho principal.');
  if (/transversal/i.test(p.studyType) && /causa\w*|causal\w*|impacto|efeito/i.test(normalize(p.question + ' ' + p.objective))) checks.push('A pergunta usa linguagem de efeito ou causalidade. Em um desenho transversal, considere formular uma associação.');
  if (/revis[aã]o/i.test(p.studyType) && p.methods.trim() && !/busca|bases|descritor|search/i.test(p.methods)) checks.push('Os métodos da revisão ainda não explicitam busca ou bases de dados.');
  if (p.outcome.trim() && !p.analysis.trim()) checks.push('Relacione o desfecho a um plano de análise.');
  return checks;
}
