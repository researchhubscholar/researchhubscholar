"use client";
import { dialogCopy } from "@/lib/i18n/interface-copy";

import AuthoredText from "@/components/i18n/authored-text";

import { useLanguage } from "@/components/i18n/language-provider";

import InterfaceText from "@/components/i18n/interface-text";


import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import GenerationDialog from "@/components/ai/loading-dialog";
import { AIRequestError, postAI } from "@/lib/ai/client-request";
import IdeaHistory from "@/components/ideas/history";
import type { IdeaRefinement } from "@/lib/ai/refine-idea";
import type { OutputLanguage } from "@/lib/ai/language";
import { historyError, type SavedIdea } from "@/lib/ideas/history";
import { type Context, type Idea, generate, ideaBrief, initial, referenceSignature } from "@/lib/ideas/generate";
import { transferKey } from "@/lib/ideas/transfer";
import { ideaRadarQuery } from "@/lib/ideas/radar";
import { useLibrary } from "@/lib/literature/use-library";
import { supabaseBrowser } from "@/lib/supabase/browser";

type AIMode = "" | "simulation" | "live" | "saved" | "error";
type CreationMode = "automatic" | "theme" | "guided";
type AIUsage = { inputTokens: number; outputTokens: number; costUsd: number };
type QualityCheck = { proposalIndex: number; issues: string[] };
type RefinementResult = { output: IdeaRefinement; operationId: string; pubmedQuery: string; pubmedTotal: number; usage?: AIUsage };
type IdeaOrigin = { generationId?: string; sourceKey: string };

function proposalFingerprint(idea: Idea) {
  const input = `${idea.title}|${idea.question}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

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
  const { t: uiText } = useLanguage();
  const library = useLibrary();
  const router = useRouter();
  const previousOwner = useRef<string | null>(null);
  const savingRef = useRef(false);
  const generationInFlight = useRef(false);
  const refinementInFlight = useRef(false);
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
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>("pt-BR");
  const [lastUsage, setLastUsage] = useState<AIUsage | null>(null);
  const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([]);
  const [ideaOrigins, setIdeaOrigins] = useState<Record<string, IdeaOrigin>>({});
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
      setAiMessage(""); setAiOperation(""); setAiMode(""); setLastUsage(null); setQualityChecks([]); setIdeaOrigins({}); setMessage(""); setProjectError(""); setRefinements({}); setRefinementErrors({}); setRefiningId("");
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
    if (aiLoading || generationInFlight.current || refinementInFlight.current) return;
    if (!library.userId) { setAiMessage("Entre na sua conta para gerar propostas com IA e registrar o consumo."); return; }
    if (!aiEnabled) { setAiMessage("A assistência de IA ainda não está ativada neste ambiente."); return; }
    if (creationMode === "automatic" && (!context.specialty.trim() || !context.setting.trim())) { setAiMessage("Informe sua área e a realidade de acesso para a geração automática."); return; }
    if (creationMode === "theme" && context.interest.trim().length < 10) { setAiMessage("Descreva um tema, problema ou pergunta com um pouco mais de detalhe."); return; }
    const requestContext = generationContext();
    generationInFlight.current = true;
    setAiLoading(true); setAiMessage(""); setAiOperation(""); setLastUsage(null); setQualityChecks([]); setMessage("");
    try {
      const startingIdeas = generate(requestContext, evidence);
      const { data } = await postAI<{ ideas?: Idea[]; caution?: string; operationId?: string; mode?: "simulation" | "live"; usage?: AIUsage; qualityChecks?: QualityCheck[] }>("/api/ai/ideas", { context: requestContext, ideas: startingIdeas, projectId: projectId || null, language: outputLanguage }, 150_000);
      if (!Array.isArray(data.ideas) || !data.ideas.length) throw new AIRequestError("A IA não retornou propostas válidas. Confira o registro antes de tentar novamente.", data.operationId);
      setContext(requestContext); setIdeas(data.ideas); setSnapshot({ ...requestContext }); setEvidenceSnapshot(signature); setSelected([]); setEditing(null);
      setRefinements({}); setRefinementErrors({});
      setAiOperation(data.operationId || ""); setAiMode(data.mode || "live");
      setLastUsage(data.usage || null);
      setQualityChecks(data.qualityChecks || []);
      setIdeaOrigins(Object.fromEntries(data.ideas.map(idea => [idea.id, { generationId: data.operationId, sourceKey: data.operationId ? `generation:${data.operationId}:${idea.id}` : `idea:${proposalFingerprint(idea)}` }] )));
      setAiMessage(data.caution || "Três propostas foram criadas para você comparar e validar.");
      window.setTimeout(() => document.getElementById("propostas-geradas")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (error) {
      setAiMode("error");
      if (error instanceof AIRequestError) setAiOperation(error.operationId);
      setAiMessage(error instanceof Error ? error.message : "Não foi possível criar as propostas.");
    } finally { generationInFlight.current = false; setAiLoading(false); }
  }

  async function saveVersion(idea: Idea, forRadar = false): Promise<boolean> {
    if (!library.userId || !snapshot || stale || savingRef.current || generationInFlight.current || refinementInFlight.current) return false;
    const owner = library.userId;
    savingRef.current = true; setSaving(true); setMessage("");
    try {
      const client = supabaseBrowser();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || auth.user?.id !== owner) throw new Error("Sua sessão mudou. Recarregue a página.");
      const seriesId = series.current[idea.id] || crypto.randomUUID();
      const { error } = await client.from("idea_versions").insert({ owner_id: owner, series_id: seriesId, context: snapshot, proposal: idea, evidence_signature: evidenceSnapshot, reason: forRadar ? "Salvamento automático antes de validar no Radar" : aiMode === "live" ? "Proposta gerada com assistência de IA" : "Proposta em avaliação" });
      if (error) throw error;
      if (previousOwner.current !== owner) return false;
      series.current[idea.id] = seriesId; setHistoryRefresh(value => value + 1);
      setMessage("Proposta salva no histórico da sua conta.");
      return true;
    } catch (error) { setMessage(`${forRadar ? "A proposta não foi salva e o Radar não foi aberto. " : ""}${historyError(error as { code?: string })}`); return false; }
    finally { savingRef.current = false; setSaving(false); }
  }

  async function validateInRadar(idea: Idea) {
    if (!await saveVersion(idea, true)) return;
    router.push(`/descobrir?${new URLSearchParams({ tema: ideaRadarQuery(idea.radar), ...(projectId ? { projeto: projectId } : {}), origem: "ideias" }).toString()}`);
  }

  async function refineWithLiterature(idea: Idea) {
    if (refiningId || refinementInFlight.current || generationInFlight.current) return;
    refinementInFlight.current = true;
    setRefiningId(idea.id);
    setRefinementErrors(current => ({ ...current, [idea.id]: "" }));
    try {
      const { data } = await postAI<{ output?: IdeaRefinement; operationId?: string; pubmedQuery?: string; pubmedTotal?: number; usage?: AIUsage }>("/api/ai/refine-idea", { idea, projectId: projectId || null, language: outputLanguage });
      if (!data.output) throw new AIRequestError("A IA não retornou um refinamento válido. Confira o registro antes de tentar novamente.", data.operationId);
      setRefinements(current => ({ ...current, [idea.id]: { output: data.output!, operationId: data.operationId || "", pubmedQuery: data.pubmedQuery || idea.radar, pubmedTotal: data.pubmedTotal || 0, usage: data.usage } }));
    } catch (error) {
      setRefinementErrors(current => ({ ...current, [idea.id]: error instanceof Error ? `${error.message}${error instanceof AIRequestError && error.operationId ? ` Código da operação: ${error.operationId}.` : ""}` : "Não foi possível refinar esta proposta." }));
    } finally { refinementInFlight.current = false; setRefiningId(""); }
  }

  function applyRefinement(id: string) {
    const refinement = refinements[id];
    if (!refinement) return;
    setIdeas(current => current.map(idea => idea.id === id ? { ...idea, ...refinement.output.refinedProposal, id: idea.id, references: idea.references } : idea));
    if (refinement.operationId) setIdeaOrigins(current => ({ ...current, [id]: { generationId: refinement.operationId, sourceKey: `refinement:${refinement.operationId}:${id}` } }));
    setRefinements(current => { const next = { ...current }; delete next[id]; return next; });
    setMessage("Refinamento baseado na literatura aplicado à proposta. Revise antes de salvar ou transformar em projeto.");
  }

  function restoreVersion(row: SavedIdea) {
    if (ideas.length && !window.confirm(dialogCopy("Retomar esta versão? As propostas atuais continuam disponíveis apenas se já foram salvas."))) return;
    setContext(row.context); setSnapshot(row.context); setIdeas([row.proposal]); setSelected([]); setEditing(null);
    setReferenceIds(row.proposal.references.map(reference => reference.id)); setEvidenceSnapshot(row.evidence_signature);
    series.current = { [row.proposal.id]: row.series_id }; setAiMode("saved"); setMessage("Versão retomada do histórico.");
    setIdeaOrigins({ [row.proposal.id]: { sourceKey: `idea-version:${row.id}` } });
  }

  function transfer(idea: Idea, savedVersion?: SavedIdea) {
    if ((!savedVersion && stale) || library.loading) return;
    try {
      const token = crypto.randomUUID();
      const tracked = ideaOrigins[idea.id];
      const sourceKey = savedVersion ? `idea-version:${savedVersion.id}` : tracked?.sourceKey || `idea:${proposalFingerprint(idea)}`;
      sessionStorage.setItem(transferKey(library.userId, token), JSON.stringify({ ownerId: library.userId, draft: { theme: idea.title, question: idea.question, objective: idea.objective, studyType: idea.studyType, population: idea.population, outcome: idea.outcome, hypothesis: idea.hypothesis || "", inclusion: idea.eligibility || "", exclusion: "", variables: idea.variables, methods: idea.methods, analysis: idea.analysis, ethics: idea.ethics || "", manuscript: ideaBrief(idea) }, referenceIds: idea.references.map(reference => reference.id), origin: { sourceType: "idea", sourceKey, ideaVersionId: savedVersion?.id, seriesId: savedVersion?.series_id || series.current[idea.id], generationId: tracked?.generationId, language: outputLanguage, radarQuery: ideaRadarQuery(idea.radar) } }));
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
    <GenerationDialog open={aiLoading || Boolean(refiningId)} title={refiningId ? "Refinando sua ideia com literatura" : undefined} description={refiningId ? uiText("screen.fb966950677c") : undefined} />
    <header className="max-w-3xl">
      <p className="text-xs uppercase tracking-widest text-teal font-semibold"><InterfaceText message="screen.4754d54d485e" /></p>
      <h1 className="font-display text-4xl md:text-5xl mt-3"><InterfaceText message="screen.21c470be2399" /></h1>
      <p className="text-ink-soft mt-4 leading-relaxed"><InterfaceText message="screen.5d610f411f9d" /></p>
    </header>

    <section className="ideas-mode-tabs" aria-label={uiText("screen.f4360f9a9f63")}>
      {([
        ["automatic", "Gerar para mim", "Use minha área, meu acesso e meu prazo para descobrir oportunidades."],
        ["theme", "Partir de um tema", "Expandir um interesse ou problema inicial em caminhos científicos."],
        ["guided", "Controlar critérios", "Definir população, medidas, recursos e exigências em detalhes."],
      ] as const).map(([mode, label, description]) => <button key={mode} type="button" onClick={() => { setCreationMode(mode); setAiMessage(""); }} aria-pressed={creationMode===mode} title={description} className="ideas-mode-tab"><strong><AuthoredText text={label} /></strong></button>)}
    </section>

    <p className="ideas-mode-description" aria-live="polite">{creationMode==="automatic"?uiText("screen.de43ab554b28"):creationMode==="theme"?"Transforme um interesse ou problema inicial em uma pergunta de pesquisa.":uiText("screen.8fd9b4925db0")}</p>
    <div className="ideas-language-row">
      <div><p className="text-sm font-medium"><InterfaceText message="screen.4ca38f95f292" /></p><p className="text-xs text-ink-soft mt-1"><InterfaceText message="screen.8dae2ea308f4" /></p></div>
      <select aria-label={uiText("screen.4ca38f95f292")} value={outputLanguage} onChange={event => setOutputLanguage(event.target.value as OutputLanguage)} disabled={aiLoading || Boolean(refiningId)} className="border border-line rounded-card px-3 py-2 bg-paper text-sm outline-none focus:border-teal disabled:opacity-50">
        <option value="pt-BR"><InterfaceText message="screen.25c0623b1a61" /></option>
        <option value="en">English</option>
      </select>
    </div>

    {creationMode === "automatic" && <form onSubmit={event => { event.preventDefault(); void createIdeasWithAI(); }} className="ideas-main-form mt-5 bg-white border border-line rounded-2xl p-5 md:p-7">
      <div className="flex flex-wrap justify-between gap-3 items-start"><div><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.451af17a4ec1" /></p><h2 className="font-display text-2xl mt-2"><InterfaceText message="screen.7bcaa2bfeae6" /></h2><p className="text-sm text-ink-soft mt-2 max-w-2xl"><InterfaceText message="screen.caf846ccf606" /></p></div><span className="text-xs bg-teal-soft text-teal rounded-full px-3 py-2"><InterfaceText message="screen.0bd292eef80b" /></span></div>
      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <Text required label={uiText("screen.4bb93a21d5cb")} value={context.specialty} change={value => update("specialty", value)} placeholder={uiText("screen.a4d291514e93")} />
        <Text required label={uiText("screen.833f4ce00f83")} value={context.setting} change={value => update("setting", value)} placeholder={uiText("screen.b3e4f5b6d263")} />
        <Select label={uiText("screen.a1f5024bf38a")} value={context.months} change={value => update("months", value)} options={[["3", "Até 3 meses"], ["6", "Até 6 meses"], ["12", "Até 12 meses"], ["18", "Mais de 12 meses"]]} />
        <Select label={uiText("screen.9ce9e231e5bf")} value={context.access} change={value => update("access", value)} options={[["literature", "Somente literatura"], ["records", "Prontuários ou registros"], ["patients", "Participantes ou pacientes"], ["both", "Registros e participantes"]]} />
      </div>
      <details className="mt-5 border-t border-line pt-4"><summary className="cursor-pointer text-sm text-teal"><InterfaceText message="screen.692157779da5" /></summary><div className="grid md:grid-cols-2 gap-4 mt-4"><Text label={uiText("screen.f9034485d0b3")} value={context.population} change={value => update("population", value)} placeholder={uiText("screen.321abe1bd9c5")} /><Text label={uiText("screen.e54ed4829896")} value={context.requirements || ""} change={value => update("requirements", value)} placeholder={uiText("screen.24cb2c41df05")} /></div></details>
      {!context.setting.trim() && <p className="mt-3 text-sm text-ink-soft"><InterfaceText message="screen.ae2153be05ea" /></p>}
      {aiLoading && <p role="status" className="mt-3 text-sm text-teal"><InterfaceText message="screen.b4f2c9a84e70" /></p>}
      <div className="mt-6 flex flex-wrap gap-3 items-center"><button disabled={aiLoading || profileLoading || library.loading || !aiEnabled || !context.specialty.trim() || !context.setting.trim()} className="bg-teal text-white rounded-card px-6 py-3.5 font-medium disabled:opacity-50">{aiLoading ? "Explorando oportunidades científicas…" : aiEnabled ? uiText("screen.04dd455c5dc2") : uiText("screen.deb28fbe49b5")}</button>{!library.userId && <Link href="/login" className="text-sm text-teal underline"><InterfaceText message="screen.2cca9d1a021e" /></Link>}</div>
    </form>}

    {creationMode === "theme" && <form onSubmit={event => { event.preventDefault(); void createIdeasWithAI(); }} className="ideas-main-form mt-5 bg-white border border-line rounded-2xl p-5 md:p-7">
      <p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.96012881a5bb" /></p><h2 className="font-display text-2xl mt-2"><InterfaceText message="screen.6b061abda14a" /></h2>
      <label className="block text-base font-medium mt-5"><InterfaceText message="screen.9f67823767bf" /><textarea required minLength={10} maxLength={1500} rows={5} value={context.interest} onChange={event => update("interest", event.target.value)} placeholder={uiText("screen.b1ac0e6262d9")} className="block w-full mt-3 border border-line rounded-xl p-4 bg-paper text-base font-normal outline-none focus:border-teal" /></label>
      <div className="grid md:grid-cols-3 gap-4 mt-5"><Text label={uiText("screen.0d94b91a86e4")} value={context.population} change={value => update("population", value)} /><Select label={uiText("screen.b1c784986a24")} value={context.workType || "open"} change={value => update("workType", value)} options={[["open", "Comparar possibilidades"], ["original", "Artigo original"], ["review", "Revisão"], ["case", "Relato de caso"], ["tcc", "TCC"]]} /><Select label={uiText("screen.f367581dbb69")} value={context.months} change={value => update("months", value)} options={[["3", "Até 3 meses"], ["6", "Até 6 meses"], ["12", "Até 12 meses"], ["18", "Mais de 12 meses"]]} /></div>
      <div className="mt-6 flex flex-wrap gap-3 items-center"><button disabled={aiLoading || library.loading || !aiEnabled || context.interest.trim().length < 10} className="bg-teal text-white rounded-card px-6 py-3.5 font-medium disabled:opacity-50">{aiLoading ? uiText("screen.2741760a148a") : uiText("screen.43bb48b5ac6c")}</button><span className="text-xs text-ink-soft"><InterfaceText message="screen.e61d5648bde9" /></span></div>
    </form>}

    {creationMode === "guided" && <form onSubmit={event => { event.preventDefault(); void createIdeasWithAI(); }} className="mt-8 bg-white border border-line rounded-2xl p-5 md:p-7 shadow-sm">
      <label className="block text-base font-medium"><InterfaceText message="screen.319bbf4328bd" />
        <textarea required maxLength={1500} rows={4} value={context.interest} onChange={event => update("interest", event.target.value)} placeholder={uiText("screen.da621b625ec5")} className="block w-full mt-3 border border-line rounded-xl p-4 bg-paper text-base font-normal outline-none focus:border-teal" />
      </label>
      <div className="grid md:grid-cols-2 gap-4 mt-5">
        <Text required label={uiText("screen.44a9b43e844b")} value={context.population} change={value => update("population", value)} placeholder={uiText("screen.07b5537eb008")} />
        <Text label={uiText("screen.9ad310b3e4e2")} value={context.setting} change={value => update("setting", value)} placeholder={uiText("screen.7f913a1ed256")} />
        <Select label={uiText("screen.26a15c469a3d")} value={context.workType || "open"} change={value => update("workType", value)} options={[["open", "Quero comparar possibilidades"], ["tcc", "TCC ou trabalho de conclusão"], ["original", "Estudo ou artigo original"], ["review", "Revisão de literatura"], ["case", "Relato de caso"], ["residency", "Projeto da residência"]]} />
        <div className="grid grid-cols-2 gap-3"><Select label={uiText("screen.f367581dbb69")} value={context.months} change={value => update("months", value)} options={[["3", "Até 3 meses"], ["6", "Até 6 meses"], ["12", "Até 12 meses"], ["18", "Mais de 12 meses"]]} /><Select label={uiText("screen.2ed7ce78e936")} value={context.access} change={value => update("access", value)} options={[["literature", "Literatura"], ["records", "Registros"], ["patients", "Participantes"], ["both", "Registros e participantes"]]} /></div>
      </div>

      <details className="mt-6 border-t border-line pt-5">
        <summary className="cursor-pointer text-sm font-medium text-teal"><InterfaceText message="screen.5ce191c9973a" /> <span className="text-ink-soft font-normal">· opcional</span></summary>
        <div className="grid md:grid-cols-2 gap-4 mt-5">
          <Text label={uiText("screen.be71fbb8613e")} value={context.specialty} change={value => update("specialty", value)} />
          <Text label={uiText("screen.d373375f8977")} value={context.theme} change={value => update("theme", value)} placeholder={uiText("screen.0262c8c38ba6")} />
          <Text label={uiText("screen.fc7e90bff322")} value={context.exposure} change={value => update("exposure", value)} placeholder={uiText("screen.1fde2992c307")} />
          <Text label={uiText("screen.5d5a445edab8")} value={context.measure} change={value => update("measure", value)} placeholder={uiText("screen.747d4fe775f4")} />
          <Text label={uiText("screen.1afcf63f05e4")} value={context.instrument || ""} change={value => update("instrument", value)} placeholder={uiText("screen.21662eddee6d")} />
          <Text label={uiText("screen.7ae45bb461d1")} value={context.availableSample || ""} change={value => update("availableSample", value)} placeholder={uiText("screen.25fa099dde6f")} />
          <Select label={uiText("screen.21b79ffb025d")} value={context.support || "unknown"} change={value => update("support", value)} options={[["unknown", "Ainda não sei"], ["yes", "Tenho orientador"], ["no", "Ainda não tenho orientador"]]} />
          <Select label={uiText("screen.01c0b96f3264")} value={context.authorization || "unknown"} change={value => update("authorization", value)} options={[["unknown", "Ainda não sei"], ["confirmed", "Acesso confirmado"], ["pending", "Depende de autorização"], ["na", "Não se aplica"]]} />
          <Text label={uiText("screen.dbc63c98b68a")} value={context.requirements || ""} change={value => update("requirements", value)} placeholder={uiText("screen.0a4154e8650b")} />
          <Text label={uiText("screen.d21951b58ec9")} value={context.uncertainty || ""} change={value => update("uncertainty", value)} placeholder={uiText("screen.8d12582490c5")} />
        </div>

        {library.userId && <div className="mt-6 border-t border-line pt-5"><p className="text-sm font-medium"><InterfaceText message="screen.25443b1569bf" /></p><div className="flex flex-wrap gap-3 items-end mt-3"><label className="text-sm flex-1"><InterfaceText message="screen.04c074246ce3" /><select value={projectId} onChange={event => { setProjectId(event.target.value); setReferenceIds([]); }} className="block w-full border border-line rounded-card px-3 py-3 mt-2"><option value=""><InterfaceText message="screen.d54a46295ae2" /></option>{library.projects.map(project => <option key={project.id} value={project.id}>{project.title || project.theme || uiText("screen.53d02a124b87")}</option>)}</select></label><button type="button" disabled={!projectId || projectLoading} onClick={applyProject} className="border border-teal/30 text-teal px-4 py-3 rounded-card text-sm disabled:opacity-50">{projectLoading ? uiText("screen.6cc1bbba0f84") : "Usar contexto"}</button></div>{projectError && <p role="alert" className="text-sm text-red-700 mt-2"><AuthoredText text={projectError} /></p>}
          <details className="mt-4"><summary className="cursor-pointer text-sm text-teal"><InterfaceText message="screen.358e6a8cd136" /> {referenceIds.length}/10</summary><input aria-label={uiText("screen.a9d5ab3be31f")} value={referenceQuery} onChange={event => setReferenceQuery(event.target.value)} placeholder={uiText("screen.860b67f1daf1")} className="w-full border border-line rounded-card px-3 py-2 mt-3" /><div className="max-h-72 overflow-y-auto space-y-2 mt-3">{referenceOptions.map(article => <label key={article.id} className="flex gap-3 border border-line rounded-card p-3 text-sm"><input type="checkbox" checked={referenceIds.includes(article.id)} disabled={!referenceIds.includes(article.id) && referenceIds.length >= 10} onChange={() => setReferenceIds(current => current.includes(article.id) ? current.filter(id => id !== article.id) : [...current, article.id])} className="mt-1" /><span>{article.title}<span className="block text-xs text-ink-soft mt-1">{article.year || uiText("screen.0d116becb93b")} · {article.pmid ? `PMID ${article.pmid}` : `DOI ${article.doi}`}</span></span></label>)}</div></details>
        </div>}
      </details>

      <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:items-center">
        <button disabled={aiLoading || profileLoading || library.loading || !aiEnabled} className="bg-teal text-white rounded-card px-6 py-3.5 font-medium disabled:opacity-50">{aiLoading ? uiText("screen.a1e1d000efcb") : aiEnabled ? uiText("screen.ca08d3e91058") : uiText("screen.deb28fbe49b5")}</button>
        {!library.userId && <Link href="/login" className="text-sm text-teal underline"><InterfaceText message="screen.2cca9d1a021e" /></Link>}
        <span className="text-xs text-ink-soft"><InterfaceText message="screen.2bd4075f3cb9" /></span>
      </div>
    </form>}

    {aiMessage && <div role="status" className={`mt-5 rounded-card p-4 text-sm ${aiMode === "simulation" || aiMode === "error" ? "bg-amber-soft" : "bg-teal-soft"}`}><p><AuthoredText text={aiMessage} /></p>{lastUsage && <UsageSummary usage={lastUsage} />}{aiOperation && <><p className="text-xs mt-2"><Link href={`/geracoes/${aiOperation}`} className="text-teal underline"><InterfaceText message="screen.01938c107dd1" /></Link></p><GenerationFeedback operationId={aiOperation} userId={library.userId} /></>}</div>}
    {stale && <p role="status" className="mt-4 bg-amber-soft rounded-card p-4 text-sm"><InterfaceText message="screen.19e295a807a0" /></p>}
    {message && <p role="status" className="mt-4 text-sm text-teal"><AuthoredText text={message} /></p>}

    {ideas.length > 0 && <section id="propostas-geradas" className="mt-10 scroll-mt-24" aria-label={uiText("screen.527c4fcb7372")}>
      <div className="flex flex-wrap justify-between gap-3 items-end"><div><p className="text-xs uppercase tracking-widest text-teal font-semibold">Resultado</p><h2 className="font-display text-3xl mt-2"><InterfaceText message="screen.68ecf8d47262" /></h2><p className="text-sm text-ink-soft mt-2"><InterfaceText message="screen.ead99db1a928" /></p></div><span className="text-sm text-teal">{selected.length}<InterfaceText message="screen.a78859242313" /></span></div>
      <div className="space-y-5 mt-6">{ideas.map((idea, index) => <IdeaCard key={idea.id} idea={idea} index={index} qualityIssues={qualityChecks.find(check => check.proposalIndex === index)?.issues || []} selected={selected.includes(idea.id)} editing={editing === idea.id} stale={stale} saving={saving} loggedIn={Boolean(library.userId)} refining={refiningId === idea.id} refinement={refinements[idea.id]} refinementError={refinementErrors[idea.id] || ""} onCompare={() => toggleComparison(idea.id)} onEdit={() => setEditing(current => current === idea.id ? null : idea.id)} onChange={(key, value) => setIdeas(current => current.map(item => item.id === idea.id ? { ...item, [key]: value } : item))} onRadar={() => void validateInRadar(idea)} onRefine={() => void refineWithLiterature(idea)} onApplyRefinement={() => applyRefinement(idea.id)} onTransfer={() => transfer(idea)} onSave={() => void saveVersion(idea)} onDownload={() => download(idea)} />)}</div>
    </section>}

    {selectedIdeas.length >= 2 && <Comparison ideas={selectedIdeas} />}

    <details className="mt-9"><summary className="cursor-pointer text-sm text-teal font-medium"><InterfaceText message="screen.9d88a8360e69" /></summary><IdeaHistory ownerId={library.userId} refresh={historyRefresh} restore={restoreVersion} createProject={row => transfer(row.proposal, row)} /></details>
  </div>;
}

function IdeaCard({ idea, index, qualityIssues, selected, editing, stale, saving, loggedIn, refining, refinement, refinementError, onCompare, onEdit, onChange, onRadar, onRefine, onApplyRefinement, onTransfer, onSave, onDownload }: { idea: Idea; index: number; qualityIssues: string[]; selected: boolean; editing: boolean; stale: boolean; saving: boolean; loggedIn: boolean; refining: boolean; refinement?: RefinementResult; refinementError: string; onCompare: () => void; onEdit: () => void; onChange: (key: "title" | "question" | "objective" | "outcome" | "methods" | "analysis", value: string) => void; onRadar: () => void; onRefine: () => void; onApplyRefinement: () => void; onTransfer: () => void; onSave: () => void; onDownload: () => void }) {
  const { t: uiText } = useLanguage();
  const pathLabels = ["MAIS VIÁVEL", "MAIS RELEVANTE", "MAIS INOVADORA"];
  return <article className={`bg-white border rounded-2xl p-5 md:p-7 ${selected ? "border-teal shadow-sm" : "border-line"}`}>
    <div className="flex flex-wrap justify-between gap-3"><div><span className="text-xs text-teal font-semibold">{pathLabels[index] || `CAMINHO ${index + 1}`}</span><span className="text-xs bg-teal-soft text-teal rounded-full px-3 py-1 ml-3">{idea.studyType}</span></div><label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={selected} onChange={onCompare} />Comparar</label></div>
    <h3 className="font-display text-2xl md:text-3xl mt-4 leading-snug">{idea.title}</h3>
    <div className="grid md:grid-cols-2 gap-5 mt-6"><Info label={uiText("screen.fdbf4a061cc6")} value={idea.question} /><Info label="Objetivo principal" value={idea.objective} /></div>
    <div className="grid md:grid-cols-3 gap-3 mt-5"><Badge label={uiText("screen.a415f1a5dcce")} value={idea.evaluation?.relevance.label || "A confirmar"} /><Badge label={uiText("screen.f5babe93eed8")} value={idea.evaluation?.feasibility.label || "A confirmar"} /><Badge label={uiText("screen.9e655bf84268")} value={idea.evaluation?.execution.label || "A confirmar"} /></div>
    <p className="mt-5 bg-teal-soft rounded-card p-4 text-sm"><strong className="text-teal"><InterfaceText message="screen.22455cd55e94" /></strong><span className="block text-ink-soft mt-1 leading-relaxed">{idea.feasibility}</span></p>
    <details className={`mt-4 rounded-card border p-4 ${qualityIssues.length ? "border-amber-300 bg-amber-soft" : "border-teal/20 bg-teal-soft/40"}`}><summary className="cursor-pointer text-sm font-medium">{qualityIssues.length ? `${qualityIssues.length} ponto${qualityIssues.length === 1 ? "" : "s"} para revisar` : uiText("screen.f224be2592cc")}</summary><p className="text-xs text-ink-soft mt-2"><InterfaceText message="screen.ef741b52c599" /></p>{qualityIssues.length > 0 && <ul className="list-disc pl-5 mt-3 space-y-2 text-sm text-ink-soft">{qualityIssues.map(issue => <li key={issue}><AuthoredText text={issue} /></li>)}</ul>}</details>

    <details className="mt-5 border-t border-line pt-4"><summary className="cursor-pointer text-teal font-medium"><InterfaceText message="screen.3c589e0f1139" /></summary><dl className="grid md:grid-cols-2 gap-x-6 gap-y-5 mt-5 text-sm">
      <Info label={uiText("screen.0c3a06347847")} value={idea.hypothesis || "Definir com o orientador conforme o desenho escolhido."} />
      <Info label={uiText("screen.be3b16f1e57d")} value={idea.outcome} />
      <Info label={uiText("screen.0ab6aaac0a37")} value={idea.eligibility || idea.population} />
      <Info label={uiText("screen.2e4f1eacff4d")} value={idea.variables} />
      <Info label="Método sugerido" value={idea.methods} />
      <Info label={uiText("screen.97fb364dbc13")} value={idea.analysis} />
      <Info label={uiText("screen.30b7a7ba9b55")} value={idea.ethics || "Confirmar avaliação ética, consentimento e proteção dos dados aplicáveis."} />
      <Info label={uiText("screen.4ac89e13f847")} value={idea.limitations || idea.difficulty} />
      <Info label={uiText("screen.9eeb671b7b71")} value={idea.noveltyCheck || `Testar no Radar: ${idea.radar}`} />
      <Info label={uiText("screen.9025c269561d")} value={idea.resources} />
    </dl><div className="grid md:grid-cols-2 gap-5 mt-6 text-sm"><List title={uiText("screen.3c079482c65b")} values={idea.unresolved} /><List title={uiText("screen.9afdfa4b758f")} values={idea.plan} ordered /></div></details>

    <button type="button" disabled={saving} onClick={onEdit} className="text-sm text-teal mt-5 underline">{editing ? uiText("screen.e13f598b5a95") : uiText("screen.2e6acb733179")}</button>
    {editing && <div className="mt-4 bg-paper border border-line rounded-card p-4 grid md:grid-cols-2 gap-4">{([ ["Título", "title"], ["Pergunta", "question"], ["Objetivo", "objective"], ["Desfecho", "outcome"], ["Métodos", "methods"], ["Análise", "analysis"] ] as const).map(([label, key]) => <label key={key} className="text-sm font-medium"><AuthoredText text={label} /><textarea disabled={saving} maxLength={3000} rows={3} value={idea[key]} onChange={event => onChange(key, event.target.value)} className="block w-full mt-2 border border-line rounded-card p-3 font-normal" /></label>)}</div>}
    {refinement && <RefinementPanel result={refinement} apply={onApplyRefinement} />}
    {refinementError && <p role="alert" className="mt-4 rounded-card bg-amber-soft p-3 text-sm"><AuthoredText text={refinementError} /></p>}
    <p className="mt-5 text-xs text-ink-soft"><InterfaceText message="screen.71e292637da0" /></p>
    <div className="mt-3 flex gap-3 flex-wrap"><button type="button" disabled={!loggedIn || stale || refining || saving} onClick={onRefine} className="bg-teal text-white text-sm rounded-card px-3 py-2 disabled:opacity-50">{refining ? uiText("screen.363d5d503f2d") : uiText("screen.28dfad4eb9d8")}</button><button type="button" disabled={stale || saving || !loggedIn || refining} onClick={onRadar} className="text-teal text-sm border border-teal/30 rounded-card px-3 py-2 disabled:opacity-50">{saving ? uiText("screen.6b5056724381") : uiText("screen.c2a0c49f638c")}</button><button type="button" disabled={stale || saving} onClick={onTransfer} className="bg-ink text-white text-sm rounded-card px-3 py-2 disabled:opacity-50"><InterfaceText message="screen.17d65baee7a0" /></button><button type="button" disabled={stale || saving || !loggedIn} onClick={onSave} className="text-sm text-teal border border-teal/30 rounded-card px-3 py-2 disabled:opacity-50">{saving ? "Salvando…" : uiText("screen.784f681fadeb")}</button><button type="button" disabled={stale} onClick={onDownload} className="text-sm text-teal underline disabled:opacity-50"><InterfaceText message="screen.b45ae836a031" /></button></div>
  </article>;
}

function RefinementPanel({ result, apply }: { result: RefinementResult; apply: () => void }) {
  const { t: uiText } = useLanguage();
  const output = result.output;
  return <section className="mt-6 rounded-2xl border border-teal/30 bg-teal-soft/40 p-5" aria-label={uiText("screen.1318fbd854ef")}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest font-semibold text-teal"><InterfaceText message="screen.9933d8249fbb" /></p><h4 className="font-display text-2xl mt-2">{output.refinedProposal.title}</h4></div><span className="rounded-full bg-white px-3 py-1 text-xs text-teal">{result.pubmedTotal.toLocaleString("pt-BR")} resultados relacionados</span></div>
    <p className="text-sm text-ink-soft mt-3 leading-relaxed">{output.refinementRationale}</p>
    <div className="grid md:grid-cols-2 gap-4 mt-5 text-sm"><Info label={`Estrutura ${output.framework}`} value={output.frameworkElements.map(item => `${item.label}: ${item.value}`).join(" · ")} /><Info label={uiText("screen.9d78db74732a")} value={`${output.literatureSignal}. ${output.gapAssessment}`} /><Info label={uiText("screen.cf61cfb4f282")} value={output.similarityRisk} /><Info label={uiText("screen.e8ba60cadf6d")} value={output.meshTerms.join(" · ")} /></div>
    <div className="mt-5"><p className="text-sm font-medium"><InterfaceText message="screen.fe001b7fea8e" /></p><ul className="mt-2 space-y-2 text-sm text-ink-soft list-disc pl-5">{output.alternativeTitles.map(title => <li key={title}>{title}</li>)}</ul></div>
    <details className="mt-5"><summary className="cursor-pointer text-sm font-medium text-teal"><InterfaceText message="screen.ea64c12e8687" /></summary><ul className="mt-3 space-y-3">{output.sources.map(source => <li key={source.pmid} className="text-sm"><a href={`https://pubmed.ncbi.nlm.nih.gov/${source.pmid}/`} target="_blank" rel="noreferrer" className="font-medium text-teal underline">{source.title}</a><span className="block text-xs text-ink-soft mt-1">PMID {source.pmid} · {source.contribution}</span></li>)}</ul></details>
    <p className="mt-4 text-xs text-ink-soft">{output.caution}</p>
    {result.usage && <UsageSummary usage={result.usage} />}
    <div className="flex flex-wrap gap-3 mt-5"><button type="button" onClick={apply} className="bg-teal text-white rounded-card px-4 py-2 text-sm"><InterfaceText message="screen.f9e6ad47be9a" /></button>{result.operationId && <Link href={`/geracoes/${result.operationId}`} className="text-sm text-teal underline self-center"><InterfaceText message="screen.3140f21921e3" /></Link>}</div>
    {result.operationId && <GenerationFeedback operationId={result.operationId} userId={null} compact />}
  </section>;
}

function UsageSummary({ usage }: { usage: AIUsage }) {
  const total = usage.inputTokens + usage.outputTokens;
  return <p className="text-xs text-ink-soft mt-2">Consumo real: <strong>{total.toLocaleString("pt-BR")} tokens</strong> ({usage.inputTokens.toLocaleString("pt-BR")} de entrada + {usage.outputTokens.toLocaleString("pt-BR")} <InterfaceText message="screen.6922c72e93b2" /></p>;
}

function GenerationFeedback({ operationId, userId, compact = false }: { operationId: string; userId: string | null; compact?: boolean }) {
  const { t: uiText } = useLanguage();
  const [rating, setRating] = useState<"useful" | "partial" | "not_useful" | "">("");
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function save(nextRating = rating) {
    if (!nextRating) return;
    setSaving(true); setMessage("");
    try {
      const client = supabaseBrowser();
      const owner = userId || (await client.auth.getUser()).data.user?.id || null;
      if (!owner) throw new Error("Entre na conta para avaliar.");
      const { error } = await client.from("scholar_generation_reviews").upsert({ usage_id: operationId, user_id: owner, rating: nextRating, feedback: feedback.trim() || null }, { onConflict: "usage_id" });
      if (error) throw error;
      setRating(nextRating); setMessage("Avaliação registrada.");
    } catch { setMessage("Não foi possível registrar a avaliação agora."); }
    finally { setSaving(false); }
  }
  return <div className={`${compact ? "mt-4 border-t border-teal/20 pt-4" : "mt-3"}`}><p className="text-xs font-medium"><InterfaceText message="screen.bc1cf2e0cb14" /></p><div className="flex flex-wrap gap-2 mt-2">{([ ["useful", "Útil"], ["partial", "Parcial"], ["not_useful", "Não útil"] ] as const).map(([value, label]) => <button key={value} type="button" disabled={saving} onClick={() => void save(value)} className={`rounded-full border px-3 py-1.5 text-xs disabled:opacity-50 ${rating === value ? "border-teal bg-teal text-white" : "border-teal/30 bg-white text-teal"}`}><AuthoredText text={label} /></button>)}</div>{(rating === "partial" || rating === "not_useful") && <div className="mt-3"><textarea value={feedback} onChange={event => setFeedback(event.target.value)} maxLength={2000} rows={2} placeholder={uiText("screen.4513163910b8")} className="w-full rounded-card border border-line bg-white p-3 text-xs"/><button type="button" disabled={saving} onClick={() => void save()} className="mt-2 text-xs text-teal underline disabled:opacity-50"><InterfaceText message="screen.22b8e9073221" /></button></div>}{message && <p role="status" className="text-xs text-ink-soft mt-2"><AuthoredText text={message} /></p>}</div>;
}

function Comparison({ ideas }: { ideas: Idea[] }) {
  const { t: uiText } = useLanguage();
  const rows = [["Desenho", "studyType"], ["Pergunta", "question"], ["Desfecho", "outcome"], ["Viabilidade", "feasibility"], ["Limitações", "limitations"]] as const;
  return <section className="mt-8 bg-white border border-line rounded-2xl p-5"><h2 className="font-display text-2xl"><InterfaceText message="screen.0b28badc0dde" /></h2><div className="overflow-x-auto mt-4"><table className="w-full text-sm text-left"><thead><tr><th className="p-3"><InterfaceText message="screen.dea35b6f64ad" /></th>{ideas.map(idea => <th key={idea.id} className="p-3 min-w-64">{idea.title}</th>)}</tr></thead><tbody>{rows.map(([label, key]) => <tr key={key} className="border-t border-line"><th className="p-3 align-top"><AuthoredText text={label} /></th>{ideas.map(idea => <td key={idea.id} className="p-3 align-top text-ink-soft">{idea[key] || uiText("screen.27075d2834bc")}</td>)}</tr>)}</tbody></table></div></section>;
}

function Text({ label, value, change, placeholder, required }: { label: string; value: string; change: (value: string) => void; placeholder?: string; required?: boolean }) { return <label className="text-sm font-medium"><AuthoredText text={label} /><input required={required} maxLength={300} value={value} onChange={event => change(event.target.value)} placeholder={placeholder} className="block w-full mt-2 border border-line rounded-card px-3 py-3 bg-paper outline-none focus:border-teal" /></label>; }
function Select({ label, value, change, options }: { label: string; value: string; change: (value: string) => void; options: string[][] }) { return <label className="text-sm font-medium"><AuthoredText text={label} /><select value={value} onChange={event => change(event.target.value)} className="block w-full mt-2 border border-line rounded-card px-3 py-3 bg-paper outline-none focus:border-teal">{options.map(([option, title]) => <option key={option} value={option}>{title}</option>)}</select></label>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="font-medium"><AuthoredText text={label} /></p><p className="text-ink-soft mt-1 leading-relaxed">{value}</p></div>; }
function Badge({ label, value }: { label: string; value: string }) { return <div className="border border-line rounded-card p-3"><span className="text-xs text-ink-soft"><AuthoredText text={label} /></span><strong className="block text-teal mt-1">{value}</strong></div>; }
function List({ title, values, ordered = false }: { title: string; values: string[]; ordered?: boolean }) { const Tag = ordered ? "ol" : "ul"; return <div><h4 className="font-medium">{title}</h4><Tag className={`${ordered ? "list-decimal" : "list-disc"} pl-5 space-y-2 mt-2 text-ink-soft`}>{values.map(value => <li key={value}>{value}</li>)}</Tag></div>; }
