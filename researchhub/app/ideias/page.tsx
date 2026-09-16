"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Context = { theme: string; specialty: string; interest: string; population: string; stage: string; months: string; access: string; exposure: string; measure: string; setting: string };
type Idea = { id: string; title: string; question: string; objective: string; studyType: string; population: string; outcome: string; resources: string; difficulty: string; feasibility: string; steps: string; radar: string; methods: string; analysis: string; variables: string };
const initial: Context = { theme: "", specialty: "Cardiologia", interest: "adesão ao tratamento", population: "adultos", stage: "student", months: "6", access: "literature", exposure: "", measure: "", setting: "" };

function generate(c: Context): Idea[] {
  const subject = c.theme.trim() || c.interest;
  const setting = `${c.population} em ${c.setting.trim() || "um contexto definido de " + c.specialty}`;
  const common = { methods: "", analysis: "", variables: "", population: c.population, radar: c.theme.trim() || `${c.specialty} ${c.interest} ${c.population}` };
  const short = Number(c.months) <= 3;
  const support = c.stage === "student" ? "Reserve orientação para delimitar a pergunta e revisar o método." : "Alinhe o projeto com o serviço e a disponibilidade de orientação.";
  const ideas: Idea[] = [{ ...common, id: "review", title: `O que a literatura descreve sobre ${subject} em ${c.population}?`, question: `Quais resultados e limitações são descritos nos estudos sobre ${subject} em ${setting}?`, objective: `Sintetizar os resultados e as limitações dos estudos sobre ${subject} em ${setting}.`, studyType: "Revisão integrativa", outcome: `Resultados relatados nos estudos sobre ${subject}; definir categorias após a leitura inicial.`, resources: "Acesso a bases e textos completos, estratégia de busca e planilha de extração.", difficulty: "Delimitar critérios, avaliar a qualidade e evitar uma síntese apenas descritiva.", feasibility: short ? "Exige um recorte estreito para o prazo informado." : "Compatível com acesso apenas à literatura; o escopo ainda precisa ser validado.", steps: `Comece com uma busca piloto e defina critérios de seleção. ${support}` },
  { ...common, id: "systematic", title: `Síntese estruturada dos estudos sobre ${subject}`, question: `Quais resultados são encontrados nos estudos sobre ${subject} em ${setting}, considerando um desfecho e desenhos previamente definidos?`, objective: `Avaliar criticamente e sintetizar os estudos elegíveis sobre ${subject} em ${setting}.`, studyType: "Revisão sistemática", outcome: "Um desfecho específico, com definição e medida comparáveis entre estudos.", resources: "Protocolo, acesso a mais de uma base, textos completos e apoio para seleção e avaliação crítica.", difficulty: "Verificar revisões existentes, definir uma pergunta precisa e planejar seleção e síntese com rigor.", feasibility: short ? "Prazo curto: considere reduzir o escopo ou ampliar o cronograma." : "Exige equipe, orientação e disponibilidade; não é automaticamente mais simples que pesquisa de campo.", steps: `Verifique revisões recentes antes de propor uma nova síntese. ${support}` }];
  if (c.access === "records" || c.access === "both") ideas.push({ ...common, id: "records", title: `Perfil documentado de ${subject} em ${c.population}`, question: `Como se caracteriza ${subject} nos registros disponíveis de ${setting} durante um período definido?`, objective: `Descrever as características e os resultados documentados relacionados a ${subject} nos registros selecionados.`, studyType: "Observacional transversal", outcome: `Frequência ou distribuição de uma medida relacionada a ${subject}, conforme os campos existentes.`, resources: "Autorização do serviço, avaliação ética aplicável, registros com campos adequados e plano de extração e análise.", difficulty: "Dados ausentes, qualidade dos registros e definição da amostra; o desenho não permite concluir causalidade.", feasibility: short ? "Condicionada a autorizações e dados já disponíveis; o prazo pode ser insuficiente." : "Condicionada à qualidade dos dados, autorizações e volume de registros.", steps: `Confira quais variáveis estão disponíveis antes de fechar a pergunta. ${support}` });
  if (c.access === "patients" || c.access === "both") ideas.push({ ...common, id: "survey", title: `Avaliação de ${subject} em ${c.population}`, question: c.exposure.trim() && c.measure.trim() ? `Qual é a associação entre ${c.exposure} e ${c.measure} em ${setting}?` : `Qual é a frequência ou distribuição de uma medida definida de ${subject} em ${setting}?`, objective: c.exposure.trim() && c.measure.trim() ? `Avaliar a associação entre ${c.exposure} e ${c.measure} em ${setting}.` : `Estimar a frequência ou distribuição da medida escolhida para ${subject} na população selecionada.`, studyType: "Observacional transversal", outcome: c.measure.trim() || `Uma medida de ${subject}, definida com instrumento adequado antes da coleta.`, resources: "Acesso autorizado à população, instrumento adequado, planejamento amostral, consentimento e avaliação ética aplicável.", difficulty: "Recrutamento, viés de seleção e adequação do instrumento à população.", feasibility: short ? "Exige cautela: aprovação e recrutamento podem ultrapassar o prazo informado." : "Depende de recrutamento, aprovação e apoio do serviço.", steps: `Avalie o fluxo de participantes e a disponibilidade de instrumentos. ${support}` });
  return ideas.map(idea => ({ ...idea,
    variables: idea.id === "review" || idea.id === "systematic" ? "Características dos estudos, população, desenho, medidas de resultado e limitações. Definir os campos no protocolo de extração." : [c.exposure.trim() ? `Exposição: ${c.exposure}.` : "Exposição ou condição de interesse: a delimitar.", c.measure.trim() ? `Desfecho: ${c.measure}.` : "Desfecho e forma de medida: a definir.", "Covariáveis: selecionar apenas as relevantes à pergunta e disponíveis para coleta."].join(" "),
    methods: idea.id === "review" || idea.id === "systematic" ? `Definir critérios de elegibilidade para estudos sobre ${subject} em ${setting}. Testar descritores e sinônimos nas bases escolhidas, registrar buscas e selecionar os estudos conforme o protocolo. Extrair medidas de resultado e avaliar criticamente os estudos com método adequado ao desenho.` : idea.id === "records" ? `Delimitar serviço e período dos registros. Verificar disponibilidade e qualidade das variáveis, definir critérios de elegibilidade e planejar extração sem identificação direta. Registrar dados ausentes e submeter o plano às autorizações e avaliações aplicáveis antes do acesso.` : `Definir o local, período e critérios de recrutamento para ${setting}. Planejar a amostra conforme o objetivo, escolher instrumentos adequados à população e registrar exposição e desfecho em uma coleta transversal, após as autorizações e avaliações aplicáveis.`,
    analysis: idea.id === "review" || idea.id === "systematic" ? "Organizar uma síntese por desenho, população e desfecho, distinguindo resultados e limitações. Para revisão sistemática, decidir no protocolo se uma síntese quantitativa é apropriada; não presumir que uma metanálise será possível." : "Descrever a amostra e a distribuição das variáveis. Avaliar a análise de associação quando prevista na pergunta, conforme a natureza dos dados e os pressupostos do método. Planejar tratamento de dados ausentes e possíveis fatores de confusão com apoio do orientador.",
  }));
}

export default function IdeasPage() {
  const [context, setContext] = useState<Context>(initial);
  const [snapshot, setSnapshot] = useState<Context | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const theme = new URLSearchParams(window.location.search).get("tema") || "";
    setContext(c => ({ ...c, theme }));
    async function load() {
      try {
        const db = supabaseBrowser();
        const { data: auth } = await db.auth.getUser();
        if (auth.user) {
          const { data } = await db.from("profiles").select("specialty, training_stage").eq("id", auth.user.id).maybeSingle();
          if (active && data) setContext(c => ({ ...c, specialty: data.specialty || c.specialty, stage: data.training_stage || c.stage }));
        }
      } catch { /* As opções continuam disponíveis sem perfil. */ }
      finally { if (active) setProfileLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);
  function update(key: keyof Context, value: string) { setContext(c => ({ ...c, [key]: value })); }
  const stale = snapshot !== null && JSON.stringify(context) !== JSON.stringify(snapshot);
  function toggle(id: string) {
    if (selected.includes(id)) setSelected(ids => ids.filter(x => x !== id));
    else if (selected.length < 3) { setSelected(ids => [...ids, id]); setMessage(""); }
    else setMessage("Selecione até três ideias para comparar.");
  }
  function projectHref(idea: Idea) {
    const params = new URLSearchParams({ origem: "ideias", tema: idea.title, pergunta: idea.question, objetivo: idea.objective, desenho: idea.studyType, populacao: idea.population, desfecho: idea.outcome, metodos: idea.methods, analise: idea.analysis, variaveis: idea.variables });
    return `/meu-trabalho?${params}`;
  }
  return <div className="max-w-5xl mx-auto">
    <p className="text-xs uppercase tracking-widest text-teal font-semibold">Ideias de pesquisa</p>
    <h1 className="font-display text-4xl md:text-5xl mt-3">Uma ideia que cabe na sua realidade.</h1>
    <p className="text-ink-soft mt-4 max-w-3xl leading-relaxed">Combine seu interesse com o prazo e os recursos disponíveis. Receba propostas estruturadas para discutir com seu orientador e explorar na literatura.</p>
    <section className="mt-7 bg-teal-soft border border-teal/20 rounded-2xl p-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between"><div><p className="text-xs uppercase tracking-wider text-teal">Um ponto de partida concreto</p><h2 className="font-display text-xl mt-2">Como investigar o sono durante a residência?</h2><p className="text-sm text-ink-soft mt-2">Explore o exemplo, ajuste as condições e compare caminhos de execução.</p></div><button disabled={profileLoading} onClick={() => { const example: Context = { ...initial, theme: "Sono e jornada de plantões", specialty: "Educação médica", interest: "qualidade do sono durante a residência", population: "residentes médicos", stage: "resident", months: "6", access: "both", exposure: "número de plantões noturnos por mês", measure: "escore de qualidade do sono", setting: "um programa de residência médica" }; setContext(example); setSnapshot(example); setIdeas(generate(example)); setSelected([]); setEditing(null); setMessage(""); }} className="bg-teal text-white rounded-card px-4 py-3 text-sm font-medium shrink-0 disabled:opacity-50">Explorar exemplo →</button></section>
    <form onSubmit={e => { e.preventDefault(); setSnapshot({ ...context }); setIdeas(generate(context)); setSelected([]); setEditing(null); setMessage(""); }} className="mt-8 bg-white border border-line rounded-2xl p-5 md:p-6">
      <p className="text-xs text-ink-soft mb-4">{profileLoading ? "Carregando preferências do perfil…" : "Área e etapa de formação aproveitam seu perfil quando disponível. Você pode ajustar todos os campos."}</p>
      <div className="grid md:grid-cols-2 gap-4">
        <Text label="Tema vindo do Radar ou tema de interesse" value={context.theme} change={v => update("theme", v)} placeholder="Opcional: sleep quality medical residents" />
        <Text label="Especialidade ou área" value={context.specialty} change={v => update("specialty", v)} required />
        <Text label="Problema que deseja investigar" value={context.interest} change={v => update("interest", v)} required />
        <Text label="População" value={context.population} change={v => update("population", v)} required />
        <Select label="Etapa de formação" value={context.stage} change={v => update("stage", v)} options={[["student", "Estudante"], ["resident", "Residente"], ["postgraduate", "Pós-graduação"], ["other", "Outra etapa"]]} />
        <Select label="Prazo disponível" value={context.months} change={v => update("months", v)} options={[["3", "Até 3 meses"], ["6", "Até 6 meses"], ["12", "Até 12 meses"], ["18", "Mais de 12 meses"]]} />
        <Select label="Acesso disponível" value={context.access} change={v => update("access", v)} options={[["literature", "Apenas literatura"], ["records", "Literatura e registros clínicos"], ["patients", "Literatura e participantes"], ["both", "Literatura, registros e participantes"]]} />
      </div>
      <details className="mt-5 border-t border-line pt-4"><summary className="text-sm text-teal font-medium cursor-pointer">Personalizar a pergunta e as medidas</summary><div className="grid md:grid-cols-2 gap-4 mt-4"><Text label="Condição ou exposição que deseja estudar" value={context.exposure} change={v => update("exposure", v)} placeholder="Ex.: número de plantões noturnos por mês" /><Text label="Resultado que deseja medir" value={context.measure} change={v => update("measure", v)} placeholder="Ex.: escore de qualidade do sono" /><Text label="Local ou contexto do estudo" value={context.setting} change={v => update("setting", v)} placeholder="Ex.: um programa de residência médica" /></div></details>
      <button disabled={profileLoading} className="bg-teal text-white rounded-card px-5 py-3 mt-5 font-medium disabled:opacity-50">{ideas.length ? "Atualizar ideias" : "Explorar caminhos de pesquisa"}</button>
    </form>
    {stale && <p role="status" className="mt-4 bg-amber-soft p-4 rounded-card text-sm">Você alterou o contexto. Clique em Atualizar ideias para gerar propostas com as novas opções.</p>}
    {ideas.length > 0 && <section className="mt-8" aria-label="Ideias sugeridas">
      <div className="flex justify-between flex-wrap gap-3 items-center"><h2 className="font-display text-3xl">Caminhos para avaliar</h2><span className="text-sm text-teal">{selected.length}/3 selecionadas para comparar</span></div>
      <p className="text-xs text-ink-soft mt-3">Propostas iniciais elaboradas com estruturas guiadas, sem geração por IA nesta versão. Não atestam originalidade, viabilidade final ou adequação metodológica. Refine a pergunta e valide a literatura.</p>
      <div className="grid md:grid-cols-2 gap-5 mt-5">{ideas.map((idea, index) => <article key={idea.id} className="bg-white border border-line rounded-2xl p-5 md:p-6 flex flex-col">
        <div className="flex justify-between gap-3"><span className="text-xs text-teal">CAMINHO {index + 1}</span><label className="text-xs flex gap-2 items-center"><input type="checkbox" checked={selected.includes(idea.id)} onChange={() => toggle(idea.id)} />Comparar</label></div>
        <h3 className="font-display text-2xl mt-4 leading-snug">{idea.title}</h3>
        <p className="text-xs bg-teal-soft text-teal rounded-full px-3 py-1 mt-3 self-start">{idea.studyType}</p>
        <dl className="space-y-4 mt-5 text-sm">{[["Pergunta de pesquisa", idea.question], ["Objetivo", idea.objective]].map(([label, value]) => <div key={label}><dt className="font-medium">{label}</dt><dd className="text-ink-soft mt-1 leading-relaxed">{value}</dd></div>)}</dl>
        <p className="text-sm bg-teal-soft rounded-card p-3 mt-5"><span className="font-medium text-teal">Viabilidade no contexto informado</span><span className="block text-ink-soft mt-1">{idea.feasibility}</span></p>
        <details className="mt-5 text-sm flex-1"><summary className="text-teal font-medium cursor-pointer">Explorar a proposta completa</summary><dl className="space-y-4 mt-4">{[["Desfecho", idea.outcome], ["Variáveis", idea.variables], ["Métodos sugeridos", idea.methods], ["Plano de análise inicial", idea.analysis], ["Recursos necessários", idea.resources], ["Dificuldades", idea.difficulty], ["Primeiro passo", idea.steps]].map(([label, value]) => <div key={label}><dt className="font-medium">{label}</dt><dd className="text-ink-soft mt-1 leading-relaxed">{value}</dd></div>)}</dl></details>
        <button onClick={() => setEditing(editing === idea.id ? null : idea.id)} className="self-start text-sm text-teal mt-4">{editing === idea.id ? "Concluir ajustes" : "Ajustar esta proposta"}</button>
        {editing === idea.id && <div className="mt-4 bg-paper border border-line rounded-card p-4 space-y-4">{([ ["Título", "title"], ["Pergunta", "question"], ["Objetivo", "objective"], ["Desfecho", "outcome"], ["Métodos", "methods"], ["Análise", "analysis"] ] as const).map(([label, key]) => <label key={key} className="block text-sm font-medium">{label}<textarea rows={3} value={idea[key]} onChange={e => { const value = e.target.value; setIdeas(list => list.map(x => x.id === idea.id ? { ...x, [key]: value } : x)); }} className="block w-full mt-2 border border-line rounded-card p-3 font-normal" /></label>)}</div>}
        <div className="mt-6 flex gap-3 flex-wrap"><Link href={`/descobrir?tema=${encodeURIComponent(idea.radar)}`} className="text-teal text-sm border border-teal/30 rounded-card px-3 py-2">Validar no Radar</Link><Link aria-disabled={stale} onClick={e => { if (stale) e.preventDefault(); }} href={projectHref(idea)} className={`bg-ink text-white text-sm rounded-card px-3 py-2 ${stale ? "opacity-50" : ""}`}>Levar para Meu projeto →</Link></div>
      </article>)}</div>
    </section>}
    {message && <p role="status" className="mt-4 text-sm text-teal">{message}</p>}
    {selected.length >= 2 && <section className="mt-8 bg-white border border-line rounded-2xl p-5"><h2 className="font-display text-2xl">Compare antes de escolher</h2><div className="overflow-x-auto mt-4"><table className="w-full text-sm text-left"><caption className="sr-only">Comparação das ideias selecionadas</caption><thead><tr><th scope="col" className="p-3">Critério</th>{ideas.filter(x => selected.includes(x.id)).map(x => <th scope="col" key={x.id} className="p-3 min-w-60">{x.title}</th>)}</tr></thead><tbody>{([ ["Desenho", "studyType"], ["Pergunta", "question"], ["Objetivo", "objective"], ["Métodos", "methods"], ["Recursos", "resources"], ["Viabilidade", "feasibility"], ["Dificuldades", "difficulty"] ] as const).map(([label, key]) => <tr key={key} className="border-t border-line"><th scope="row" className="p-3 align-top">{label}</th>{ideas.filter(x => selected.includes(x.id)).map(x => <td key={x.id} className="p-3 align-top text-ink-soft">{x[key]}</td>)}</tr>)}</tbody></table></div></section>}
    {!ideas.length && <div className="mt-8 bg-teal-soft rounded-2xl p-6"><h2 className="font-display text-2xl">Comece pelos recursos que você já tem.</h2><p className="text-sm text-ink-soft mt-3">Sem acesso a participantes ou registros, explore caminhos com literatura. Com acesso ao serviço, avalie também possibilidades observacionais. O prazo e as autorizações precisam entrar na decisão.</p></div>}
  </div>;
}
function Text({ label, value, change, placeholder, required }: { label: string; value: string; change: (v: string) => void; placeholder?: string; required?: boolean }) {
  return <label className="text-sm font-medium">{label}<input required={required} maxLength={300} value={value} onChange={e => change(e.target.value)} placeholder={placeholder} className="block w-full mt-2 border border-line rounded-card px-3 py-3 bg-paper focus:border-teal outline-none" /></label>;
}
function Select({ label, value, change, options }: { label: string; value: string; change: (v: string) => void; options: string[][] }) {
  return <label className="text-sm font-medium">{label}<select value={value} onChange={e => change(e.target.value)} className="block w-full mt-2 border border-line rounded-card px-3 py-3 bg-paper focus:border-teal outline-none">{options.map(([v, title]) => <option key={v} value={v}>{title}</option>)}</select></label>;
}
