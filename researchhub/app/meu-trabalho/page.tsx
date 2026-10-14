"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { readIdeaTransfer, type TransferOrigin } from "@/lib/ideas/transfer";
import { LibraryStore } from "@/lib/literature/library-store";
import { supabaseBrowser } from "@/lib/supabase/browser";

import ProjectSharing from "@/components/access/project-sharing";
import ProjectJourney from "@/components/projects/journey";
import AssistantPanel from "@/components/ai/assistant-panel";
import { buildProtocolDoc, download } from "@/lib/exports/scientific";
import { protocolChecks } from "@/lib/research/checks";
import { diagnoseProjectDraft, initialProjectMilestones, projectOriginRow } from "@/lib/projects/creation";

type Draft = { theme: string; question: string; objective: string; studyType: string; population: string; outcome: string; hypothesis: string; inclusion: string; exclusion: string; variables: string; methods: string; analysis: string; ethics: string; manuscript: string };
type SaveState = "loading" | "idle" | "saved" | "local" | "error";
const empty: Draft = { theme: "", question: "", objective: "", studyType: "Observacional transversal", population: "", outcome: "", hypothesis: "", inclusion: "", exclusion: "", variables: "", methods: "", analysis: "", ethics: "", manuscript: "" };
const groups: { id: string; title: string; keys: (keyof Draft)[] }[] = [
  { id: "pergunta", title: "Tema e pergunta", keys: ["theme", "question"] },
  { id: "objetivos", title: "Objetivo e hipótese", keys: ["objective"] },
  { id: "populacao", title: "Desenho e população", keys: ["studyType", "population", "inclusion", "exclusion"] },
  { id: "desfechos", title: "Desfechos e variáveis", keys: ["outcome", "variables"] },
  { id: "metodos", title: "Métodos, análise e ética", keys: ["methods", "analysis", "ethics"] },
  { id: "manuscrito", title: "Planejamento do manuscrito", keys: ["manuscript"] },
];
const labels: Record<keyof Draft, string> = { theme: "Tema do trabalho", question: "Pergunta de pesquisa", objective: "Objetivo geral", studyType: "Desenho do estudo", population: "População", outcome: "Desfecho principal", hypothesis: "Hipótese ou pressuposto (quando aplicável)", inclusion: "Critérios de inclusão", exclusion: "Critérios de exclusão", variables: "Variáveis e formas de medir", methods: "Procedimentos e coleta de dados", analysis: "Plano de análise", ethics: "Considerações éticas", manuscript: "Plano e notas do manuscrito" };
const columns: Record<keyof Draft, string> = { theme: "theme", question: "research_question", objective: "objective", studyType: "study_type", population: "population", outcome: "primary_outcome", hypothesis: "hypothesis", inclusion: "inclusion_criteria", exclusion: "exclusion_criteria", variables: "variables", methods: "methods", analysis: "analysis_plan", ethics: "ethics_notes", manuscript: "manuscript_notes" };
const selection = "id, status, theme, research_question, objective, study_type, population, primary_outcome, hypothesis, inclusion_criteria, exclusion_criteria, variables, methods, analysis_plan, ethics_notes, manuscript_notes";
function fromRecord(record: Record<string, unknown>): Draft {
  const draft = { ...empty };
  (Object.keys(columns) as (keyof Draft)[]).forEach(key => { draft[key] = typeof record[columns[key]] === "string" ? record[columns[key]] as string : empty[key]; });
  return draft;
}

export default function MeuTrabalhoPage() {
  const savingLock = useRef(false);
  const draftRevision = useRef(0);
  const [originRadarQuery, setOriginRadarQuery] = useState("");
  const [draft, setDraft] = useState<Draft>({ ...empty });
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const [incomingReferences, setIncomingReferences] = useState<string[]>([]);
  const [referenceIds, setReferenceIds] = useState<string[]>([]);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<Draft | null>(null);
  const [incomingOrigin, setIncomingOrigin] = useState<TransferOrigin | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState("draft");
  const [loggedIn, setLoggedIn] = useState(false);
  const [storageKey, setStorageKey] = useState("researchhub-scholar-draft");
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      const params = new URLSearchParams(window.location.search);
      const theme = params.get("tema");
      const isNew = params.get("novo") === "1";
      const isIdea = params.get("origem") === "ideias";
      if (theme && isIdea) setIncoming({ ...empty, theme, question: params.get("pergunta") || "", objective: params.get("objetivo") || "", studyType: params.get("desenho") || empty.studyType, population: params.get("populacao") || "", outcome: params.get("desfecho") || "", methods: params.get("metodos") || "", analysis: params.get("analise") || "", variables: params.get("variaveis") || "" });
      try {
        const db = supabaseBrowser();
        const { data: auth, error: authError } = await db.auth.getUser();
        if (authError && authError.name !== "AuthSessionMissingError" && !auth.user) throw new Error("Não foi possível verificar sua sessão. Entre novamente ou tente atualizar a página.");
        if (!active) return;
        setLoggedIn(Boolean(auth.user)); setLoadedOwner(auth.user?.id || null);
        if (isIdea && params.get("proposta")) {
          try {
            const transfer = readIdeaTransfer(window.sessionStorage, auth.user?.id || null, params.get("proposta")!);
            setIncoming({ ...empty, ...transfer.draft }); setIncomingReferences(transfer.referenceIds); setIncomingOrigin(transfer.origin);
          } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível recuperar a proposta."); }
        }
        const key = auth.user ? `researchhub-scholar-draft:${auth.user.id}` : "researchhub-scholar-draft";
        setStorageKey(key);
        if (auth.user && !isNew) {
          let query = db.from("research_projects").select(selection).eq("owner_id", auth.user.id);
          if (params.get("id")) query = query.eq("id", params.get("id"));
          const { data, error } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
          if (!active) return;
          if (error) throw new Error("Não foi possível carregar o projeto. Atualize a página para tentar novamente.");
          if (data) {
            setDraft(fromRecord(data));
            const { data: origin } = await db.from("scholar_project_origins").select("snapshot").eq("owner_id", auth.user.id).eq("project_id", data.id).maybeSingle();
            if (!active) return;
            setOriginRadarQuery(typeof origin?.snapshot?.radarQuery === "string" ? origin.snapshot.radarQuery.slice(0, 2000) : "");
            try {
              const pending = JSON.parse(window.localStorage.getItem(key) || "{}");
              if (pending._projectId === data.id && Array.isArray(pending._referenceIds)) setReferenceIds(pending._referenceIds.filter((id: unknown) => typeof id === "string").slice(0, 10));
            } catch { /* The account copy remains available. */ }
            setProjectId(data.id); setProjectStatus(data.status || "draft"); setSaveState("saved");
            // Um tema vindo do Radar também inicia uma proposta, sem alterar o projeto salvo.
            if (theme && !isIdea) setIncoming({ ...empty, theme });
            return;
          }
          if (params.get("id")) throw new Error("Projeto não encontrado nesta conta. Abra Meu espaço para selecionar um projeto disponível.");
        }
        if (!isNew && !params.get("id")) {
          try {
            const stored = window.localStorage.getItem(key);
            if (stored) {
              const local = JSON.parse(stored);
              const restored = { ...empty };
              (Object.keys(empty) as (keyof Draft)[]).forEach(k => { if (typeof local[k] === "string") restored[k] = local[k]; });
              setDraft(restored);
              if (auth.user && Array.isArray(local._referenceIds)) setReferenceIds(local._referenceIds.filter((id: unknown) => typeof id === "string").slice(0, 10));
            }
          } catch { setMessage("Não foi possível recuperar a cópia local. Você pode criar um novo rascunho."); }
        }
        if (theme && !isIdea) { setDraft({ ...empty, theme }); setDirty(true); }
        setSaveState("idle");
      } catch (err) {
        if (active) { setMessage(err instanceof Error ? err.message : "Não foi possível carregar o projeto."); setSaveState("error"); }
      }
    }
    void load();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  function change(key: keyof Draft, value: string) { draftRevision.current += 1; setDraft(d => ({ ...d, [key]: value })); setDirty(true); setSaveState("idle"); setMessage(""); }
  const filled = groups.flatMap(g => g.keys).filter(k => draft[k].trim()).length;
  const total = groups.reduce((sum, g) => sum + g.keys.length, 0);
  const progress = Math.round(filled / total * 100);
  async function applyIncoming() {
    if (!incoming) return;
    if (incomingOrigin && loadedOwner) {
      const { data, error } = await supabaseBrowser().from("scholar_project_origins").select("project_id").eq("owner_id", loadedOwner).eq("source_key", incomingOrigin.sourceKey).maybeSingle();
      if (!error && data?.project_id) {
        setMessage("Esta proposta já foi transformada em projeto. Abrindo o projeto existente para evitar uma duplicação.");
        window.location.assign(`/meu-trabalho?id=${encodeURIComponent(data.project_id)}`);
        return;
      }
    }
    draftRevision.current += 1; setOriginRadarQuery(incomingOrigin?.radarQuery || "");
    setDraft(incoming); setReferenceIds(incomingReferences); setIncomingReferences([]); setProjectId(null); setProjectStatus("draft"); setIncoming(null); setDirty(true); setSaveState("idle");
    setMessage("Proposta aplicada a um novo rascunho. Revise os campos antes de salvar.");
    window.history.replaceState(null, "", window.location.pathname);
  }
  async function saveDraft() {
    if (saveState === "loading" || savingLock.current) return;
    if (!draft.theme.trim()) { setMessage("Informe um tema para identificar seu projeto."); setReview(true); return; }
    const savingRevision = draftRevision.current;
    savingLock.current = true;
    setSaveState("loading"); setMessage("");
    let localSaved = false;
    try { window.localStorage.setItem(storageKey, JSON.stringify({ ...draft, _referenceIds: referenceIds, _projectId: projectId })); localSaved = true; } catch { /* O salvamento na conta continua disponível. */ }
    try {
      const db = supabaseBrowser();
      const { data: auth, error: authError } = await db.auth.getUser();
      if (authError && authError.name !== "AuthSessionMissingError") throw authError;
      if (!auth.user) {
        setSaveState(localSaved ? "local" : "error"); setDirty(!localSaved);
        setMessage(localSaved ? "Rascunho salvo neste dispositivo. Entre para salvar na sua conta." : "Não foi possível salvar neste dispositivo. Entre para salvar na conta."); return;
      }
      if (loadedOwner && auth.user.id !== loadedOwner) throw new Error("A conta mudou. Atualize a página antes de salvar.");
      const creatingProject = !projectId;
      const payload: Record<string, unknown> = { owner_id: auth.user.id, title: draft.theme.trim(), progress, status: projectStatus };
      (Object.keys(columns) as (keyof Draft)[]).forEach(key => { payload[columns[key]] = draft[key].trim() || null; });
      const query = projectId ? db.from("research_projects").update(payload).eq("id", projectId).eq("owner_id", auth.user.id) : db.from("research_projects").insert(payload);
      const { data, error } = await query.select("id").single();
      if (error || !data) throw error || new Error("Projeto não salvo");
      setProjectId(data.id); setLoggedIn(true);
      let setupMessage = "";
      const diagnosis = diagnoseProjectDraft(draft);
      if (creatingProject && incomingOrigin) {
        const { error: originError } = await db.from("scholar_project_origins").insert(projectOriginRow(auth.user.id, data.id, incomingOrigin, draft, diagnosis, referenceIds));
        if (originError?.code === "23505") {
          const { data: existing } = await db.from("scholar_project_origins").select("project_id").eq("owner_id", auth.user.id).eq("source_key", incomingOrigin.sourceKey).maybeSingle();
          if (existing?.project_id && existing.project_id !== data.id) {
            await db.from("research_projects").delete().eq("id", data.id).eq("owner_id", auth.user.id);
            window.location.assign(`/meu-trabalho?id=${encodeURIComponent(existing.project_id)}`);
            return;
          }
        } else if (originError) {
          setupMessage += " A origem ainda não foi registrada; execute scholar_project_origins.sql.";
        } else {
          setupMessage += " A origem da ideia foi preservada.";
        }
      }
      if (creatingProject) {
        const { error: milestoneError } = await db.from("scholar_project_milestones").upsert(initialProjectMilestones(auth.user.id, data.id, draft, diagnosis), { onConflict: "owner_id,project_id,milestone_key" });
        if (milestoneError) setupMessage += " A jornada adaptada aparece na tela, mas ainda não pôde ser inicializada na conta.";
        else setupMessage += " A jornada foi iniciada conforme o desenho do estudo.";
      }
      let referenceMessage = "";
      let referenceFailure = false;
      if (referenceIds.length) {
        try {
          const linked = await new LibraryStore(db, auth.user.id).attachUnassigned(referenceIds, data.id);
          referenceMessage = ` ${linked.attached} referências associadas ao projeto.`;
          if (linked.retained) referenceMessage += ` ${linked.retained} já pertencem a outro projeto e continuam citadas nas notas do protocolo.`;
          if (linked.missing) referenceMessage += ` ${linked.missing} referências não estão mais disponíveis na biblioteca desta conta.`;
          setReferenceIds([]);
        } catch { referenceFailure = true; referenceMessage = " As referências continuam nas notas, mas não foi possível concluir a associação na biblioteca. Clique em Salvar alterações para tentar novamente."; }
      }
      const changedDuringSave = draftRevision.current !== savingRevision;
      setSaveState("saved"); setDirty(changedDuringSave);
      setMessage((changedDuringSave ? "A versão enviada foi salva. Há alterações mais recentes ainda pendentes; clique em Salvar alterações novamente." : "Projeto salvo na sua conta. Você pode abri-lo em Meu espaço.") + setupMessage + referenceMessage);
      window.history.replaceState(null, "", `/meu-trabalho?id=${encodeURIComponent(data.id)}`);
      try { if (changedDuringSave) { window.localStorage.setItem(storageKey, JSON.stringify({ ...latestDraft.current, _referenceIds: referenceFailure ? referenceIds : [], _projectId: data.id })); } else if (referenceFailure) window.localStorage.setItem(storageKey, JSON.stringify({ ...draft, _referenceIds: referenceIds, _projectId: data.id })); else window.localStorage.removeItem(storageKey); } catch { /* A cópia na conta foi confirmada. */ }
    } catch {
      setSaveState(localSaved ? "local" : "error"); setDirty(!localSaved);
      setMessage(localSaved ? "A cópia local foi preservada, mas não foi possível sincronizar. Tente salvar novamente." : "Não foi possível salvar. Mantenha a página aberta e tente novamente.");
    } finally { savingLock.current = false; }
  }
  function exportProtocol() {
    const sections = groups.map(g => ({ title: g.title, fields: [...g.keys.map(k => ({ label: labels[k], value: draft[k] })), ...(g.id === "objetivos" ? [{ label: labels.hypothesis, value: draft.hypothesis }] : [])] }));
    download(buildProtocolDoc(draft.theme, sections), "application/msword;charset=utf-8", "protocolo-scholar.doc");
  }
  const notes = [
    ...protocolChecks(draft),
    ...groups.filter(g => !g.keys.every(k => draft[k].trim())).map(g => `Complete o bloco ${g.title.toLowerCase()} para registrar as decisões pendentes.`),
    ...(draft.studyType.includes("Revisão") ? ["Na revisão, defina bases, estratégia de busca, critérios de seleção e avaliação crítica."] : ["No estudo com dados ou participantes, registre autorizações, proteção dos dados e avaliação ética aplicável."]),
    "Confira com o orientador se pergunta, objetivo, desfecho e método respondem à mesma questão.",
  ];
  const creationDiagnosis = diagnoseProjectDraft(draft);
  const radarHref = projectId ? `/descobrir?${new URLSearchParams({
    tema: originRadarQuery || draft.question.trim() || draft.theme.trim(),
    populacao: draft.population.trim(),
    desfecho: draft.outcome.trim(),
    desenho: draft.studyType.trim(),
    projeto: projectId,
    origem: "projeto",
  }).toString()}` : "/descobrir";
  return <div className="scholar-workspace project-page max-w-6xl mx-auto grid lg:grid-cols-[260px_1fr] gap-8 lg:gap-10">
    <aside className="project-sidebar lg:sticky lg:top-24 self-start"><Link href="/dashboard" className="text-sm text-teal">← Meu espaço</Link><p className="text-xs uppercase tracking-widest text-teal mt-6">Meu projeto</p><h1 className="font-display text-2xl mt-2">Construtor científico</h1>
      <div className="mt-5 h-2 bg-line rounded-full overflow-hidden"><div className="h-full bg-teal transition-all" style={{ width: `${progress}%` }} /></div><p className="text-xs text-ink-soft mt-2">{progress}% dos campos principais preenchidos</p><p className="text-xs text-ink-soft mt-1">O preenchimento não indica validação científica.</p>
      <div role="status" className={`mt-4 rounded-card p-3 text-xs ${saveState === "saved" ? "bg-teal-soft text-teal" : saveState === "error" ? "bg-red-50 text-red-700" : "bg-white border border-line"}`}>{saveState === "loading" ? "Aguarde…" : dirty ? "Alterações ainda não salvas" : saveState === "saved" ? "✓ Salvo na conta" : saveState === "local" ? "Cópia salva neste dispositivo" : loggedIn ? "Novo rascunho" : "Entre para salvar na conta"}</div>
      <nav aria-label="Blocos do protocolo" className="mt-5 grid grid-cols-2 lg:grid-cols-1 gap-1">{groups.map((g, i) => <a key={g.id} href={`#${g.id}`} className="text-sm rounded-card p-2 hover:bg-teal-soft"><span className="text-teal mr-2">{g.keys.every(k => draft[k].trim()) ? "✓" : String(i + 1).padStart(2, "0")}</span>{g.title}</a>)}</nav>{projectId && <Link href={radarHref} className="block text-sm text-teal mt-4">Pesquisar literatura →</Link>}<Link href="/biblioteca" className="block text-sm text-teal mt-3">Referências e matriz →</Link>
    </aside>
    <div className="project-content"><header className="project-intro"><p className="text-xs uppercase tracking-widest text-teal">Da pergunta ao protocolo</p><h2 className="font-display text-4xl md:text-5xl mt-3">Dê estrutura à sua pesquisa.</h2><p className="text-ink-soft mt-4 leading-relaxed">Registre as decisões de cada etapa e exporte um rascunho para discutir com seu orientador.</p><div className="project-intro-steps" aria-label="Fluxo do projeto"><span>Definir</span><i aria-hidden="true" /><span>Estruturar</span><i aria-hidden="true" /><span>Revisar</span><i aria-hidden="true" /><span>Compartilhar</span></div></header>
      {incoming && <section className="project-incoming mt-6 bg-teal-soft border border-teal/20 rounded-2xl p-5"><p className="text-xs text-teal uppercase">Proposta recebida · origem rastreável</p><h3 className="font-display text-2xl mt-2">{incoming.theme}</h3><p className="text-sm text-ink-soft mt-3">Abra um novo rascunho com esta proposta. Antes de criar, o Scholar confere se ela já originou outro projeto.</p>{incomingReferences.length > 0 && <p className="text-sm text-ink-soft mt-3">{incomingReferences.length} referências e suas observações acompanham a proposta nas notas. Ao salvar, os artigos sem projeto serão associados; os já vinculados a outro projeto permanecerão lá.</p>}<div className="flex flex-wrap gap-3 mt-4"><button disabled={saveState === "loading"} onClick={() => void applyIncoming()} className="bg-teal text-white rounded-card px-4 py-2 disabled:opacity-50">Criar rascunho com esta ideia</button><button onClick={() => { setIncoming(null); setIncomingReferences([]); setIncomingOrigin(null); }} className="border border-line rounded-card px-4 py-2">Continuar projeto atual</button></div></section>}
      {referenceIds.length > 0 && <p className="mt-4 bg-teal-soft rounded-card p-4 text-sm">{referenceIds.length} referências aguardam associação ao salvar. A justificativa, as decisões pendentes e as referências estão nas notas do manuscrito.</p>}
      {message && <p role={saveState === "error" ? "alert" : "status"} className="mt-5 bg-white border border-line rounded-card p-4 text-sm">{message}</p>}
      {(projectId || dirty) && <section className="mt-6 bg-white border border-line rounded-2xl p-5" aria-label="Diagnóstico inicial do projeto"><div className="flex flex-wrap justify-between gap-3 items-start"><div><p className="text-xs uppercase tracking-widest text-teal">Diagnóstico inicial</p><h3 className="font-display text-2xl mt-2">{creationDiagnosis.pending.length ? "Confirmações antes da execução" : "Estrutura inicial pronta para validação"}</h3></div><span className={`rounded-full px-3 py-1.5 text-xs ${creationDiagnosis.pending.length ? "bg-amber-soft text-amber-900" : "bg-teal-soft text-teal"}`}>{creationDiagnosis.pending.length} pendência{creationDiagnosis.pending.length === 1 ? "" : "s"}</span></div><p className="text-sm mt-4"><strong>Próxima ação:</strong> {creationDiagnosis.nextAction}</p>{creationDiagnosis.pending.length > 0 && <ul className="list-disc pl-5 mt-4 space-y-2 text-sm text-ink-soft">{creationDiagnosis.pending.map(item => <li key={item}>{item}</li>)}</ul>}<p className="text-xs text-ink-soft mt-4">Diagnóstico por regras de preenchimento; não representa aprovação científica, ética ou metodológica.</p></section>}
      <ProjectJourney projectId={projectId} ownerId={loadedOwner} studyType={draft.studyType} />
      <AssistantPanel feature="protocol" title="Revisar coerência científica do projeto" description="Analisa a relação entre pergunta, objetivo, desenho, população, desfecho, método, análise e ética. Você escolhe cada alteração que deseja aplicar." context={draft} projectId={projectId} onApply={item=>{const aliases: Record<string,keyof Draft> = {research_question:"question",study_type:"studyType",primary_outcome:"outcome",inclusion_criteria:"inclusion",exclusion_criteria:"exclusion",analysis_plan:"analysis",ethics_notes:"ethics",manuscript_notes:"manuscript",method:"methods",eligibility:"inclusion",title:"theme"}; const key = aliases[item.targetField] || item.targetField; if(key in draft){change(key as keyof Draft,item.content); setMessage(`Sugestão aplicada em ${labels[key as keyof Draft]}. Salve as alterações para registrar na conta.`); document.getElementById(groups.find(group=>group.keys.includes(key as keyof Draft))?.id || "objetivos")?.scrollIntoView({behavior:"smooth",block:"start"});} else {setMessage(`A sugestão não indicou um campo reconhecido (${item.targetField}). Copie o texto para o bloco apropriado.`);}}} />
      <fieldset disabled={saveState === "loading"} className="project-sections space-y-5 mt-8 disabled:opacity-60"><legend className="sr-only">Campos do protocolo</legend>
        {groups.map((g, index) => <section key={g.id} id={g.id} className="project-block project-stage-card scroll-mt-40 bg-white border border-line rounded-2xl p-5 md:p-6"><p className="text-xs uppercase tracking-widest text-teal">Bloco {index + 1}</p><h3 className="font-display text-2xl mt-2">{g.title}</h3><div className="space-y-5 mt-5">{g.keys.map(key => key === "studyType" ? <label key={key} className="block text-sm font-medium">{labels[key]}<select value={draft[key]} onChange={e => change(key, e.target.value)} className="block w-full mt-2 border border-line rounded-card px-3 py-3 bg-paper">{["Observacional transversal", "Coorte", "Caso-controle", "Ensaio clínico", "Revisão integrativa", "Revisão sistemática", "Relato de caso"].map(v => <option key={v}>{v}</option>)}</select></label> : <Field key={key} label={labels[key]} value={draft[key]} change={v => change(key, v)} short={key === "theme" || key === "population"} placeholder={key === "question" ? "Defina população, condição ou exposição e o que deseja investigar." : key === "methods" ? "Descreva onde, como, por quem e em qual período os dados serão coletados." : key === "analysis" ? "Relacione cada objetivo às variáveis e à análise prevista. Registre dúvidas para o orientador." : key === "manuscript" ? "Planeje seções, responsáveis, prazos e pontos que precisam de revisão." : undefined} />)}
          {g.id === "objetivos" && <Field label={labels.hypothesis} value={draft.hypothesis} change={v => change("hypothesis", v)} placeholder="Registre uma hipótese apenas quando fizer sentido para o desenho." />}</div>
        </section>)}
      </fieldset>
      <ProjectSharing projectId={projectId} />
      <section className="project-review-card mt-6 bg-teal-soft border border-teal/20 rounded-2xl p-5"><div className="flex flex-wrap justify-between items-center gap-3"><div><p className="text-xs uppercase text-teal">Revisão guiada</p><h3 className="font-display text-xl mt-2">O que falta decidir?</h3></div><button onClick={() => setReview(v => !v)} className="border border-teal/30 rounded-card px-4 py-2 text-sm">{review ? "Recolher checklist" : "Revisar estrutura"}</button></div>{review && <div className="mt-4 space-y-3">{notes.map(note => <p key={note} className="text-sm text-ink-soft">• {note}</p>)}<p className="text-xs text-ink-soft">Verificações por regras de texto podem deixar passar diferenças de sentido ou apontar sinônimos. Confira os itens com seu orientador; não indicam validação científica.</p></div>}</section>
      <div className="project-action-panel mt-6 bg-ink text-white rounded-2xl p-6 flex flex-col md:flex-row gap-5 justify-between items-start"><div><p className="text-xs uppercase text-teal-soft">Seu protocolo</p><h3 className="font-display text-2xl mt-2">{draft.theme || "Um projeto em construção"}</h3><p className="text-sm text-white/70 mt-3">{draft.question || "Comece pela pergunta que você quer responder."}</p></div><div className="flex gap-3 flex-wrap shrink-0"><button onClick={saveDraft} disabled={saveState === "loading"} className="bg-white text-ink rounded-card px-4 py-3 font-medium disabled:opacity-50">{saveState === "loading" ? "Aguarde…" : projectId ? "Salvar alterações" : "Salvar projeto"}</button>{projectId && <><Link href={radarHref} className="bg-teal text-white rounded-card px-4 py-3 font-medium">Pesquisar literatura</Link><Link href={`/manuscrito?projeto=${projectId}`} className="border border-white/30 rounded-card px-4 py-3">Escrever artigo</Link><Link href={`/biblioteca?projeto=${projectId}`} className="border border-white/30 rounded-card px-4 py-3">Artigos deste projeto</Link><Link href={`/resultados?projeto=${projectId}`} className="border border-white/30 rounded-card px-4 py-3">Resultados e figuras</Link><Link href={`/documentos?projeto=${projectId}`} className="border border-white/30 rounded-card px-4 py-3">Documentos</Link><Link href={`/orientacao?projeto=${projectId}`} className="border border-white/30 rounded-card px-4 py-3">Orientação</Link></>}<button onClick={exportProtocol} disabled={saveState === "loading" || !draft.theme.trim()} className="border border-white/30 rounded-card px-4 py-3 disabled:opacity-50">Exportação rápida</button></div></div>
    </div>
  </div>;
}
function Field({ label, value, change, short, placeholder }: { label: string; value: string; change: (value: string) => void; short?: boolean; placeholder?: string }) {
  const cls = "block w-full mt-2 border border-line rounded-card px-3 py-3 bg-paper outline-none focus:border-teal font-normal";
  return <label className="block text-sm font-medium">{label}{short ? <input value={value} onChange={e => change(e.target.value)} placeholder={placeholder} className={cls} /> : <textarea rows={3} value={value} onChange={e => change(e.target.value)} placeholder={placeholder} className={cls} />}</label>;
}
