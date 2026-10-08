"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Project = { id: string; title?: string | null; theme?: string | null; research_question?: string | null; objective?: string | null; study_type?: string | null };
type Manuscript = { id: string; title: string; subtitle: string; authors?: unknown; affiliations?: unknown; keywords?: string[]; article_type: string; target_journal: string; citation_style?: string; citation_ids?: string[]; language: string; status: string } | null;
type Section = { section_key: string; heading: string; content: string; position: number; updated_at?: string };
type Version = { id: string; label: string; snapshot: unknown; created_at: string };
type Article = { id: string; title: string; authors: unknown; publication_year: number | null; pmid: string | null; doi: string | null };
type ManuscriptComment = { id: string; manuscript_id: string; project_id: string; author_id: string; section_key: string; body: string; quoted_text: string | null; status: "open" | "resolved"; resolved_at?: string | null; resolved_by?: string | null; created_at: string };
type CommentReply = { id: string; comment_id: string; author_id: string; body: string; created_at: string };

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
function stringList(value: unknown) { return Array.isArray(value) ? value.filter(item => typeof item === "string") as string[] : []; }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] || char); }
function paragraphs(value: string) { return value.split(/\n+/).filter(Boolean).map(line => `<p>${escapeHtml(line)}</p>`).join(""); }
function authorNames(article: Article) {
  if (!Array.isArray(article.authors)) return ["Autor não informado"];
  return article.authors.map(author => {
    if (typeof author === "string") return author;
    if (author && typeof author === "object") { const data = author as Record<string, unknown>; return String(data.name || [data.family, data.given].filter(Boolean).join(" ") || "Autor não informado"); }
    return "Autor não informado";
  }).filter(Boolean);
}
function formattedReference(article: Article, index: number, style: string) {
  const authors = authorNames(article);
  const year = article.publication_year || "s.d.";
  const locator = article.doi ? `https://doi.org/${article.doi}` : article.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/` : "";
  if (style === "abnt") return `${authors.map(name => name.toUpperCase()).join("; ")}. ${article.title}. ${year}.${locator ? ` Disponível em: ${locator}.` : ""}`;
  return `${index + 1}. ${authors.slice(0, 6).join(", ")}${authors.length > 6 ? ", et al." : "."} ${article.title}. ${year}.${locator ? ` ${locator}` : ""}`;
}

export default function ManuscriptEditor({ currentUserId, ownerId, canEdit, project, initialManuscript, initialSections, initialVersions, initialComments, initialReplies, reviewAvailable, articles }: { currentUserId: string; ownerId: string; canEdit: boolean; project: Project; initialManuscript: Manuscript; initialSections: Section[]; initialVersions: Version[]; initialComments: ManuscriptComment[]; initialReplies: CommentReply[]; reviewAvailable: boolean; articles: Article[] }) {
  const hydrated = sectionTemplates.map(template => ({ ...template, content: initialSections.find(section => section.section_key === template.section_key)?.content || "" }));
  const [manuscriptId, setManuscriptId] = useState(initialManuscript?.id || "");
  const [title, setTitle] = useState(initialManuscript?.title || project.title || project.theme || "");
  const [subtitle, setSubtitle] = useState(initialManuscript?.subtitle || "");
  const [authors, setAuthors] = useState(stringList(initialManuscript?.authors).join("\n"));
  const [affiliations, setAffiliations] = useState(stringList(initialManuscript?.affiliations).join("\n"));
  const [keywords, setKeywords] = useState((initialManuscript?.keywords || []).join(", "));
  const [articleType, setArticleType] = useState(initialManuscript?.article_type || "original");
  const [targetJournal, setTargetJournal] = useState(initialManuscript?.target_journal || "");
  const [citationStyle, setCitationStyle] = useState(initialManuscript?.citation_style || "vancouver");
  const [citationIds, setCitationIds] = useState<string[]>(initialManuscript?.citation_ids || []);
  const [status, setStatus] = useState(initialManuscript?.status || "draft");
  const [sections, setSections] = useState<Section[]>(hydrated);
  const [versions, setVersions] = useState<Version[]>(initialVersions);
  const [activeKey, setActiveKey] = useState("introduction");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(initialManuscript ? "Manuscrito carregado." : "Comece a escrever. O primeiro salvamento criará o manuscrito deste projeto.");
  const [showSources, setShowSources] = useState(false);
  const [comments, setComments] = useState<ManuscriptComment[]>(initialComments);
  const [replies, setReplies] = useState<CommentReply[]>(initialReplies);
  const [activeReview, setActiveReview] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [quotes, setQuotes] = useState<Record<string, string>>({});
  const [reviewBusy, setReviewBusy] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const stateRef = useRef({ title, subtitle, authors, affiliations, keywords, articleType, targetJournal, citationStyle, citationIds, status, sections, manuscriptId });
  stateRef.current = { title, subtitle, authors, affiliations, keywords, articleType, targetJournal, citationStyle, citationIds, status, sections, manuscriptId };

  const totalWords = useMemo(() => sections.reduce((sum, section) => sum + wordCount(section.content), 0), [sections]);
  const completed = sections.filter(section => wordCount(section.content) >= (section.section_key === "abstract" ? 80 : 40)).length;
  const progress = Math.round(completed / sections.length * 100);

  useEffect(() => {
    if (!dirty || !canEdit) return;
    const backup = window.setTimeout(() => {
      try { window.localStorage.setItem(`scholar-manuscript:${ownerId}:${project.id}`, JSON.stringify(stateRef.current)); } catch { /* Account save remains available. */ }
    }, 300);
    const autosave = window.setTimeout(() => { void save(false); }, 1800);
    return () => { window.clearTimeout(backup); window.clearTimeout(autosave); };
  // save deliberately reads the latest state through stateRef.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, dirty, title, subtitle, authors, affiliations, keywords, articleType, targetJournal, citationStyle, citationIds, status, sections]);

  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);

  function markMetadata(setter: (value: string) => void, value: string) { setter(value); setDirty(true); setMessage("Alterações ainda não salvas."); }
  function updateSection(key: string, content: string) { setSections(current => current.map(section => section.section_key === key ? { ...section, content } : section)); setDirty(true); setMessage("Alterações ainda não salvas."); }

  async function save(showConfirmation = true) {
    if (!canEdit) return;
    if (saving) return;
    setSaving(true);
    const current = stateRef.current;
    try {
      const db = supabaseBrowser();
      let id = current.manuscriptId;
      const metadata = { owner_id: ownerId, project_id: project.id, title: current.title.trim(), subtitle: current.subtitle.trim(), authors: current.authors.split("\n").map(value => value.trim()).filter(Boolean), affiliations: current.affiliations.split("\n").map(value => value.trim()).filter(Boolean), keywords: current.keywords.split(",").map(value => value.trim()).filter(Boolean), article_type: current.articleType, target_journal: current.targetJournal.trim(), citation_style: current.citationStyle, citation_ids: current.citationIds, language: "pt-BR", status: current.status };
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
    if (!canEdit) return;
    if (dirty || !manuscriptId) await save(false);
    const id = stateRef.current.manuscriptId;
    if (!id) { setMessage("Salve o manuscrito antes de criar uma versão."); return; }
    const label = `Versão de ${new Date().toLocaleDateString("pt-BR")} — ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    const snapshot = { title: stateRef.current.title, subtitle: stateRef.current.subtitle, authors: stateRef.current.authors, affiliations: stateRef.current.affiliations, keywords: stateRef.current.keywords, articleType: stateRef.current.articleType, targetJournal: stateRef.current.targetJournal, citationStyle: stateRef.current.citationStyle, citationIds: stateRef.current.citationIds, status: stateRef.current.status, sections: stateRef.current.sections };
    const db = supabaseBrowser();
    const { data, error } = await db.from("scholar_manuscript_versions").insert({ manuscript_id: id, owner_id: ownerId, label, snapshot }).select("id,label,snapshot,created_at").single();
    if (error || !data) { setMessage("Não foi possível criar a versão."); return; }
    setVersions(current => [data, ...current].slice(0, 12)); setMessage("Versão preservada no histórico.");
  }

  function restoreVersion(version: Version) {
    if (!canEdit) return;
    const snapshot = version.snapshot as Record<string, unknown>;
    if (!snapshot || !Array.isArray(snapshot.sections)) return;
    setTitle(typeof snapshot.title === "string" ? snapshot.title : title);
    setSubtitle(typeof snapshot.subtitle === "string" ? snapshot.subtitle : subtitle);
    setAuthors(typeof snapshot.authors === "string" ? snapshot.authors : authors);
    setAffiliations(typeof snapshot.affiliations === "string" ? snapshot.affiliations : affiliations);
    setKeywords(typeof snapshot.keywords === "string" ? snapshot.keywords : keywords);
    setArticleType(typeof snapshot.articleType === "string" ? snapshot.articleType : articleType);
    setTargetJournal(typeof snapshot.targetJournal === "string" ? snapshot.targetJournal : targetJournal);
    setCitationStyle(typeof snapshot.citationStyle === "string" ? snapshot.citationStyle : citationStyle);
    setCitationIds(Array.isArray(snapshot.citationIds) ? snapshot.citationIds.filter(item => typeof item === "string") as string[] : citationIds);
    setStatus(typeof snapshot.status === "string" ? snapshot.status : status);
    setSections(snapshot.sections as Section[]); setDirty(true); setMessage(`A versão “${version.label}” foi carregada. Salve para confirmar a restauração.`);
  }

  function cite(article: Article) {
    const nextIds = citationIds.includes(article.id) ? citationIds : [...citationIds, article.id];
    const number = nextIds.indexOf(article.id) + 1;
    const year = article.publication_year || "s.d.";
    const citation = citationStyle === "vancouver" ? `[${number}]` : `(${firstAuthor(article)} et al., ${year})`;
    const current = sections.find(section => section.section_key === activeKey);
    if (!current) return;
    setCitationIds(nextIds);
    updateSection(activeKey, `${current.content}${current.content.trim() ? " " : ""}${citation}`);
    setMessage(`Citação adicionada em ${current.heading}. Confira o estilo exigido pelo periódico.`);
  }

  function applyAbstractTemplate() {
    const current = sections.find(section => section.section_key === "abstract");
    if (!current || (current.content.trim() && !window.confirm("Substituir o conteúdo atual do resumo pela estrutura sugerida?"))) return;
    const template = articleType === "case-report" ? "Contexto:\nDescrição do caso:\nDiscussão:\nConclusão:" : articleType === "review" ? "Contexto:\nObjetivo:\nMétodos:\nResultados:\nConclusão:" : "Introdução:\nObjetivo:\nMétodos:\nResultados:\nConclusão:";
    updateSection("abstract", template); setActiveKey("abstract");
  }

  function syncReferences() {
    const cited = citationIds.map(id => articles.find(article => article.id === id)).filter(Boolean) as Article[];
    if (!cited.length) { setMessage("Insira ao menos uma citação antes de gerar as referências."); return; }
    updateSection("references", cited.map((article, index) => formattedReference(article, index, citationStyle)).join("\n\n"));
    setMessage(`${cited.length} referências foram formatadas em ${citationStyle === "vancouver" ? "Vancouver" : "ABNT"}.`);
  }

  function exportWord() {
    const cited = citationIds.map(id => articles.find(article => article.id === id)).filter(Boolean) as Article[];
    const body = sections.map(section => `<h2>${escapeHtml(section.heading)}</h2>${paragraphs(section.section_key === "references" && cited.length ? cited.map((article, index) => formattedReference(article, index, citationStyle)).join("\n\n") : section.content)}`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.6;margin:3cm;color:#111}h1{text-align:center;font-size:18pt}h2{font-size:14pt;margin-top:24pt}p{text-align:justify;margin:0 0 10pt}.meta{text-align:center;color:#444}</style></head><body><h1>${escapeHtml(title || "Manuscrito")}</h1>${subtitle ? `<p class="meta">${escapeHtml(subtitle)}</p>` : ""}<p class="meta">${escapeHtml(authors.split("\n").filter(Boolean).join("; "))}</p><p class="meta">${escapeHtml(affiliations.split("\n").filter(Boolean).join("; "))}</p>${body}<h2>Palavras-chave</h2><p>${escapeHtml(keywords)}</p></body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${(title || "manuscrito").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.doc`; anchor.click(); URL.revokeObjectURL(url);
    setMessage("Arquivo Word gerado. Revise a formatação conforme as normas do periódico.");
  }

  async function addComment(sectionKey: string) {
    const body = (commentDrafts[sectionKey] || "").trim();
    if (!reviewAvailable) { setMessage("Ative o módulo de revisão no Supabase para comentar."); return; }
    if (!manuscriptId) { setMessage("Salve o manuscrito antes de iniciar a revisão."); return; }
    if (body.length < 2) { setMessage("Escreva o comentário antes de publicar."); return; }
    setReviewBusy(`comment:${sectionKey}`);
    const db = supabaseBrowser();
    const { data, error } = await db.from("scholar_manuscript_comments").insert({ manuscript_id: manuscriptId, project_id: project.id, author_id: currentUserId, section_key: sectionKey, body, quoted_text: quotes[sectionKey]?.trim() || null }).select("id,manuscript_id,project_id,author_id,section_key,body,quoted_text,status,resolved_at,resolved_by,created_at").single();
    if (error || !data) setMessage("Não foi possível publicar o comentário.");
    else { setComments(current => [...current, data]); setCommentDrafts(current => ({ ...current, [sectionKey]: "" })); setQuotes(current => ({ ...current, [sectionKey]: "" })); setMessage("Comentário publicado na revisão."); }
    setReviewBusy("");
  }

  async function addReply(commentId: string) {
    const body = (replyDrafts[commentId] || "").trim();
    if (body.length < 2) return;
    setReviewBusy(`reply:${commentId}`);
    const db = supabaseBrowser();
    const { data, error } = await db.from("scholar_manuscript_comment_replies").insert({ comment_id: commentId, author_id: currentUserId, body }).select("id,comment_id,author_id,body,created_at").single();
    if (error || !data) setMessage("Não foi possível publicar a resposta.");
    else { setReplies(current => [...current, data]); setReplyDrafts(current => ({ ...current, [commentId]: "" })); setMessage("Resposta adicionada."); }
    setReviewBusy("");
  }

  async function toggleResolved(comment: ManuscriptComment) {
    setReviewBusy(`resolve:${comment.id}`);
    const resolved = comment.status !== "resolved";
    const db = supabaseBrowser();
    const { error } = await db.rpc("scholar_resolve_manuscript_comment", { p_comment: comment.id, p_resolved: resolved });
    if (error) setMessage("Não foi possível atualizar a pendência.");
    else { setComments(current => current.map(item => item.id === comment.id ? { ...item, status: resolved ? "resolved" : "open", resolved_at: resolved ? new Date().toISOString() : null, resolved_by: resolved ? currentUserId : null } : item)); setMessage(resolved ? "Comentário marcado como resolvido." : "Comentário reaberto."); }
    setReviewBusy("");
  }

  function toggleComparison(id: string) {
    setCompareIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current.slice(-1), id]);
  }

  const comparisonVersions = compareIds.map(id => versions.find(version => version.id === id)).filter(Boolean) as Version[];
  const comparisonSections = useMemo(() => {
    if (comparisonVersions.length !== 2) return [];
    const snapshots = comparisonVersions.map(version => version.snapshot as Record<string, unknown>);
    const sectionLists = snapshots.map(snapshot => Array.isArray(snapshot?.sections) ? snapshot.sections as Section[] : []);
    return sectionTemplates.map(template => {
      const before = sectionLists[0].find(section => section.section_key === template.section_key)?.content || "";
      const after = sectionLists[1].find(section => section.section_key === template.section_key)?.content || "";
      return { ...template, before, after };
    }).filter(section => section.before !== section.after);
  }, [comparisonVersions]);

  const openComments = comments.filter(comment => comment.status === "open");

  const editorialChecks = [
    [Boolean(title.trim()), "Título definido"],
    [Boolean(authors.trim()), "Autores informados"],
    [Boolean(affiliations.trim()), "Afiliações informadas"],
    [keywords.split(",").filter(value => value.trim()).length >= 3, "Ao menos três palavras-chave"],
    [wordCount(sections.find(section => section.section_key === "abstract")?.content || "") >= 80, "Resumo iniciado"],
    [sections.filter(section => !["abstract", "references"].includes(section.section_key)).every(section => section.content.trim()), "Seções principais preenchidas"],
    [citationIds.length > 0, "Referências citadas no texto"],
  ] as const;

  return <div className="manuscript-workspace grid xl:grid-cols-[220px_minmax(0,1fr)_280px] gap-6 items-start">
    <section className={`xl:col-span-3 rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3 ${canEdit ? "bg-teal-soft border-teal/20" : "bg-white border-line"}`}><div><p className="text-xs uppercase tracking-widest text-teal">{canEdit ? "Modo autor" : "Modo orientador"}</p><p className="text-sm text-ink-soft mt-1">{canEdit ? "Você edita o texto e pode responder às observações da revisão." : "O texto está protegido. Selecione um trecho para comentá-lo e acompanhe as respostas do autor."}</p></div><p className="text-sm"><strong className="text-ink">{openComments.length}</strong> {openComments.length === 1 ? "pendência aberta" : "pendências abertas"}</p></section>
    <aside className="bg-white border border-line rounded-2xl p-4 xl:sticky xl:top-24"><p className="text-xs uppercase tracking-widest text-teal">Estrutura</p><div className="mt-4 h-2 bg-line rounded-full overflow-hidden"><div className="h-full bg-teal" style={{ width: `${progress}%` }} /></div><p className="text-xs text-ink-soft mt-2">{completed} de {sections.length} seções iniciadas</p><nav className="mt-4 space-y-1">{sections.map(section => <button key={section.section_key} onClick={() => { setActiveKey(section.section_key); document.getElementById(`section-${section.section_key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className={`w-full text-left rounded-card p-2 text-sm ${activeKey === section.section_key ? "bg-teal-soft text-teal" : "hover:bg-paper"}`}><span className="inline-block w-6 text-xs">{wordCount(section.content) ? "✓" : "○"}</span>{section.heading}</button>)}</nav><div className="border-t border-line mt-4 pt-4 text-xs text-ink-soft"><p>{totalWords.toLocaleString("pt-BR")} palavras</p><p className="mt-1">{message}</p></div></aside>

    <div className="min-w-0 space-y-5"><section className="bg-white border border-line rounded-2xl p-5 md:p-7"><div className="grid md:grid-cols-2 gap-4"><label className="md:col-span-2 text-sm font-medium">Título científico<input disabled={!canEdit} value={title} onChange={event => markMetadata(setTitle, event.target.value)} className="block w-full mt-2 border border-line rounded-card p-3 bg-paper text-lg disabled:opacity-70" /></label><label className="md:col-span-2 text-sm font-medium">Subtítulo — opcional<input disabled={!canEdit} value={subtitle} onChange={event => markMetadata(setSubtitle, event.target.value)} className="block w-full mt-2 border border-line rounded-card p-3 bg-paper disabled:opacity-70" /></label><label className="text-sm font-medium">Autores — um por linha<textarea disabled={!canEdit} rows={3} value={authors} onChange={event => markMetadata(setAuthors, event.target.value)} placeholder="Nome completo de cada autor" className="block w-full mt-2 border border-line rounded-card p-3 bg-paper disabled:opacity-70" /></label><label className="text-sm font-medium">Afiliações — uma por linha<textarea disabled={!canEdit} rows={3} value={affiliations} onChange={event => markMetadata(setAffiliations, event.target.value)} placeholder="Instituição, cidade, país" className="block w-full mt-2 border border-line rounded-card p-3 bg-paper disabled:opacity-70" /></label><label className="md:col-span-2 text-sm font-medium">Palavras-chave — separadas por vírgula<input disabled={!canEdit} value={keywords} onChange={event => markMetadata(setKeywords, event.target.value)} placeholder="Ex.: residência médica, educação médica, qualidade de vida" className="block w-full mt-2 border border-line rounded-card p-3 bg-paper disabled:opacity-70" /></label><label className="text-sm font-medium">Tipo de manuscrito<select disabled={!canEdit} value={articleType} onChange={event => markMetadata(setArticleType, event.target.value)} className="block w-full mt-2 border border-line rounded-card p-3 bg-paper disabled:opacity-70"><option value="original">Artigo original</option><option value="review">Revisão</option><option value="case-report">Relato de caso</option><option value="brief-report">Comunicação breve</option></select></label><label className="text-sm font-medium">Periódico pretendido<input disabled={!canEdit} value={targetJournal} onChange={event => markMetadata(setTargetJournal, event.target.value)} placeholder="Opcional nesta fase" className="block w-full mt-2 border border-line rounded-card p-3 bg-paper disabled:opacity-70" /></label></div></section>
      {sections.map(section => {
        const sectionComments = comments.filter(comment => comment.section_key === section.section_key);
        const sectionOpen = sectionComments.filter(comment => comment.status === "open").length;
        return <section key={section.section_key} id={`section-${section.section_key}`} className="scroll-mt-28 bg-white border border-line rounded-2xl p-5 md:p-7" onFocus={() => setActiveKey(section.section_key)}><div className="flex justify-between gap-4 items-start"><div><p className="text-xs uppercase tracking-widest text-teal">Seção científica</p><h2 className="font-display text-2xl mt-2">{section.heading}</h2></div><div className="text-right"><span className="text-xs text-ink-soft whitespace-nowrap">{wordCount(section.content)} palavras</span>{canEdit && section.section_key === "abstract" && <button onClick={applyAbstractTemplate} className="block text-xs text-teal mt-2">Aplicar estrutura →</button>}{canEdit && section.section_key === "references" && <button onClick={syncReferences} className="block text-xs text-teal mt-2">Formatar citações →</button>}</div></div><p className="text-sm text-ink-soft mt-3 leading-relaxed">{guidance[section.section_key]}</p><textarea readOnly={!canEdit} value={section.content} onChange={event => updateSection(section.section_key, event.target.value)} onSelect={event => { const field = event.currentTarget; const selected = field.value.slice(field.selectionStart, field.selectionEnd).trim().slice(0, 2000); if (selected) setQuotes(current => ({ ...current, [section.section_key]: selected })); }} rows={section.section_key === "references" ? 7 : 12} placeholder={`Escreva ${section.heading.toLowerCase()} aqui…`} className="manuscript-textarea block w-full mt-5 border border-line rounded-card p-4 bg-paper leading-7 outline-none focus:border-teal resize-y read-only:text-ink-soft" />
          <div className="border-t border-line mt-5 pt-4"><button type="button" onClick={() => setActiveReview(current => current === section.section_key ? null : section.section_key)} className="w-full flex items-center justify-between text-left"><span><span className="text-sm font-medium">Revisão desta seção</span><span className="text-xs text-ink-soft ml-2">{sectionComments.length} comentários · {sectionOpen} abertos</span></span><span className="text-teal">{activeReview === section.section_key ? "−" : "+"}</span></button>
            {activeReview === section.section_key && <div className="mt-4 space-y-4">
              {!reviewAvailable && <p className="rounded-card bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">Execute <strong>scholar_manuscript_review.sql</strong> para ativar comentários e respostas.</p>}
              {sectionComments.map(comment => <article key={comment.id} className={`rounded-card border p-4 ${comment.status === "resolved" ? "border-line bg-paper/60" : "border-teal/20 bg-teal-soft/40"}`}><div className="flex flex-wrap justify-between gap-2"><p className="text-xs font-medium text-teal">{comment.author_id === currentUserId ? "Você" : comment.author_id === ownerId ? "Autor" : "Orientador"} · {displayDate(comment.created_at)}</p><span className="text-[11px] uppercase tracking-wide text-ink-soft">{comment.status === "resolved" ? "Resolvido" : "Em aberto"}</span></div>{comment.quoted_text && <blockquote className="border-l-2 border-teal pl-3 mt-3 text-sm italic text-ink-soft">“{comment.quoted_text}”</blockquote>}<p className="text-sm mt-3 whitespace-pre-wrap">{comment.body}</p><div className="mt-3 space-y-2">{replies.filter(reply => reply.comment_id === comment.id).map(reply => <div key={reply.id} className="rounded-card bg-white border border-line p-3"><p className="text-[11px] text-ink-soft">{reply.author_id === currentUserId ? "Você" : reply.author_id === ownerId ? "Autor" : "Orientador"} · {displayDate(reply.created_at)}</p><p className="text-sm mt-1 whitespace-pre-wrap">{reply.body}</p></div>)}</div><div className="mt-3 flex flex-col sm:flex-row gap-2"><input value={replyDrafts[comment.id] || ""} onChange={event => setReplyDrafts(current => ({ ...current, [comment.id]: event.target.value }))} placeholder="Responder…" className="flex-1 border border-line rounded-card px-3 py-2 text-sm bg-white" /><button type="button" disabled={reviewBusy === `reply:${comment.id}`} onClick={() => void addReply(comment.id)} className="text-sm border border-line rounded-card px-3 py-2">Responder</button><button type="button" disabled={reviewBusy === `resolve:${comment.id}`} onClick={() => void toggleResolved(comment)} className="text-sm text-teal px-2 py-2">{comment.status === "resolved" ? "Reabrir" : "Resolver"}</button></div></article>)}
              {!sectionComments.length && <p className="text-sm text-ink-soft">Nenhum comentário nesta seção.</p>}
              <div className="rounded-card border border-line p-4"><p className="text-sm font-medium">Novo comentário</p>{quotes[section.section_key] && <div className="mt-3 rounded-card bg-paper p-3"><p className="text-[11px] uppercase tracking-wide text-teal">Trecho selecionado</p><p className="text-sm italic mt-1 line-clamp-4">“{quotes[section.section_key]}”</p><button type="button" onClick={() => setQuotes(current => ({ ...current, [section.section_key]: "" }))} className="text-xs text-ink-soft mt-2">Remover seleção</button></div>}<textarea value={commentDrafts[section.section_key] || ""} onChange={event => setCommentDrafts(current => ({ ...current, [section.section_key]: event.target.value }))} rows={3} placeholder="Registre uma dúvida, sugestão ou decisão de revisão…" className="block w-full border border-line rounded-card p-3 mt-3 bg-paper" /><button type="button" disabled={!reviewAvailable || reviewBusy === `comment:${section.section_key}`} onClick={() => void addComment(section.section_key)} className="bg-teal text-white rounded-card px-4 py-2 mt-3 disabled:opacity-50">Publicar comentário</button></div>
            </div>}
          </div>
        </section>;
      })}
      {comparisonVersions.length === 2 && <section className="bg-white border border-line rounded-2xl p-5 md:p-7"><p className="text-xs uppercase tracking-widest text-teal">Comparação visual</p><h2 className="font-display text-2xl mt-2">O que mudou entre as versões</h2><div className="grid md:grid-cols-2 gap-3 mt-4 text-xs"><p className="rounded-card bg-paper p-3"><strong>Antes:</strong> {comparisonVersions[0].label}</p><p className="rounded-card bg-paper p-3"><strong>Depois:</strong> {comparisonVersions[1].label}</p></div>{comparisonSections.length ? <div className="mt-5 space-y-5">{comparisonSections.map(section => <article key={section.section_key}><h3 className="font-medium">{section.heading}</h3><div className="grid md:grid-cols-2 gap-3 mt-2"><div className="rounded-card border border-line p-4"><p className="text-[11px] uppercase tracking-wide text-ink-soft">Antes · {wordCount(section.before)} palavras</p><p className="text-sm whitespace-pre-wrap mt-2">{section.before || "Seção vazia"}</p></div><div className="rounded-card border border-teal/30 bg-teal-soft/30 p-4"><p className="text-[11px] uppercase tracking-wide text-teal">Depois · {wordCount(section.after)} palavras</p><p className="text-sm whitespace-pre-wrap mt-2">{section.after || "Seção vazia"}</p></div></div></article>)}</div> : <p className="text-sm text-ink-soft mt-5">As seções destas versões são iguais.</p>}</section>}
      {canEdit && <div className="bg-ink text-white rounded-2xl p-5 flex flex-wrap gap-4 justify-between items-center"><div><p className="text-xs uppercase text-teal-soft">Salvamento seguro</p><p className="text-sm text-white/70 mt-2">O autosave preserva o texto; versões registram marcos importantes.</p></div><div className="flex flex-wrap gap-3"><button onClick={() => void createVersion()} disabled={saving} className="border border-white/30 rounded-card px-4 py-3 disabled:opacity-50">Criar versão</button><button onClick={() => void save(true)} disabled={saving} className="bg-white text-ink rounded-card px-4 py-3 font-medium disabled:opacity-50">{saving ? "Salvando…" : "Salvar agora"}</button></div></div>}
    </div>

    <aside className="space-y-5 xl:sticky xl:top-24"><section className="bg-white border border-line rounded-2xl p-5"><p className="text-xs uppercase tracking-widest text-teal">Base do projeto</p><h3 className="font-display text-xl mt-2">Coerência científica</h3><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-ink-soft">Pergunta</dt><dd className="mt-1">{project.research_question || "Ainda não definida"}</dd></div><div><dt className="text-xs text-ink-soft">Objetivo</dt><dd className="mt-1">{project.objective || "Ainda não definido"}</dd></div><div><dt className="text-xs text-ink-soft">Desenho</dt><dd className="mt-1">{project.study_type || "Ainda não definido"}</dd></div></dl><Link href={`/meu-trabalho?id=${project.id}`} className="inline-block text-sm text-teal mt-4">Revisar protocolo →</Link></section>
      <section className="bg-white border border-line rounded-2xl p-5"><div className="flex justify-between gap-3 items-center"><div><p className="text-xs uppercase tracking-widest text-teal">Normalização</p><h3 className="font-display text-xl mt-2">Citações</h3></div><select disabled={!canEdit} value={citationStyle} onChange={event => markMetadata(setCitationStyle, event.target.value)} className="text-xs border border-line rounded-card p-2 bg-paper disabled:opacity-70"><option value="vancouver">Vancouver</option><option value="abnt">ABNT</option></select></div><p className="text-xs text-ink-soft mt-3">{citationIds.length} fontes citadas. Ao mudar o estilo, atualize as referências e revise as marcações já inseridas.</p></section>
      {canEdit && <section className="bg-white border border-line rounded-2xl p-5"><button onClick={() => setShowSources(value => !value)} className="w-full flex justify-between items-center text-left"><span><span className="block text-xs uppercase tracking-widest text-teal">Fontes do projeto</span><span className="block font-display text-xl mt-2">Inserir citação</span></span><span>{showSources ? "−" : "+"}</span></button>{showSources && <div className="mt-4 space-y-3 max-h-[420px] overflow-auto">{articles.length ? articles.map(article => <article key={article.id} className="border-t border-line pt-3"><p className="text-sm line-clamp-3">{article.title}</p><p className="text-xs text-ink-soft mt-1">{firstAuthor(article)} · {article.publication_year || "sem ano"}</p><button onClick={() => cite(article)} className="text-xs text-teal mt-2">{citationIds.includes(article.id) ? "Citar novamente" : "Inserir na seção ativa"} →</button></article>) : <p className="text-sm text-ink-soft">Vincule artigos pela Biblioteca para citá-los durante a escrita.</p>}<Link href={`/biblioteca?projeto=${project.id}`} className="inline-block text-sm text-teal mt-2">Abrir Biblioteca →</Link></div>}</section>}
      <section className="bg-white border border-line rounded-2xl p-5"><p className="text-xs uppercase tracking-widest text-teal">Pendências da revisão</p><h3 className="font-display text-xl mt-2">Comentários abertos</h3>{openComments.length ? <div className="mt-4 space-y-3">{openComments.map(comment => <button key={comment.id} onClick={() => { setActiveReview(comment.section_key); setActiveKey(comment.section_key); document.getElementById(`section-${comment.section_key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="w-full text-left border-t border-line pt-3"><span className="block text-xs text-teal">{sectionTemplates.find(section => section.section_key === comment.section_key)?.heading}</span><span className="block text-sm mt-1 line-clamp-2">{comment.body}</span></button>)}</div> : <p className="text-sm text-ink-soft mt-3">Nenhuma pendência aberta.</p>}</section>
      <section className="bg-teal-soft border border-teal/20 rounded-2xl p-5"><p className="text-xs uppercase tracking-widest text-teal">Checklist editorial</p><h3 className="font-display text-xl mt-2">Antes de exportar</h3><div className="mt-4 space-y-2">{editorialChecks.map(([ok, label]) => <p key={label} className="text-sm"><span className={ok ? "text-teal" : "text-ink-soft"}>{ok ? "✓" : "○"}</span> {label}</p>)}</div><button onClick={exportWord} className="w-full bg-ink text-white rounded-card px-4 py-3 mt-5">Exportar para Word</button><p className="text-[11px] text-ink-soft mt-3">O arquivo é editável. Confira as instruções específicas do periódico antes da submissão.</p></section>
      <section className="bg-white border border-line rounded-2xl p-5"><div className="flex justify-between gap-3 items-center"><div><p className="text-xs uppercase tracking-widest text-teal">Histórico</p><h3 className="font-display text-xl mt-2">Versões</h3></div><select disabled={!canEdit} value={status} onChange={event => markMetadata(setStatus, event.target.value)} className="text-xs border border-line rounded-card p-2 bg-paper disabled:opacity-70"><option value="draft">Rascunho</option><option value="review">Em revisão</option><option value="ready">Pronto</option><option value="submitted">Submetido</option></select></div><p className="text-xs text-ink-soft mt-3">Selecione duas versões para comparar lado a lado.</p><div className="mt-4 space-y-3">{versions.length ? versions.map(version => <div key={version.id} className="border-t border-line pt-3"><label className="flex gap-2 items-start cursor-pointer"><input type="checkbox" checked={compareIds.includes(version.id)} onChange={() => toggleComparison(version.id)} className="mt-0.5" /><span><span className="block text-xs">{version.label}</span><span className="block text-[11px] text-ink-soft mt-1">{displayDate(version.created_at)}</span></span></label>{canEdit && <button onClick={() => restoreVersion(version)} className="text-xs text-teal mt-2 ml-5">Carregar esta versão</button>}</div>) : <p className="text-sm text-ink-soft">Crie uma versão antes de uma revisão importante.</p>}</div></section>
    </aside>
  </div>;
}
