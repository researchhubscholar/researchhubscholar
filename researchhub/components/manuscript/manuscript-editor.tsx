"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Project = { id: string; title?: string | null; theme?: string | null; research_question?: string | null; objective?: string | null; study_type?: string | null };
type Manuscript = { id: string; title: string; subtitle: string; article_type: string; target_journal: string; language: string; status: string } | null;
type Section = { section_key: string; heading: string; content: string; position: number; updated_at?: string };
type Version = { id: string; label: string; snapshot: unknown; created_at: string };
type Article = { id: string; title: string; authors: unknown; publication_year: number | null; pmid: string | null; doi: string | null };

const sectionTemplates: Omit<Section, "content">[] = [
  { section_key: "abstract", heading: "Resumo", position: 10 },
  { section_key: "introduction", heading: "Introdução", position: 20 },
  { section_key: "methods", heading: "Métodos", position: 30 },
  { section_key: "results", heading: "Resultados", position: 40 },
  { section_key: "discussion", heading: "Discussão", position: 50 },
  { section_key: "limitations", heading: "Limitações", position: 60 },
  { section_key: "conclusion", heading: "Conclusão", position: 70 },
  { section_key: "references", heading: "Referências", position: 80 },
];
const guidance: Record<string, string> = {
  abstract: "Estruture contexto, objetivo, método, resultados e conclusão. Finalize esta seção depois das demais.",
  introduction: "Apresente o problema, o conhecimento disponível, a lacuna e termine com o objetivo do estudo.",
  methods: "Permita que outro pesquisador compreenda e reproduza o percurso: desenho, cenário, participantes, variáveis, análise e ética.",
  results: "Registre somente resultados realmente obtidos. Não antecipe interpretação e nunca preencha dados hipotéticos como reais.",
  discussion: "Interprete os achados, compare-os com a literatura, explore implicações e hipóteses explicativas.",
  limitations: "Declare vieses, incertezas, limites de validade e fatores que restringem a generalização.",
  conclusion: "Responda ao objetivo sem extrapolar os resultados e indique implicações compatíveis com o desenho.",
  references: "Use as referências do projeto. A formatação final poderá ser ajustada conforme o periódico escolhido.",
};

function wordCount(value: string) { return value.trim() ? value.trim().split(/\s+/).length : 0; }
function firstAuthor(article: Article) {
  if (!Array.isArray(article.authors) || !article.authors.length) return "Autor";
  const author = article.authors[0];
  if (typeof author === "string") return author.split(/[, ]/)[0] || "Autor";
  if (author && typeof author === "object") {
    const data = author as Record<string, unknown>;
    return String(data.family || data.last_name || data.name || "Autor").split(/[, ]/)[0];
  }
  return "Autor";
}
function displayDate(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }

export default function ManuscriptEditor({ ownerId, project, initialManuscript, initialSections, initialVersions, articles }: { ownerId: string; project: Project; initialManuscript: Manuscript; initialSections: Section[]; initialVersions: Version[]; articles: Article[] }) {
  const hydrated = sectionTemplates.map(template => ({ ...template, content: initialSections.find(section => section.section_key === template.section_key)?.content || "" }));
  const [manuscriptId, setManuscriptId] = useState(initialManuscript?.id || "");
  const [title, setTitle] = useState(initialManuscript?.title || project.title || project.theme || "");
  const [subtitle, setSubtitle] = useState(initialManuscript?.subtitle || "");
  const [articleType, setArticleType] = useState(initialManuscript?.article_type || "original");
  const [targetJournal, setTargetJournal] = useState(initialManuscript?.target_journal || "");
  const [status, setStatus] = useState(initialManuscript?.status || "draft");
  const [sections, setSections] = useState<Section[]>(hydrated);
  const [versions, setVersions] = useState<Version[]>(initialVersions);
  const [activeKey, setActiveKey] = useState("introduction");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(initialManuscript ? "Manuscrito carregado." : "Comece a escrever. O primeiro salvamento criará o manuscrito deste projeto.");
  const [showSources, setShowSources] = useState(false);
  const stateRef = useRef({ title, subtitle, articleType, targetJournal, status, sections, manuscriptId });
  stateRef.current = { title, subtitle, articleType, targetJournal, status, sections, manuscriptId };

  const totalWords = useMemo(() => sections.reduce((sum, section) => sum + wordCount(section.content), 0), [sections]);
  const completed = sections.filter(section => wordCount(section.content) >= (section.section_key === "abstract" ? 80 : 40)).length;
  const progress = Math.round(completed / sections.length * 100);

  useEffect(() => {
    if (!dirty) return;
    const backup = window.setTimeout(() => {
      try { window.localStorage.setItem(`scholar-manuscript:${ownerId}:${project.id}`, JSON.stringify(stateRef.current)); } catch { /* Account save remains available. */ }
    }, 300);
    const autosave = window.setTimeout(() => { void save(false); }, 1800);
    return () => { window.clearTimeout(backup); window.clearTimeout(autosave); };
  // save deliberately reads the latest state through stateRef.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, title, subtitle, articleType, targetJournal, status, sections]);

  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);

  function markMetadata(setter: (value: string) => void, value: string) { setter(value); setDirty(true); setMessage("Alterações ainda não salvas."); }
  function updateSection(key: string, content: string) { setSections(current => current.map(section => section.section_key === key ? { ...section, content } : section)); setDirty(true); setMessage("Alterações ainda não salvas."); }

  async function save(showConfirmation = true) {
    if (saving) return;
    setSaving(true);
    const current = stateRef.current;
    try {
      const db = supabaseBrowser();
      let id = current.manuscriptId;
      const metadata = { owner_id: ownerId, project_id: project.id, title: current.title.trim(), subtitle: current.subtitle.trim(), article_type: current.articleType, target_journal: current.targetJournal.trim(), language: "pt-BR", status: current.status };
      if (!id) {
        const { data, error } = await db.from("scholar_manuscripts").insert(metadata).select("id").single();
        if (error || !data) throw error || new Error("Manuscrito não criado");
        id = data.id; setManuscriptId(id); stateRef.current.manuscriptId = id;
      } else {
        const { error } = await db.from("scholar_manuscripts").update(metadata).eq("id", id).eq("owner_id", ownerId);
        if (error) throw error;
      }
      const rows = current.sections.map(section => ({ manuscript_id: id, owner_id: ownerId, section_key: section.section_key, heading: section.heading, content: section.content, position: section.position }));
      const { error: sectionError } = await db.from("scholar_manuscript_sections").upsert(rows, { onConflict: "manuscript_id,section_key" });
      if (sectionError) throw sectionError;
      setDirty(false); setMessage(showConfirmation ? "Manuscrito salvo na sua conta." : `Salvo automaticamente às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`);
      try { window.localStorage.removeItem(`scholar-manuscript:${ownerId}:${project.id}`); } catch { /* Database copy is confirmed. */ }
    } catch { setMessage("Não foi possível sincronizar agora. A cópia deste dispositivo foi preservada."); }
    finally { setSaving(false); }
  }

  async function createVersion() {
    if (dirty || !manuscriptId) await save(false);
    const id = stateRef.current.manuscriptId;
    if (!id) { setMessage("Salve o manuscrito antes de criar uma versão."); return; }
    const label = `Versão de ${new Date().toLocaleDateString("pt-BR")} — ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    const snapshot = { title: stateRef.current.title, subtitle: stateRef.current.subtitle, articleType: stateRef.current.articleType, targetJournal: stateRef.current.targetJournal, status: stateRef.current.status, sections: stateRef.current.sections };
    const db = supabaseBrowser();
    const { data, error } = await db.from("scholar_manuscript_versions").insert({ manuscript_id: id, owner_id: ownerId, label, snapshot }).select("id,label,snapshot,created_at").single();
    if (error || !data) { setMessage("Não foi possível criar a versão."); return; }
    setVersions(current => [data, ...current].slice(0, 12)); setMessage("Versão preservada no histórico.");
  }

  function restoreVersion(version: Version) {
    const snapshot = version.snapshot as Record<string, unknown>;
    if (!snapshot || !Array.isArray(snapshot.sections)) return;
    setTitle(typeof snapshot.title === "string" ? snapshot.title : title);
    setSubtitle(typeof snapshot.subtitle === "string" ? snapshot.subtitle : subtitle);
    setArticleType(typeof snapshot.articleType === "string" ? snapshot.articleType : articleType);
    setTargetJournal(typeof snapshot.targetJournal === "string" ? snapshot.targetJournal : targetJournal);
    setStatus(typeof snapshot.status === "string" ? snapshot.status : status);
    setSections(snapshot.sections as Section[]); setDirty(true); setMessage(`A versão “${version.label}” foi carregada. Salve para confirmar a restauração.`);
  }

  function cite(article: Article) {
    const year = article.publication_year || "s.d.";
    const citation = `(${firstAuthor(article)} et al., ${year})`;
    const current = sections.find(section => section.section_key === activeKey);
    if (!current) return;
    updateSection(activeKey, `${current.content}${current.content.trim() ? " " : ""}${citation}`);
    setMessage(`Citação adicionada em ${current.heading}. Confira o estilo exigido pelo periódico.`);
  }

  return <div className="manuscript-workspace grid xl:grid-cols-[220px_minmax(0,1fr)_280px] gap-6 items-start">
    <aside className="bg-white border border-line rounded-2xl p-4 xl:sticky xl:top-24"><p className="text-xs uppercase tracking-widest text-teal">Estrutura</p><div className="mt-4 h-2 bg-line rounded-full overflow-hidden"><div className="h-full bg-teal" style={{ width: `${progress}%` }} /></div><p className="text-xs text-ink-soft mt-2">{completed} de {sections.length} seções iniciadas</p><nav className="mt-4 space-y-1">{sections.map(section => <button key={section.section_key} onClick={() => { setActiveKey(section.section_key); document.getElementById(`section-${section.section_key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className={`w-full text-left rounded-card p-2 text-sm ${activeKey === section.section_key ? "bg-teal-soft text-teal" : "hover:bg-paper"}`}><span className="inline-block w-6 text-xs">{wordCount(section.content) ? "✓" : "○"}</span>{section.heading}</button>)}</nav><div className="border-t border-line mt-4 pt-4 text-xs text-ink-soft"><p>{totalWords.toLocaleString("pt-BR")} palavras</p><p className="mt-1">{message}</p></div></aside>

    <div className="min-w-0 space-y-5"><section className="bg-white border border-line rounded-2xl p-5 md:p-7"><div className="grid md:grid-cols-2 gap-4"><label className="md:col-span-2 text-sm font-medium">Título científico<input value={title} onChange={event => markMetadata(setTitle, event.target.value)} className="block w-full mt-2 border border-line rounded-card p-3 bg-paper text-lg" /></label><label className="md:col-span-2 text-sm font-medium">Subtítulo — opcional<input value={subtitle} onChange={event => markMetadata(setSubtitle, event.target.value)} className="block w-full mt-2 border border-line rounded-card p-3 bg-paper" /></label><label className="text-sm font-medium">Tipo de manuscrito<select value={articleType} onChange={event => markMetadata(setArticleType, event.target.value)} className="block w-full mt-2 border border-line rounded-card p-3 bg-paper"><option value="original">Artigo original</option><option value="review">Revisão</option><option value="case-report">Relato de caso</option><option value="brief-report">Comunicação breve</option></select></label><label className="text-sm font-medium">Periódico pretendido<input value={targetJournal} onChange={event => markMetadata(setTargetJournal, event.target.value)} placeholder="Opcional nesta fase" className="block w-full mt-2 border border-line rounded-card p-3 bg-paper" /></label></div></section>
      {sections.map(section => <section key={section.section_key} id={`section-${section.section_key}`} className="scroll-mt-28 bg-white border border-line rounded-2xl p-5 md:p-7" onFocus={() => setActiveKey(section.section_key)}><div className="flex justify-between gap-4 items-start"><div><p className="text-xs uppercase tracking-widest text-teal">Seção científica</p><h2 className="font-display text-2xl mt-2">{section.heading}</h2></div><span className="text-xs text-ink-soft whitespace-nowrap">{wordCount(section.content)} palavras</span></div><p className="text-sm text-ink-soft mt-3 leading-relaxed">{guidance[section.section_key]}</p><textarea value={section.content} onChange={event => updateSection(section.section_key, event.target.value)} rows={section.section_key === "references" ? 7 : 12} placeholder={`Escreva ${section.heading.toLowerCase()} aqui…`} className="manuscript-textarea block w-full mt-5 border border-line rounded-card p-4 bg-paper leading-7 outline-none focus:border-teal resize-y" /></section>)}
      <div className="bg-ink text-white rounded-2xl p-5 flex flex-wrap gap-4 justify-between items-center"><div><p className="text-xs uppercase text-teal-soft">Salvamento seguro</p><p className="text-sm text-white/70 mt-2">O autosave preserva o texto; versões registram marcos importantes.</p></div><div className="flex flex-wrap gap-3"><button onClick={() => void createVersion()} disabled={saving} className="border border-white/30 rounded-card px-4 py-3 disabled:opacity-50">Criar versão</button><button onClick={() => void save(true)} disabled={saving} className="bg-white text-ink rounded-card px-4 py-3 font-medium disabled:opacity-50">{saving ? "Salvando…" : "Salvar agora"}</button></div></div>
    </div>

    <aside className="space-y-5 xl:sticky xl:top-24"><section className="bg-white border border-line rounded-2xl p-5"><p className="text-xs uppercase tracking-widest text-teal">Base do projeto</p><h3 className="font-display text-xl mt-2">Coerência científica</h3><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-ink-soft">Pergunta</dt><dd className="mt-1">{project.research_question || "Ainda não definida"}</dd></div><div><dt className="text-xs text-ink-soft">Objetivo</dt><dd className="mt-1">{project.objective || "Ainda não definido"}</dd></div><div><dt className="text-xs text-ink-soft">Desenho</dt><dd className="mt-1">{project.study_type || "Ainda não definido"}</dd></div></dl><Link href={`/meu-trabalho?id=${project.id}`} className="inline-block text-sm text-teal mt-4">Revisar protocolo →</Link></section>
      <section className="bg-white border border-line rounded-2xl p-5"><button onClick={() => setShowSources(value => !value)} className="w-full flex justify-between items-center text-left"><span><span className="block text-xs uppercase tracking-widest text-teal">Fontes do projeto</span><span className="block font-display text-xl mt-2">Inserir citação</span></span><span>{showSources ? "−" : "+"}</span></button>{showSources && <div className="mt-4 space-y-3 max-h-[420px] overflow-auto">{articles.length ? articles.map(article => <article key={article.id} className="border-t border-line pt-3"><p className="text-sm line-clamp-3">{article.title}</p><p className="text-xs text-ink-soft mt-1">{firstAuthor(article)} · {article.publication_year || "sem ano"}</p><button onClick={() => cite(article)} className="text-xs text-teal mt-2">Inserir na seção ativa →</button></article>) : <p className="text-sm text-ink-soft">Vincule artigos pela Biblioteca para citá-los durante a escrita.</p>}<Link href={`/biblioteca?projeto=${project.id}`} className="inline-block text-sm text-teal mt-2">Abrir Biblioteca →</Link></div>}</section>
      <section className="bg-white border border-line rounded-2xl p-5"><div className="flex justify-between gap-3 items-center"><div><p className="text-xs uppercase tracking-widest text-teal">Histórico</p><h3 className="font-display text-xl mt-2">Versões</h3></div><select value={status} onChange={event => markMetadata(setStatus, event.target.value)} className="text-xs border border-line rounded-card p-2 bg-paper"><option value="draft">Rascunho</option><option value="review">Em revisão</option><option value="ready">Pronto</option><option value="submitted">Submetido</option></select></div><div className="mt-4 space-y-3">{versions.length ? versions.map(version => <div key={version.id} className="border-t border-line pt-3"><p className="text-xs">{version.label}</p><p className="text-[11px] text-ink-soft mt-1">{displayDate(version.created_at)}</p><button onClick={() => restoreVersion(version)} className="text-xs text-teal mt-2">Carregar esta versão</button></div>) : <p className="text-sm text-ink-soft">Crie uma versão antes de uma revisão importante.</p>}</div></section>
    </aside>
  </div>;
}
