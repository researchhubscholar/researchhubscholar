"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";

import { Context, Idea, initial, generate, ideaBrief, referenceSignature } from "@/lib/ideas/generate";
import { useLibrary } from "@/lib/literature/use-library";
import { transferKey } from "@/lib/ideas/transfer";
import { useRouter } from "next/navigation";

export default function IdeasPage() {
  const library = useLibrary();
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const projectRequest = useRef(0);
  const previousOwner = useRef<string | null>(null);
  const touched = useRef(new Set<string>());
  const [referenceIds, setReferenceIds] = useState<string[]>([]);
  const [referenceQuery, setReferenceQuery] = useState("");
  const [allReferences, setAllReferences] = useState(false);
  const [referenceLimit, setReferenceLimit] = useState(20);
  const [evidenceSnapshot, setEvidenceSnapshot] = useState("");
  const evidence = library.articles.filter(article => referenceIds.includes(article.id)).map(article => ({ article, note: library.notes[article.id] || {} }));
  const signature = referenceSignature(evidence);
  const referenceOptions = library.articles.filter(article => (!projectId || allReferences || article.projectId === projectId) && `${article.title} ${article.authors.join(" ")} ${article.doi || ""} ${article.pmid || ""}`.toLowerCase().includes(referenceQuery.toLowerCase()));
  const [context, setContext] = useState<Context>(initial);
  const [snapshot, setSnapshot] = useState<Context | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setContext(c => ({ ...c, theme: params.get("tema") || "" }));
    setProjectId(params.get("projeto") || "");
  }, []);
  useEffect(() => {
    if (previousOwner.current && previousOwner.current !== library.userId) {
      setIdeas([]); setSnapshot(null); setReferenceIds([]); setSelected([]); setProjectId("");
      setContext({ ...initial }); setMessage(""); setProjectError(""); touched.current.clear();
    }
    previousOwner.current = library.userId;
    ++projectRequest.current; setProjectLoading(false);
  }, [library.userId]);
  useEffect(() => {
    let active = true;
    if (library.loading) return;
    if (!library.userId) { setProfileLoading(false); return; }
    setProfileLoading(true);
    async function load() {
      try {
        const { data } = await supabaseBrowser().from("profiles").select("specialty, training_stage").eq("id", library.userId!).maybeSingle();
        if (active && data) setContext(c => ({ ...c, specialty: touched.current.has("specialty") ? c.specialty : data.specialty || c.specialty, stage: touched.current.has("stage") ? c.stage : data.training_stage || c.stage }));
      } finally { if (active) setProfileLoading(false); }
    }
    void load().catch(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [library.userId, library.loading]);
  function update(key: keyof Context, value: string) { touched.current.add(key); setContext(c => ({ ...c, [key]: value })); }
  const stale = snapshot !== null && (JSON.stringify(context) !== JSON.stringify(snapshot) || evidenceSnapshot !== signature);
  async function applyProject() {
    if (!projectId || !library.userId || projectLoading) return;
    const request = ++projectRequest.current; setProjectLoading(true); setProjectError("");
    try {
      const { data, error } = await supabaseBrowser().from("research_projects").select("theme,title,research_question,population,primary_outcome").eq("id", projectId).eq("owner_id", library.userId).maybeSingle();
      if (request !== projectRequest.current) return;
      if (error || !data) throw new Error("Não foi possível carregar este projeto da sua conta.");
      setContext(c => ({ ...c, theme: data.theme || data.title || "", interest: data.research_question || "", population: data.population || "", measure: data.primary_outcome || "", exposure: "", setting: "", uncertainty: "", startingQuestion: data.research_question || "" }));
      setMessage("Contexto carregado. Ajuste problema, prazo e recursos antes de explorar as propostas. O projeto salvo permanece como está.");
    } catch (error) { if (request === projectRequest.current) setProjectError(error instanceof Error ? error.message : "Não foi possível carregar o projeto."); }
    finally { if (request === projectRequest.current) setProjectLoading(false); }
  }
  function toggleReference(id: string) {
    if (referenceIds.includes(id)) setReferenceIds(ids => ids.filter(value => value !== id));
    else if (referenceIds.length < 10) { setReferenceIds(ids => [...ids, id]); setMessage(""); }
    else setMessage("Selecione até dez referências para manter a proposta focada.");
  }
  function explore(c: Context, useEvidence = evidence) {
    setSnapshot({ ...c }); setEvidenceSnapshot(referenceSignature(useEvidence));
    setIdeas(generate(c, useEvidence)); setSelected([]); setEditing(null); setMessage("");
  }
  function download(idea: Idea) {
    const url = URL.createObjectURL(new Blob([ideaBrief(idea)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "proposta-scholar.txt"; link.click(); URL.revokeObjectURL(url);
  }
  function transfer(idea: Idea) {
    if (stale || library.loading) return;
    try {
      const token = crypto.randomUUID();
      sessionStorage.setItem(transferKey(library.userId, token), JSON.stringify({ ownerId: library.userId, draft: { theme: idea.title, question: idea.question, objective: idea.objective, studyType: idea.studyType, population: idea.population, outcome: idea.outcome, methods: idea.methods, analysis: idea.analysis, variables: idea.variables, manuscript: ideaBrief(idea) }, referenceIds: idea.references.map(reference => reference.id) }));
      router.push(`/meu-trabalho?origem=ideias&proposta=${encodeURIComponent(token)}`);
    } catch { setMessage("Não foi possível preparar a proposta neste navegador. Baixe o resumo para preservar o conteúdo e tente novamente."); }
  }
  function toggle(id: string) {
    if (selected.includes(id)) setSelected(ids => ids.filter(x => x !== id));
    else if (selected.length < 3) { setSelected(ids => [...ids, id]); setMessage(""); }
    else setMessage("Selecione até três ideias para comparar.");
  }
  return <div className="max-w-5xl mx-auto">
    <p className="text-xs uppercase tracking-widest text-teal font-semibold">Ideias de pesquisa</p>
    <h1 className="font-display text-4xl md:text-5xl mt-3">Uma ideia que cabe na sua realidade.</h1>
    <p className="text-ink-soft mt-4 max-w-3xl leading-relaxed">Combine seu interesse com o prazo e os recursos disponíveis. Receba propostas estruturadas para discutir com seu orientador e explorar na literatura.</p>
    <section className="mt-7 bg-teal-soft border border-teal/20 rounded-2xl p-5 flex flex-col md:flex-row gap-4 md:items-center md:justify-between"><div><p className="text-xs uppercase tracking-wider text-teal">Um ponto de partida concreto</p><h2 className="font-display text-xl mt-2">Como investigar o sono durante a residência?</h2><p className="text-sm text-ink-soft mt-2">Explore o exemplo, ajuste as condições e compare caminhos de execução.</p></div><button disabled={profileLoading || library.loading || projectLoading} onClick={() => { const example: Context = { ...initial, theme: "Sono e jornada de plantões", specialty: "Educação médica", interest: "qualidade do sono durante a residência", population: "residentes médicos", stage: "resident", months: "6", access: "both", exposure: "número de plantões noturnos por mês", measure: "escore de qualidade do sono", setting: "um programa de residência médica" }; setContext(example); setProjectId(""); setReferenceIds([]); explore(example, []); }} className="bg-teal text-white rounded-card px-4 py-3 text-sm font-medium shrink-0 disabled:opacity-50">Explorar exemplo →</button></section>
    <section className="mt-6 bg-white border border-line rounded-2xl p-5 md:p-6">
      <p className="text-xs uppercase tracking-wider text-teal">Conecte seu trabalho</p>
      <h2 className="font-display text-2xl mt-2">Comece pelo projeto e pelas leituras que você já tem.</h2>
      {library.loading ? <p role="status" className="mt-4 text-sm text-ink-soft">Carregando projetos e biblioteca...</p> : !library.userId ? <p className="mt-4 text-sm text-ink-soft">Você pode explorar propostas sem entrar. <Link href="/login" className="text-teal underline">Entre na sua conta</Link> para usar projetos, artigos e anotações salvos.</p> : <>
        <div className="flex flex-wrap gap-3 items-end mt-5">
          <label className="text-sm font-medium flex-1">Projeto de referência<select value={projectId} onChange={e => { ++projectRequest.current; setProjectLoading(false); setProjectId(e.target.value); setReferenceIds([]); setReferenceLimit(20); }} className="block w-full border border-line rounded-card px-3 py-3 mt-2"><option value="">Explorar sem projeto existente</option>{library.projects.map(project => <option key={project.id} value={project.id}>{project.title || project.theme || "Projeto sem título"}</option>)}</select></label>
          <button disabled={!projectId || projectLoading} type="button" onClick={applyProject} className="border border-teal/30 text-teal px-4 py-3 rounded-card text-sm disabled:opacity-50">{projectLoading ? "Carregando..." : "Usar contexto deste projeto"}</button>
        </div>
        <p className="text-xs text-ink-soft mt-3">Carrega tema, população, desfecho e pergunta atual. O projeto salvo não é alterado ao explorar ideias.</p>
        {projectError && <p role="alert" className="mt-3 text-sm text-red-700">{projectError}</p>}
        <details open className="mt-5 border-t border-line pt-4">
          <summary className="text-sm text-teal font-medium cursor-pointer">Escolher referências da biblioteca · {referenceIds.length}/10 selecionadas</summary>
          <div className="flex flex-wrap gap-3 items-center mt-4"><input aria-label="Buscar referências para as ideias" value={referenceQuery} onChange={e => { setReferenceQuery(e.target.value); setReferenceLimit(20); }} placeholder="Buscar por título, autor ou identificador" className="flex-1 min-w-0 border border-line rounded-card px-3 py-2" />{projectId && <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={allReferences} onChange={e => { setAllReferences(e.target.checked); setReferenceLimit(20); }} />Mostrar toda a biblioteca</label>}<button type="button" onClick={() => setReferenceIds([])} className="text-xs text-teal underline">Limpar seleção</button></div>
          <p className="text-xs text-ink-soft mt-3">Selecione as leituras relevantes. Suas anotações salvas na matriz acompanham as referências; resumos e títulos precisam ser conferidos antes de sustentar a justificativa.</p>
          <div className="mt-4 space-y-3 max-h-[480px] overflow-y-auto">{referenceOptions.slice(0, referenceLimit).map(article => <div key={article.id} className="border border-line rounded-card p-3">
            <label className="flex gap-3 items-start text-sm"><input type="checkbox" checked={referenceIds.includes(article.id)} onChange={() => toggleReference(article.id)} className="mt-1" /><span><span className="font-medium">{article.title}</span><span className="block text-xs text-ink-soft mt-1">{article.year || "Ano não informado"} · {article.pmid ? `PMID ${article.pmid}` : `DOI ${article.doi}`} · {article.abstract ? "Com resumo" : "Sem resumo"}{Object.values(library.notes[article.id] || {}).some(value => value?.trim()) ? " · Com anotações na matriz" : ""}</span></span></label>
            <details className="ml-6 mt-2 text-xs text-ink-soft"><summary className="text-teal cursor-pointer">Conferir resumo e anotações</summary>{article.abstract ? <p className="mt-2 leading-relaxed">{article.abstract}</p> : <p className="mt-2">Resumo não disponível.</p>}{Object.entries(library.notes[article.id] || {}).filter(([, value]) => value?.trim()).map(([field, value]) => <p key={field} className="mt-2"><strong>{({ objective: "Objetivo", population: "População", method: "Método", finding: "Achado", limitation: "Limitação" } as Record<string, string>)[field]} · sua anotação:</strong> {value}</p>)}</details>
          </div>)}</div>
          {!referenceOptions.length && <p className="mt-4 text-sm text-ink-soft">Nenhum artigo neste recorte. <Link href={projectId ? `/descobrir?projeto=${projectId}` : "/descobrir"} className="text-teal underline">Buscar no Radar</Link> ou ajuste o filtro.</p>}
          {referenceOptions.length > referenceLimit && <button type="button" onClick={() => setReferenceLimit(limit => limit + 20)} className="mt-3 text-sm text-teal underline">Mostrar mais referências</button>}
          <Link href={projectId ? `/biblioteca?projeto=${projectId}` : "/biblioteca"} className="inline-block text-sm text-teal mt-4">Abrir biblioteca e matriz →</Link>
        </details>
      </>}
      {library.error && <p role="alert" className="mt-4 text-sm text-red-700">{library.error} <button onClick={() => window.location.reload()} className="underline">Tentar novamente</button></p>}
    </section>
    <form onSubmit={e => { e.preventDefault(); explore(context); }} className="mt-8 bg-white border border-line rounded-2xl p-5 md:p-6">
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
      <label className="block text-sm font-medium mt-5">O que você deseja esclarecer ou aprofundar?<textarea maxLength={1500} rows={3} value={context.uncertainty || ""} onChange={e => update("uncertainty", e.target.value)} placeholder="Ex.: os estudos que li usam populações diferentes da minha; quero avaliar se a medida faz sentido no meu serviço." className="block w-full border border-line rounded-card p-3 bg-paper mt-2 font-normal" /></label>
      {context.startingQuestion && <p className="mt-4 bg-paper rounded-card p-3 text-sm"><strong>Pergunta do projeto de referência:</strong> {context.startingQuestion}</p>}
      <button disabled={profileLoading || library.loading || projectLoading} className="bg-teal text-white rounded-card px-5 py-3 mt-5 font-medium disabled:opacity-50">{ideas.length ? "Atualizar ideias" : "Explorar caminhos de pesquisa"}</button>
    </form>
    {stale && <p role="status" className="mt-4 bg-amber-soft p-4 rounded-card text-sm">Você alterou o contexto ou as referências. Clique em Atualizar ideias antes de levar uma proposta para o projeto.</p>}
    {ideas.length > 0 && <section className="mt-8" aria-label="Ideias sugeridas">
      <div className="flex justify-between flex-wrap gap-3 items-center"><h2 className="font-display text-3xl">Caminhos para avaliar</h2><span className="text-sm text-teal">{selected.length}/3 selecionadas para comparar</span></div>
      <p className="text-xs text-ink-soft mt-3">Propostas iniciais elaboradas com estruturas guiadas, sem geração por IA nesta versão. Não atestam originalidade, viabilidade final ou adequação metodológica. Refine a pergunta e valide a literatura.</p>
      <div className="grid md:grid-cols-2 gap-5 mt-5">{ideas.map((idea, index) => <article key={idea.id} className="bg-white border border-line rounded-2xl p-5 md:p-6 flex flex-col">
        <div className="flex justify-between gap-3"><span className="text-xs text-teal">CAMINHO {index + 1}</span><label className="text-xs flex gap-2 items-center"><input type="checkbox" checked={selected.includes(idea.id)} onChange={() => toggle(idea.id)} />Comparar</label></div>
        <h3 className="font-display text-2xl mt-4 leading-snug">{idea.title}</h3>
        <p className="text-xs bg-teal-soft text-teal rounded-full px-3 py-1 mt-3 self-start">{idea.studyType}</p>
        <dl className="space-y-4 mt-5 text-sm">{[["Pergunta de pesquisa", idea.question], ["Objetivo", idea.objective]].map(([label, value]) => <div key={label}><dt className="font-medium">{label}</dt><dd className="text-ink-soft mt-1 leading-relaxed">{value}</dd></div>)}</dl>
        <div className="mt-5 text-sm"><p className="font-medium">Por que avaliar este caminho?</p><p className="text-ink-soft leading-relaxed mt-2">{idea.justification}</p></div>
        <p className="text-sm bg-teal-soft rounded-card p-3 mt-5"><span className="font-medium text-teal">Viabilidade no contexto informado</span><span className="block text-ink-soft mt-1">{idea.feasibility}</span></p>
        <details className="mt-5 text-sm flex-1"><summary className="text-teal font-medium cursor-pointer">Explorar a proposta completa</summary><dl className="space-y-4 mt-4">{[["Desfecho", idea.outcome], ["Variáveis", idea.variables], ["Métodos sugeridos", idea.methods], ["Plano de análise inicial", idea.analysis], ["Recursos necessários", idea.resources], ["Dificuldades", idea.difficulty], ["Primeiro passo", idea.steps]].map(([label, value]) => <div key={label}><dt className="font-medium">{label}</dt><dd className="text-ink-soft mt-1 leading-relaxed">{value}</dd></div>)}</dl></details>
        <details className="mt-4 text-sm"><summary className="text-teal font-medium cursor-pointer">Decisões pendentes e plano de execução</summary><h4 className="font-medium mt-4">Antes de escolher</h4><ul className="mt-2 list-disc pl-5 space-y-2 text-ink-soft">{idea.unresolved.map(value => <li key={value}>{value}</li>)}</ul><h4 className="font-medium mt-4">Sequência sugerida</h4><ol className="mt-2 list-decimal pl-5 space-y-2 text-ink-soft">{idea.plan.map(value => <li key={value}>{value}</li>)}</ol><p className="text-xs text-ink-soft mt-3">A sequência precisa ser ajustada ao prazo, às autorizações e à equipe; não é uma previsão automática de conclusão.</p></details>
        <details className="mt-4 text-sm"><summary className="text-teal font-medium cursor-pointer">Referências selecionadas para verificação ({idea.references.length})</summary>{idea.references.length ? <div className="mt-3 space-y-4">{idea.references.map(reference => <div key={reference.id} className="bg-paper rounded-card p-3"><p className="font-medium">{reference.label} · {reference.title}</p><p className="text-xs text-ink-soft mt-1">{reference.year || "Ano não informado"} · {reference.identifier}</p>{reference.observations.map(value => <p className="text-xs text-ink-soft mt-2" key={value}>{value}</p>)}{!reference.observations.length && <p className="text-xs text-ink-soft mt-2">Sem anotações de leitura na matriz. Confira população, método, resultados e limitações.</p>}{reference.url && <a href={reference.url} target="_blank" rel="noreferrer" className="text-xs text-teal inline-block mt-2">Conferir referência ↗</a>}</div>)}</div> : <p className="mt-3 text-ink-soft text-sm">Nenhuma referência selecionada. Busque no Radar e revise a literatura antes de defender a proposta.</p>}</details>
        <button onClick={() => setEditing(editing === idea.id ? null : idea.id)} className="self-start text-sm text-teal mt-4">{editing === idea.id ? "Concluir ajustes" : "Ajustar esta proposta"}</button>
        {editing === idea.id && <div className="mt-4 bg-paper border border-line rounded-card p-4 space-y-4">{([ ["Título", "title"], ["Pergunta", "question"], ["Objetivo", "objective"], ["Desfecho", "outcome"], ["Métodos", "methods"], ["Análise", "analysis"] ] as const).map(([label, key]) => <label key={key} className="block text-sm font-medium">{label}<textarea maxLength={3000} rows={3} value={idea[key]} onChange={e => { const value = e.target.value; setIdeas(list => list.map(x => x.id === idea.id ? { ...x, [key]: value } : x)); }} className="block w-full mt-2 border border-line rounded-card p-3 font-normal" /></label>)}</div>}
        <div className="mt-6 flex gap-3 flex-wrap"><Link href={`/descobrir?tema=${encodeURIComponent(idea.radar)}`} className="text-teal text-sm border border-teal/30 rounded-card px-3 py-2">Validar no Radar</Link><button disabled={stale || library.loading} onClick={() => transfer(idea)} className="bg-ink text-white text-sm rounded-card px-3 py-2 disabled:opacity-50">Levar para Meu projeto →</button><button disabled={stale} onClick={() => download(idea)} className="text-sm text-teal underline disabled:opacity-50">Baixar proposta</button></div>
      </article>)}</div>
    </section>}
    {message && <p role="status" className="mt-4 text-sm text-teal">{message}</p>}
    {selected.length >= 2 && <section className="mt-8 bg-white border border-line rounded-2xl p-5"><h2 className="font-display text-2xl">Compare antes de escolher</h2><div className="overflow-x-auto mt-4"><table className="w-full text-sm text-left"><caption className="sr-only">Comparação das ideias selecionadas</caption><thead><tr><th scope="col" className="p-3">Critério</th>{ideas.filter(x => selected.includes(x.id)).map(x => <th scope="col" key={x.id} className="p-3 min-w-60">{x.title}</th>)}</tr></thead><tbody>{([ ["Desenho", "studyType"], ["Pergunta", "question"], ["Objetivo", "objective"], ["Métodos", "methods"], ["Recursos", "resources"], ["Viabilidade", "feasibility"], ["Dificuldades", "difficulty"], ["Justificativa", "justification"] ] as const).map(([label, key]) => <tr key={key} className="border-t border-line"><th scope="row" className="p-3 align-top">{label}</th>{ideas.filter(x => selected.includes(x.id)).map(x => <td key={x.id} className="p-3 align-top text-ink-soft">{x[key]}</td>)}</tr>)}</tbody></table></div></section>}
    {!ideas.length && <div className="mt-8 bg-teal-soft rounded-2xl p-6"><h2 className="font-display text-2xl">Comece pelos recursos que você já tem.</h2><p className="text-sm text-ink-soft mt-3">Sem acesso a participantes ou registros, explore caminhos com literatura. Com acesso ao serviço, avalie também possibilidades observacionais. O prazo e as autorizações precisam entrar na decisão.</p></div>}
  </div>;
}
function Text({ label, value, change, placeholder, required }: { label: string; value: string; change: (v: string) => void; placeholder?: string; required?: boolean }) {
  return <label className="text-sm font-medium">{label}<input required={required} maxLength={300} value={value} onChange={e => change(e.target.value)} placeholder={placeholder} className="block w-full mt-2 border border-line rounded-card px-3 py-3 bg-paper focus:border-teal outline-none" /></label>;
}
function Select({ label, value, change, options }: { label: string; value: string; change: (v: string) => void; options: string[][] }) {
  return <label className="text-sm font-medium">{label}<select value={value} onChange={e => change(e.target.value)} className="block w-full mt-2 border border-line rounded-card px-3 py-3 bg-paper focus:border-teal outline-none">{options.map(([v, title]) => <option key={v} value={v}>{title}</option>)}</select></label>;
}
