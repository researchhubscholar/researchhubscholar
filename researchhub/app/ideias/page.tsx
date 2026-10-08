"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import IdeaHistory from "@/components/ideas/history";
import type { IdeaRefinement } from "@/lib/ai/refine-idea";
import { historyError, type SavedIdea } from "@/lib/ideas/history";
import { type Context, type Idea, generate, ideaBrief, initial, referenceSignature } from "@/lib/ideas/generate";
import { transferKey } from "@/lib/ideas/transfer";
import { useLibrary } from "@/lib/literature/use-library";
import { supabaseBrowser } from "@/lib/supabase/browser";

type AIMode = "" | "simulation" | "live" | "saved" | "error";
type CreationMode = "automatic" | "theme" | "guided";
type RefinementResult = { output: IdeaRefinement; operationId: string; pubmedQuery: string; pubmedTotal: number };

const blankContext: Context = {
  ...initial,
  theme: "",
  specialty: "",
  interest: "",
  population: "",
  exposure: "",
  measure: "",
  setting: "",
};

export default function IdeasPage() {
  const library = useLibrary();
  const router = useRouter();
  const previousOwner = useRef<string | null>(null);
  const savingRef = useRef(false);
  const projectRequest = useRef(0);
  const series = useRef<Record<string, string>>({});
  const touched = useRef(new Set<string>());
  const [context, setContext] = useState<Context>(() => ({ ...blankContext }));
  const [creationMode, setCreationMode] = useState<CreationMode>("automatic");
  const [snapshot, setSnapshot] = useState<Context | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [referenceIds, setReferenceIds] = useState<string[]>([]);
  const [referenceQuery, setReferenceQuery] = useState("");
  const [evidenceSnapshot, setEvidenceSnapshot] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiOperation, setAiOperation] = useState("");
  const [aiMode, setAiMode] = useState<AIMode>("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [refiningId, setRefiningId] = useState("");
  const [refinements, setRefinements] = useState<Record<string, RefinementResult>>({});
  const [refinementErrors, setRefinementErrors] = useState<Record<string, string>>({});

  const evidence = useMemo(() => library.articles.filter(article => referenceIds.includes(article.id)).map(article => ({ article, note: library.notes[article.id] || {} })), [library.articles, library.notes, referenceIds]);
  const signature = referenceSignature(evidence);
  const referenceOptions = useMemo(() => library.articles.filter(article => `${article.title} ${article.authors.join(" ")} ${article.doi || ""} ${article.pmid || ""}`.toLowerCase().includes(referenceQuery.toLowerCase())).slice(0, 20), [library.articles, referenceQuery]);
  const stale = snapshot !== null && (JSON.stringify(context) !== JSON.stringify(snapshot) || evidenceSnapshot !== signature);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setContext(current => ({ ...current, theme: params.get("tema") || "" }));
    setProjectId(params.get("projeto") || "");
  }, []);

  useEffect(() => {
    if (previousOwner.current && previousOwner.current !== library.userId) {
      setIdeas([]); setSnapshot(null); setReferenceIds([]); setSelected([]); setProjectId("");
      setAiMessage(""); setAiOperation(""); setAiMode(""); setMessage(""); setProjectError(""); setRefinements({}); setRefinementErrors({}); setRefiningId("");
      series.current = {}; touched.current.clear(); setContext({ ...blankContext });
    }
    previousOwner.current = library.userId;
    ++projectRequest.current;
    setProjectLoading(false);
  }, [library.userId]);

  useEffect(() => {
    let active = true;
    if (library.loading) return;
    if (!library.userId) { setProfileLoading(false); return; }
    setProfileLoading(true);
    async function loadProfile() {
      try {
        const { data } = await supabaseBrowser().from("profiles").select("specialty,training_stage").eq("id", library.userId!).maybeSingle();
        if (active && data) setContext(current => ({ ...current, specialty: touched.current.has("specialty") ? current.specialty : data.specialty || current.specialty, stage: touched.current.has("stage") ? current.stage : data.training_stage || current.stage }));
      } finally { if (active) setProfileLoading(false); }
    }
    void loadProfile().catch(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [library.loading, library.userId]);

  useEffect(() => {
    let active = true;
    fetch("/api/ai/status", { cache: "no-store" }).then(response => response.ok ? response.json() : null).then(data => { if (active) setAiEnabled(Boolean(data?.enabled)); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  function update(key: keyof Context, value: string) {
    touched.current.add(key);
    setContext(current => ({ ...current, [key]: value }));
  }

  async function applyProject() {
    if (!projectId || !library.userId || projectLoading) return;
    const request = ++projectRequest.current;
    setProjectLoading(true); setProjectError("");
    try {
      const { data, error } = await supabaseBrowser().from("research_projects").select("theme,title,research_question,population,primary_outcome").eq("id", projectId).eq("owner_id", library.userId).maybeSingle();
      if (request !== projectRequest.current) return;
      if (error || !data) throw new Error("Não foi possível carregar este projeto.");
      setContext(current => ({ ...current, theme: data.theme || data.title || "", interest: data.research_question || data.theme || data.title || "", population: data.population || "", measure: data.primary_outcome || "", startingQuestion: data.research_question || "" }));
      setMessage("Contexto do projeto carregado. Revise a solicitação principal antes de gerar novas propostas.");
    } catch (error) {
      if (request === projectRequest.current) setProjectError(error instanceof Error ? error.message : "Não foi possível carregar o projeto.");
    } finally { if (request === projectRequest.current) setProjectLoading(false); }
  }

  function generationContext(): Context {
    if (creationMode !== "automatic") return { ...context };
    const area = context.specialty.trim();
    const reality = context.setting.trim();
    return {
      ...context,
      theme: "",
      interest: `Mapeie oportunidades de pesquisa específicas, mensuráveis e clinicamente relevantes em ${area}, considerando a realidade de ${reality}. Explore problemas distintos antes de selecionar as propostas; não apenas combine estas palavras em títulos.`,
      population: context.population.trim() || `populações, pacientes, profissionais ou registros realmente acessíveis em ${reality}`,
      workType: "open",
      requirements: [context.requirements, "Geração automática: comparar direções científicas distintas e priorizar as que cabem no prazo e no acesso informados."].filter(Boolean).join(" "),
    };
  }

  async function createIdeasWithAI() {
    if (aiLoading) return;
    if (!library.userId) { setAiMessage("Entre na sua conta para gerar propostas com IA e registrar o consumo."); return; }
    if (!aiEnabled) { setAiMessage("A assistência de IA ainda não está ativada neste ambiente."); return; }
    if (creationMode === "automatic" && (!context.specialty.trim() || !context.setting.trim())) { setAiMessage("Informe sua área e a realidade de acesso para a geração automática."); return; }
    if (creationMode === "theme" && context.interest.trim().length < 10) { setAiMessage("Descreva um tema, problema ou pergunta com um pouco mais de detalhe."); return; }
    const requestContext = generationContext();
    setAiLoading(true); setAiMessage(""); setAiOperation(""); setMessage("");
    try {
      const startingIdeas = generate(requestContext, evidence);
      const response = await fetch("/api/ai/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: requestContext, ideas: startingIdeas, projectId: projectId || null }) });
      const raw = await response.text();
      let data: { error?: string; ideas?: Idea[]; caution?: string; operationId?: string; mode?: "simulation" | "live" };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        throw new Error(response.status === 504 ? "A geração demorou mais que o esperado. Sua franquia não será consumida; tente novamente." : "A geração foi interrompida antes de concluir. Tente novamente em instantes.");
      }
      if (!response.ok || !data.ideas) throw new Error(data.error || "Não foi possível criar as propostas.");
      setContext(requestContext); setIdeas(data.ideas); setSnapshot({ ...requestContext }); setEvidenceSnapshot(signature); setSelected([]); setEditing(null);
      setRefinements({}); setRefinementErrors({});
      setAiOperation(data.operationId || ""); setAiMode(data.mode || "live");
      setAiMessage(data.caution || "Três propostas foram criadas para você comparar e validar.");
      window.setTimeout(() => document.getElementById("propostas-geradas")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (error) {
      setAiMode("error");
      setAiMessage(error instanceof Error ? error.message : "Não foi possível criar as propostas.");
    } finally { setAiLoading(false); }
  }

  async function saveVersion(idea: Idea) {
    if (!library.userId || !snapshot || stale || savingRef.current) return;
    const owner = library.userId;
    savingRef.current = true; setSaving(true); setMessage("");
    try {
      const client = supabaseBrowser();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || auth.user?.id !== owner) throw new Error("Sua sessão mudou. Recarregue a página.");
      const seriesId = series.current[idea.id] || crypto.randomUUID();
      const { error } = await client.from("idea_versions").insert({ owner_id: owner, series_id: seriesId, context: snapshot, proposal: idea, evidence_signature: evidenceSnapshot, reason: aiMode === "live" ? "Proposta gerada com assistência de IA" : "Proposta em avaliação" });
      if (error) throw error;
      series.current[idea.id] = seriesId; setHistoryRefresh(value => value + 1);
      setMessage("Proposta salva no histórico da sua conta.");
    } catch (error) { setMessage(historyError(error as { code?: string })); }
    finally { savingRef.current = false; setSaving(false); }
  }

  async function refineWithLiterature(idea: Idea) {
    if (refiningId) return;
    setRefiningId(idea.id);
    setRefinementErrors(current => ({ ...current, [idea.id]: "" }));
    try {
      const response = await fetch("/api/ai/refine-idea", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idea, projectId: projectId || null }) });
      const raw = await response.text();
      let data: { error?: string; output?: IdeaRefinement; operationId?: string; pubmedQuery?: string; pubmedTotal?: number };
      try { data = JSON.parse(raw) as typeof data; }
      catch { throw new Error(response.status === 504 ? "O refinamento demorou mais que o esperado. Tente novamente." : "O refinamento foi interrompido antes de concluir."); }
      if (!response.ok || !data.output) throw new Error(data.error || "Não foi possível refinar esta proposta.");
      setRefinements(current => ({ ...current, [idea.id]: { output: data.output!, operationId: data.operationId || "", pubmedQuery: data.pubmedQuery || idea.radar, pubmedTotal: data.pubmedTotal || 0 } }));
    } catch (error) {
      setRefinementErrors(current => ({ ...current, [idea.id]: error instanceof Error ? error.message : "Não foi possível refinar esta proposta." }));
    } finally { setRefiningId(""); }
  }

  function applyRefinement(id: string) {
    const refinement = refinements[id];
    if (!refinement) return;
    setIdeas(current => current.map(idea => idea.id === id ? { ...idea, ...refinement.output.refinedProposal, id: idea.id, references: idea.references } : idea));
    setRefinements(current => { const next = { ...current }; delete next[id]; return next; });
    setMessage("Refinamento baseado na literatura aplicado à proposta. Revise antes de salvar ou transformar em projeto.");
  }

  function restoreVersion(row: SavedIdea) {
    if (ideas.length && !window.confirm("Retomar esta versão? As propostas atuais continuam disponíveis apenas se já foram salvas.")) return;
    setContext(row.context); setSnapshot(row.context); setIdeas([row.proposal]); setSelected([]); setEditing(null);
    setReferenceIds(row.proposal.references.map(reference => reference.id)); setEvidenceSnapshot(row.evidence_signature);
    series.current = { [row.proposal.id]: row.series_id }; setAiMode("saved"); setMessage("Versão retomada do histórico.");
  }

  function transfer(idea: Idea) {
    if (stale || library.loading) return;
    try {
      const token = crypto.randomUUID();
      sessionStorage.setItem(transferKey(library.userId, token), JSON.stringify({ ownerId: library.userId, draft: { theme: idea.title, question: idea.question, objective: idea.objective, studyType: idea.studyType, population: idea.population, outcome: idea.outcome, hypothesis: idea.hypothesis || "", inclusion: idea.eligibility || "", exclusion: "", variables: idea.variables, methods: idea.methods, analysis: idea.analysis, ethics: idea.ethics || "", manuscript: ideaBrief(idea) }, referenceIds: idea.references.map(reference => reference.id) }));
      router.push(`/meu-trabalho?origem=ideias&proposta=${encodeURIComponent(token)}`);
    } catch { setMessage("Não foi possível preparar a proposta. Tente novamente."); }
  }

  function download(idea: Idea) {
    const url = URL.createObjectURL(new Blob([ideaBrief(idea)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "proposta-scholar.txt"; link.click(); URL.revokeObjectURL(url);
  }

  function toggleComparison(id: string) {
    if (selected.includes(id)) setSelected(current => current.filter(value => value !== id));
    else if (selected.length < 3) setSelected(current => [...current, id]);
  }

  const selectedIdeas = ideas.filter(idea => selected.includes(idea.id));

  return <div className="scholar-workspace ideas-page max-w-5xl mx-auto">
    <header className="max-w-3xl">
      <p className="text-xs uppercase tracking-widest text-teal font-semibold">Ideias de pesquisa com IA</p>
      <h1 className="font-display text-4xl md:text-5xl mt-3">Encontre um caminho científico que cabe na sua realidade.</h1>
      <p className="text-ink-soft mt-4 leading-relaxed">Comece com poucas informações ou controle todos os critérios. A IA explora diferentes oportunidades e entrega três propostas completas para comparar, validar no Radar e discutir com seu orientador.</p>
    </header>

    <section className="mt-8 grid md:grid-cols-3 gap-3" aria-label="Modo de criação da ideia">
      {([
        ["automatic", "Gerar para mim", "Use minha área, meu acesso e meu prazo para descobrir oportunidades."],
        ["theme", "Partir de um tema", "Expandir um interesse ou problema inicial em caminhos científicos."],
        ["guided", "Controlar critérios", "Definir população, medidas, recursos e exigências em detalhes."],
      ] as const).map(([mode, label, description]) => <button key={mode} type="button" onClick={() => { setCreationMode(mode); setAiMessage(""); }} className={`text-left rounded-2xl border p-5 transition-colors ${creationMode === mode ? "border-teal bg-teal-soft" : "border-line bg-white hover:border-teal/40"}`}><span className="text-xs uppercase tracking-widest text-teal">{mode === "automatic" ? "Recomendado" : "Opção"}</span><strong className="block font-display text-xl mt-2">{label}</strong><span className="block text-sm text-ink-soft mt-2 leading-relaxed">{description}</span></button>)}
    </section>

    {creationMode === "automatic" && <form onSubmit={event => { event.preventDefault(); void createIdeasWithAI(); }} className="mt-5 bg-white border border-line rounded-2xl p-5 md:p-7 shadow-sm">
      <div className="flex flex-wrap justify-between gap-3 items-start"><div><p className="text-xs uppercase tracking-widest text-teal">Geração automática</p><h2 className="font-display text-2xl mt-2">Três informações para começar.</h2><p className="text-sm text-ink-soft mt-2 max-w-2xl">A IA primeiro explora oportunidades diferentes; depois seleciona as três com melhor equilíbrio entre relevância, viabilidade e execução.</p></div><span className="text-xs bg-teal-soft text-teal rounded-full px-3 py-2">1 operação · até 10.000 tokens</span></div>
      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <Text required label="Sua especialidade ou área" value={context.specialty} change={value => update("specialty", value)} placeholder="Ex.: Clínica médica, pediatria, saúde mental" />
        <Text required label="Sua realidade de acesso" value={context.setting} change={value => update("setting", value)} placeholder="Ex.: ambulatório com prontuários de adultos hipertensos" />
        <Select label="Prazo disponível" value={context.months} change={value => update("months", value)} options={[["3", "Até 3 meses"], ["6", "Até 6 meses"], ["12", "Até 12 meses"], ["18", "Mais de 12 meses"]]} />
        <Select label="A que você tem acesso?" value={context.access} change={value => update("access", value)} options={[["literature", "Somente literatura"], ["records", "Prontuários ou registros"], ["patients", "Participantes ou pacientes"], ["both", "Registros e participantes"]]} />
      </div>
      <details className="mt-5 border-t border-line pt-4"><summary className="cursor-pointer text-sm text-teal">Adicionar população ou exigência específica · opcional</summary><div className="grid md:grid-cols-2 gap-4 mt-4"><Text label="População disponível" value={context.population} change={value => update("population", value)} placeholder="Ex.: residentes do primeiro ano" /><Text label="Exigência do trabalho" value={context.requirements || ""} change={value => update("requirements", value)} placeholder="Ex.: precisa ser revisão ou artigo original" /></div></details>
      <div className="mt-6 flex flex-wrap gap-3 items-center"><button disabled={aiLoading || profileLoading || library.loading || !aiEnabled || !context.specialty.trim() || !context.setting.trim()} className="bg-teal text-white rounded-card px-6 py-3.5 font-medium disabled:opacity-50">{aiLoading ? "Explorando oportunidades científicas…" : aiEnabled ? "Gerar ideias automaticamente" : "IA ainda não ativada"}</button>{!library.userId && <Link href="/login" className="text-sm text-teal underline">Entre para usar sua franquia de IA</Link>}</div>
    </form>}

    {creationMode === "theme" && <form onSubmit={event => { event.preventDefault(); void createIdeasWithAI(); }} className="mt-5 bg-white border border-line rounded-2xl p-5 md:p-7 shadow-sm">
      <p className="text-xs uppercase tracking-widest text-teal">A partir de um tema</p><h2 className="font-display text-2xl mt-2">Dê um ponto de partida, não um título pronto.</h2>
      <label className="block text-base font-medium mt-5">Tema, problema ou pergunta inicial<textarea required minLength={10} maxLength={1500} rows={5} value={context.interest} onChange={event => update("interest", event.target.value)} placeholder="Ex.: Tenho observado dificuldade de sono entre residentes após plantões noturnos e quero explorar possibilidades de pesquisa." className="block w-full mt-3 border border-line rounded-xl p-4 bg-paper text-base font-normal outline-none focus:border-teal" /></label>
      <div className="grid md:grid-cols-3 gap-4 mt-5"><Text label="População — opcional" value={context.population} change={value => update("population", value)} /><Select label="Tipo de trabalho" value={context.workType || "open"} change={value => update("workType", value)} options={[["open", "Comparar possibilidades"], ["original", "Artigo original"], ["review", "Revisão"], ["case", "Relato de caso"], ["tcc", "TCC"]]} /><Select label="Prazo" value={context.months} change={value => update("months", value)} options={[["3", "Até 3 meses"], ["6", "Até 6 meses"], ["12", "Até 12 meses"], ["18", "Mais de 12 meses"]]} /></div>
      <div className="mt-6 flex flex-wrap gap-3 items-center"><button disabled={aiLoading || library.loading || !aiEnabled || context.interest.trim().length < 10} className="bg-teal text-white rounded-card px-6 py-3.5 font-medium disabled:opacity-50">{aiLoading ? "Expandindo possibilidades…" : "Transformar tema em propostas"}</button><span className="text-xs text-ink-soft">A IA deve expandir o problema em direções diferentes, não apenas reescrever seu texto.</span></div>
    </form>}

    {creationMode === "guided" && <form onSubmit={event => { event.preventDefault(); void createIdeasWithAI(); }} className="mt-8 bg-white border border-line rounded-2xl p-5 md:p-7 shadow-sm">
      <label className="block text-base font-medium">O que você gostaria de investigar?
        <textarea required maxLength={1500} rows={4} value={context.interest} onChange={event => update("interest", event.target.value)} placeholder="Ex.: Quero entender se a quantidade de plantões noturnos está relacionada à qualidade do sono dos residentes." className="block w-full mt-3 border border-line rounded-xl p-4 bg-paper text-base font-normal outline-none focus:border-teal" />
      </label>
      <div className="grid md:grid-cols-2 gap-4 mt-5">
        <Text required label="Quem ou qual população está envolvida?" value={context.population} change={value => update("population", value)} placeholder="Ex.: residentes de medicina" />
        <Text label="Em qual contexto?" value={context.setting} change={value => update("setting", value)} placeholder="Ex.: programa de residência de um hospital" />
        <Select label="Qual é o tipo de trabalho?" value={context.workType || "open"} change={value => update("workType", value)} options={[["open", "Quero comparar possibilidades"], ["tcc", "TCC ou trabalho de conclusão"], ["original", "Estudo ou artigo original"], ["review", "Revisão de literatura"], ["case", "Relato de caso"], ["residency", "Projeto da residência"]]} />
        <div className="grid grid-cols-2 gap-3"><Select label="Prazo" value={context.months} change={value => update("months", value)} options={[["3", "Até 3 meses"], ["6", "Até 6 meses"], ["12", "Até 12 meses"], ["18", "Mais de 12 meses"]]} /><Select label="Acesso" value={context.access} change={value => update("access", value)} options={[["literature", "Literatura"], ["records", "Registros"], ["patients", "Participantes"], ["both", "Registros e participantes"]]} /></div>
      </div>

      <details className="mt-6 border-t border-line pt-5">
        <summary className="cursor-pointer text-sm font-medium text-teal">Adicionar detalhes para uma resposta mais precisa <span className="text-ink-soft font-normal">· opcional</span></summary>
        <div className="grid md:grid-cols-2 gap-4 mt-5">
          <Text label="Especialidade ou área" value={context.specialty} change={value => update("specialty", value)} />
          <Text label="Tema já definido" value={context.theme} change={value => update("theme", value)} placeholder="Se já houver um tema ou título provisório" />
          <Text label="Exposição, intervenção ou comparação" value={context.exposure} change={value => update("exposure", value)} placeholder="Ex.: número de plantões noturnos" />
          <Text label="Desfecho ou resultado de interesse" value={context.measure} change={value => update("measure", value)} placeholder="Ex.: qualidade do sono" />
          <Text label="Instrumento conhecido" value={context.instrument || ""} change={value => update("instrument", value)} placeholder="Opcional; a IA pode sugerir o que confirmar" />
          <Text label="Amostra ou dados acessíveis" value={context.availableSample || ""} change={value => update("availableSample", value)} placeholder="Ex.: aproximadamente 40 residentes" />
          <Select label="Orientação disponível" value={context.support || "unknown"} change={value => update("support", value)} options={[["unknown", "Ainda não sei"], ["yes", "Tenho orientador"], ["no", "Ainda não tenho orientador"]]} />
          <Select label="Autorização de acesso" value={context.authorization || "unknown"} change={value => update("authorization", value)} options={[["unknown", "Ainda não sei"], ["confirmed", "Acesso confirmado"], ["pending", "Depende de autorização"], ["na", "Não se aplica"]]} />
          <Text label="Exigência do curso ou serviço" value={context.requirements || ""} change={value => update("requirements", value)} placeholder="Ex.: artigo original; apresentação em dezembro" />
          <Text label="Dúvida que mais preocupa você" value={context.uncertainty || ""} change={value => update("uncertainty", value)} placeholder="Ex.: não sei qual desenho cabe no prazo" />
        </div>

        {library.userId && <div className="mt-6 border-t border-line pt-5"><p className="text-sm font-medium">Usar algo que já está na sua conta</p><div className="flex flex-wrap gap-3 items-end mt-3"><label className="text-sm flex-1">Projeto existente<select value={projectId} onChange={event => { setProjectId(event.target.value); setReferenceIds([]); }} className="block w-full border border-line rounded-card px-3 py-3 mt-2"><option value="">Nenhum projeto</option>{library.projects.map(project => <option key={project.id} value={project.id}>{project.title || project.theme || "Projeto sem título"}</option>)}</select></label><button type="button" disabled={!projectId || projectLoading} onClick={applyProject} className="border border-teal/30 text-teal px-4 py-3 rounded-card text-sm disabled:opacity-50">{projectLoading ? "Carregando…" : "Usar contexto"}</button></div>{projectError && <p role="alert" className="text-sm text-red-700 mt-2">{projectError}</p>}
          <details className="mt-4"><summary className="cursor-pointer text-sm text-teal">Selecionar referências da biblioteca · {referenceIds.length}/10</summary><input aria-label="Buscar referências" value={referenceQuery} onChange={event => setReferenceQuery(event.target.value)} placeholder="Buscar por título, autor, DOI ou PMID" className="w-full border border-line rounded-card px-3 py-2 mt-3" /><div className="max-h-72 overflow-y-auto space-y-2 mt-3">{referenceOptions.map(article => <label key={article.id} className="flex gap-3 border border-line rounded-card p-3 text-sm"><input type="checkbox" checked={referenceIds.includes(article.id)} disabled={!referenceIds.includes(article.id) && referenceIds.length >= 10} onChange={() => setReferenceIds(current => current.includes(article.id) ? current.filter(id => id !== article.id) : [...current, article.id])} className="mt-1" /><span>{article.title}<span className="block text-xs text-ink-soft mt-1">{article.year || "Ano não informado"} · {article.pmid ? `PMID ${article.pmid}` : `DOI ${article.doi}`}</span></span></label>)}</div></details>
        </div>}
      </details>

      <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:items-center">
        <button disabled={aiLoading || profileLoading || library.loading || !aiEnabled} className="bg-teal text-white rounded-card px-6 py-3.5 font-medium disabled:opacity-50">{aiLoading ? "Construindo propostas completas…" : aiEnabled ? "Criar 3 propostas com IA" : "IA ainda não ativada"}</button>
        {!library.userId && <Link href="/login" className="text-sm text-teal underline">Entre para usar sua franquia de IA</Link>}
        <span className="text-xs text-ink-soft">Uma geração usa até 10.000 tokens da sua franquia.</span>
      </div>
    </form>}

    {aiMessage && <div role="status" className={`mt-5 rounded-card p-4 text-sm ${aiMode === "simulation" || aiMode === "error" ? "bg-amber-soft" : "bg-teal-soft"}`}><p>{aiMessage}</p>{aiOperation && <p className="text-xs mt-2"><Link href={`/geracoes/${aiOperation}`} className="text-teal underline">Ver registro, consumo e versão desta geração</Link></p>}</div>}
    {stale && <p role="status" className="mt-4 bg-amber-soft rounded-card p-4 text-sm">Você alterou as informações depois da geração. Gere novamente antes de salvar ou levar uma proposta para o projeto.</p>}
    {message && <p role="status" className="mt-4 text-sm text-teal">{message}</p>}

    {ideas.length > 0 && <section id="propostas-geradas" className="mt-10 scroll-mt-24" aria-label="Propostas geradas">
      <div className="flex flex-wrap justify-between gap-3 items-end"><div><p className="text-xs uppercase tracking-widest text-teal font-semibold">Resultado</p><h2 className="font-display text-3xl mt-2">Três caminhos para comparar</h2><p className="text-sm text-ink-soft mt-2">Escolha pelo equilíbrio entre relevância e execução — não apenas pelo tema mais interessante.</p></div><span className="text-sm text-teal">{selected.length}/3 na comparação</span></div>
      <div className="space-y-5 mt-6">{ideas.map((idea, index) => <IdeaCard key={idea.id} idea={idea} index={index} selected={selected.includes(idea.id)} editing={editing === idea.id} stale={stale} saving={saving} loggedIn={Boolean(library.userId)} refining={refiningId === idea.id} refinement={refinements[idea.id]} refinementError={refinementErrors[idea.id] || ""} onCompare={() => toggleComparison(idea.id)} onEdit={() => setEditing(current => current === idea.id ? null : idea.id)} onChange={(key, value) => setIdeas(current => current.map(item => item.id === idea.id ? { ...item, [key]: value } : item))} onRadar={() => router.push(`/descobrir?${new URLSearchParams({ tema: idea.radar, ...(projectId ? { projeto: projectId } : {}), origem: "ideias" }).toString()}`)} onRefine={() => void refineWithLiterature(idea)} onApplyRefinement={() => applyRefinement(idea.id)} onTransfer={() => transfer(idea)} onSave={() => void saveVersion(idea)} onDownload={() => download(idea)} />)}</div>
    </section>}

    {selectedIdeas.length >= 2 && <Comparison ideas={selectedIdeas} />}

    <details className="mt-9"><summary className="cursor-pointer text-sm text-teal font-medium">Abrir histórico de propostas salvas</summary><IdeaHistory ownerId={library.userId} refresh={historyRefresh} restore={restoreVersion} /></details>
  </div>;
}

function IdeaCard({ idea, index, selected, editing, stale, saving, loggedIn, refining, refinement, refinementError, onCompare, onEdit, onChange, onRadar, onRefine, onApplyRefinement, onTransfer, onSave, onDownload }: { idea: Idea; index: number; selected: boolean; editing: boolean; stale: boolean; saving: boolean; loggedIn: boolean; refining: boolean; refinement?: RefinementResult; refinementError: string; onCompare: () => void; onEdit: () => void; onChange: (key: "title" | "question" | "objective" | "outcome" | "methods" | "analysis", value: string) => void; onRadar: () => void; onRefine: () => void; onApplyRefinement: () => void; onTransfer: () => void; onSave: () => void; onDownload: () => void }) {
  const pathLabels = ["MAIS VIÁVEL", "MAIS RELEVANTE", "MAIS INOVADORA"];
  return <article className={`bg-white border rounded-2xl p-5 md:p-7 ${selected ? "border-teal shadow-sm" : "border-line"}`}>
    <div className="flex flex-wrap justify-between gap-3"><div><span className="text-xs text-teal font-semibold">{pathLabels[index] || `CAMINHO ${index + 1}`}</span><span className="text-xs bg-teal-soft text-teal rounded-full px-3 py-1 ml-3">{idea.studyType}</span></div><label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={selected} onChange={onCompare} />Comparar</label></div>
    <h3 className="font-display text-2xl md:text-3xl mt-4 leading-snug">{idea.title}</h3>
    <div className="grid md:grid-cols-2 gap-5 mt-6"><Info label="Pergunta de pesquisa" value={idea.question} /><Info label="Objetivo principal" value={idea.objective} /></div>
    <div className="grid md:grid-cols-3 gap-3 mt-5"><Badge label="Relevância" value={idea.evaluation?.relevance.label || "A confirmar"} /><Badge label="Viabilidade" value={idea.evaluation?.feasibility.label || "A confirmar"} /><Badge label="Execução" value={idea.evaluation?.execution.label || "A confirmar"} /></div>
    <p className="mt-5 bg-teal-soft rounded-card p-4 text-sm"><strong className="text-teal">Por que este caminho pode funcionar</strong><span className="block text-ink-soft mt-1 leading-relaxed">{idea.feasibility}</span></p>

    <details className="mt-5 border-t border-line pt-4"><summary className="cursor-pointer text-teal font-medium">Ver proposta científica completa</summary><dl className="grid md:grid-cols-2 gap-x-6 gap-y-5 mt-5 text-sm">
      <Info label="Hipótese ou pressuposto" value={idea.hypothesis || "Definir com o orientador conforme o desenho escolhido."} />
      <Info label="Desfecho principal" value={idea.outcome} />
      <Info label="População e elegibilidade" value={idea.eligibility || idea.population} />
      <Info label="Variáveis e medidas" value={idea.variables} />
      <Info label="Método sugerido" value={idea.methods} />
      <Info label="Plano de análise inicial" value={idea.analysis} />
      <Info label="Cuidados éticos" value={idea.ethics || "Confirmar avaliação ética, consentimento e proteção dos dados aplicáveis."} />
      <Info label="Limitações previsíveis" value={idea.limitations || idea.difficulty} />
      <Info label="Como verificar a lacuna" value={idea.noveltyCheck || `Testar no Radar: ${idea.radar}`} />
      <Info label="Recursos necessários" value={idea.resources} />
    </dl><div className="grid md:grid-cols-2 gap-5 mt-6 text-sm"><List title="Decisões que ainda precisam ser tomadas" values={idea.unresolved} /><List title="Sequência recomendada" values={idea.plan} ordered /></div></details>

    <button type="button" onClick={onEdit} className="text-sm text-teal mt-5 underline">{editing ? "Concluir ajustes" : "Editar esta proposta"}</button>
    {editing && <div className="mt-4 bg-paper border border-line rounded-card p-4 grid md:grid-cols-2 gap-4">{([ ["Título", "title"], ["Pergunta", "question"], ["Objetivo", "objective"], ["Desfecho", "outcome"], ["Métodos", "methods"], ["Análise", "analysis"] ] as const).map(([label, key]) => <label key={key} className="text-sm font-medium">{label}<textarea maxLength={3000} rows={3} value={idea[key]} onChange={event => onChange(key, event.target.value)} className="block w-full mt-2 border border-line rounded-card p-3 font-normal" /></label>)}</div>}
    {refinement && <RefinementPanel result={refinement} apply={onApplyRefinement} />}
    {refinementError && <p role="alert" className="mt-4 rounded-card bg-amber-soft p-3 text-sm">{refinementError}</p>}
    <div className="mt-6 flex gap-3 flex-wrap"><button type="button" disabled={!loggedIn || stale || refining} onClick={onRefine} className="bg-teal text-white text-sm rounded-card px-3 py-2 disabled:opacity-50">{refining ? "Consultando PubMed e refinando…" : "Refinar com literatura e IA"}</button><button type="button" onClick={onRadar} className="text-teal text-sm border border-teal/30 rounded-card px-3 py-2">Validar no Radar</button><button type="button" disabled={stale} onClick={onTransfer} className="bg-ink text-white text-sm rounded-card px-3 py-2 disabled:opacity-50">Transformar em projeto →</button><button type="button" disabled={stale || saving || !loggedIn} onClick={onSave} className="text-sm text-teal border border-teal/30 rounded-card px-3 py-2 disabled:opacity-50">{saving ? "Salvando…" : "Salvar proposta"}</button><button type="button" disabled={stale} onClick={onDownload} className="text-sm text-teal underline disabled:opacity-50">Baixar</button></div>
  </article>;
}

function RefinementPanel({ result, apply }: { result: RefinementResult; apply: () => void }) {
  const output = result.output;
  return <section className="mt-6 rounded-2xl border border-teal/30 bg-teal-soft/40 p-5" aria-label="Refinamento com literatura">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest font-semibold text-teal">Refinamento baseado no PubMed</p><h4 className="font-display text-2xl mt-2">{output.refinedProposal.title}</h4></div><span className="rounded-full bg-white px-3 py-1 text-xs text-teal">{result.pubmedTotal.toLocaleString("pt-BR")} resultados relacionados</span></div>
    <p className="text-sm text-ink-soft mt-3 leading-relaxed">{output.refinementRationale}</p>
    <div className="grid md:grid-cols-2 gap-4 mt-5 text-sm"><Info label={`Estrutura ${output.framework}`} value={output.frameworkElements.map(item => `${item.label}: ${item.value}`).join(" · ")} /><Info label="Sinal da literatura" value={`${output.literatureSignal}. ${output.gapAssessment}`} /><Info label="Risco de semelhança" value={output.similarityRisk} /><Info label="Termos MeSH/candidatos" value={output.meshTerms.join(" · ")} /></div>
    <div className="mt-5"><p className="text-sm font-medium">Outras formulações de título</p><ul className="mt-2 space-y-2 text-sm text-ink-soft list-disc pl-5">{output.alternativeTitles.map(title => <li key={title}>{title}</li>)}</ul></div>
    <details className="mt-5"><summary className="cursor-pointer text-sm font-medium text-teal">Ver artigos que orientaram o refinamento</summary><ul className="mt-3 space-y-3">{output.sources.map(source => <li key={source.pmid} className="text-sm"><a href={`https://pubmed.ncbi.nlm.nih.gov/${source.pmid}/`} target="_blank" rel="noreferrer" className="font-medium text-teal underline">{source.title}</a><span className="block text-xs text-ink-soft mt-1">PMID {source.pmid} · {source.contribution}</span></li>)}</ul></details>
    <p className="mt-4 text-xs text-ink-soft">{output.caution}</p>
    <div className="flex flex-wrap gap-3 mt-5"><button type="button" onClick={apply} className="bg-teal text-white rounded-card px-4 py-2 text-sm">Aplicar refinamento à proposta</button>{result.operationId && <Link href={`/geracoes/${result.operationId}`} className="text-sm text-teal underline self-center">Ver consumo e registro</Link>}</div>
  </section>;
}

function Comparison({ ideas }: { ideas: Idea[] }) {
  const rows = [["Desenho", "studyType"], ["Pergunta", "question"], ["Desfecho", "outcome"], ["Viabilidade", "feasibility"], ["Limitações", "limitations"]] as const;
  return <section className="mt-8 bg-white border border-line rounded-2xl p-5"><h2 className="font-display text-2xl">Comparação lado a lado</h2><div className="overflow-x-auto mt-4"><table className="w-full text-sm text-left"><thead><tr><th className="p-3">Critério</th>{ideas.map(idea => <th key={idea.id} className="p-3 min-w-64">{idea.title}</th>)}</tr></thead><tbody>{rows.map(([label, key]) => <tr key={key} className="border-t border-line"><th className="p-3 align-top">{label}</th>{ideas.map(idea => <td key={idea.id} className="p-3 align-top text-ink-soft">{idea[key] || "A confirmar"}</td>)}</tr>)}</tbody></table></div></section>;
}

function Text({ label, value, change, placeholder, required }: { label: string; value: string; change: (value: string) => void; placeholder?: string; required?: boolean }) { return <label className="text-sm font-medium">{label}<input required={required} maxLength={300} value={value} onChange={event => change(event.target.value)} placeholder={placeholder} className="block w-full mt-2 border border-line rounded-card px-3 py-3 bg-paper outline-none focus:border-teal" /></label>; }
function Select({ label, value, change, options }: { label: string; value: string; change: (value: string) => void; options: string[][] }) { return <label className="text-sm font-medium">{label}<select value={value} onChange={event => change(event.target.value)} className="block w-full mt-2 border border-line rounded-card px-3 py-3 bg-paper outline-none focus:border-teal">{options.map(([option, title]) => <option key={option} value={option}>{title}</option>)}</select></label>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="font-medium">{label}</p><p className="text-ink-soft mt-1 leading-relaxed">{value}</p></div>; }
function Badge({ label, value }: { label: string; value: string }) { return <div className="border border-line rounded-card p-3"><span className="text-xs text-ink-soft">{label}</span><strong className="block text-teal mt-1">{value}</strong></div>; }
function List({ title, values, ordered = false }: { title: string; values: string[]; ordered?: boolean }) { const Tag = ordered ? "ol" : "ul"; return <div><h4 className="font-medium">{title}</h4><Tag className={`${ordered ? "list-decimal" : "list-disc"} pl-5 space-y-2 mt-2 text-ink-soft`}>{values.map(value => <li key={value}>{value}</li>)}</Tag></div>; }
