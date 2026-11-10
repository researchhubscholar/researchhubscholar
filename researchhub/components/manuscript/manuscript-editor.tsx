"use client";
import { studyFormat } from "@/lib/research/study-format";
import { intlLocale } from "@/lib/i18n/format";


import { dialogCopy } from "@/lib/i18n/interface-copy";

import AuthoredText from "@/components/i18n/authored-text";

import { useLanguage } from "@/components/i18n/language-provider";
import { markReviewRead } from "@/lib/access/review-notifications";
import InterfaceText from "@/components/i18n/interface-text";

import { useUnsavedChanges } from "@/components/projects/use-unsaved-changes";
import { saveError } from "@/lib/projects/save-errors";
import ResultsTransferPanel from "./results-transfer";
import { lastResultsStamp, resultsChecklist } from "@/lib/results/transfer";
import { preserveVersion } from "@/lib/projects/preserve-version";

import { projectRadarHref, insertCitationAt } from "@/lib/projects/editor-navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { readManuscriptRecovery, type ManuscriptRecovery } from "@/lib/projects/manuscript-recovery";
import ExcerptHelp from "@/components/ai/excerpt-help";
import SectionAssistant, { type WritingSource } from "./section-assistant";
import { manuscriptPlan, applyManuscriptPlan, type ManuscriptProject } from "@/lib/projects/manuscript-plan";
import { chartData, validWorkspace, type ResultsWorkspace } from "@/lib/results/data";
import { figurePng, figureSvg } from "@/lib/results/figure";
import { downloadBinary } from "@/lib/exports/ooxml";
import { formattedReference, formattedCitedReferences } from "@/lib/projects/references";

type Project = ManuscriptProject & { id: string; title?: string | null; theme?: string | null };
type Manuscript = { revision?: number; id: string; title: string; subtitle: string; authors?: unknown; affiliations?: unknown; keywords?: string[]; article_type: string; target_journal: string; citation_style?: string; citation_ids?: string[]; language: string; status: string } | null;
type Section = { section_key: string; heading: string; content: string; position: number; updated_at?: string };
type Version = { id: string; label: string; snapshot: unknown; created_at: string };
type Article = { id: string; title: string; authors: unknown; journal?: string | null; publication_year: number | null; pmid: string | null; doi: string | null; abstract?: string | null; evidence?: Record<string, unknown> | null };
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

export default function ManuscriptEditor({ currentUserId, ownerId, canEdit, commentTarget, project, initialManuscript, initialSections, initialVersions, initialComments, initialReplies, reviewAvailable, articles }: { currentUserId: string; ownerId: string; canEdit: boolean; commentTarget?: string; project: Project; initialManuscript: Manuscript; initialSections: Section[]; initialVersions: Version[]; initialComments: ManuscriptComment[]; initialReplies: CommentReply[]; reviewAvailable: boolean; articles: Article[] }) {
 const {locale:resultsLocale}=useLanguage();

 const {locale:formatLocale}=useLanguage();

  const { t: uiText, locale } = useLanguage();
  const [includeStudyTable, setIncludeStudyTable] = useState(false);
  const studyType = project.study_type || "";
  const systematicReview = studyFormat(studyType) === "systematic";
  const showStudyTable = canEdit && studyFormat(studyType) === "review";
  const evidenceText = (value: unknown) => typeof value === "string" && value.trim() ? value : "—";
  const studyTable = canEdit && (showStudyTable || systematicReview) ? {
    title: locale === "es" ? "Tabla de estudios" : "Tabela de estudos",
    headers: locale === "es" ? ["Referencia", "Objetivo", "Método", "Hallazgos", "Limitaciones"] : ["Referência", "Objetivo", "Método", "Achados", "Limitações"],
    rows: articles.map(article => [
      [article.title, article.journal, article.publication_year, article.doi && `DOI: ${article.doi}`].filter(Boolean).join(" · "),
      evidenceText(article.evidence?.objective), evidenceText(article.evidence?.method), evidenceText(article.evidence?.main_finding), evidenceText(article.evidence?.limitation),
    ]),
  } : null;
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
  const saveLock = useRef(false);
  const discardedEdits = useRef(false);
  const savedRevision = useRef<number|null>(initialManuscript?.revision ?? null);
  const versionLock = useRef(false);
  const [versionSaving, setVersionSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportLock = useRef(false);
  const editorFields = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const citationPositions = useRef<Record<string, number>>({});
  const [message, setMessage] = useState(initialManuscript ? "Manuscrito carregado." : "Comece a escrever. O primeiro salvamento criará o manuscrito deste projeto.");
  const [showSources, setShowSources] = useState(false);
  const [comments, setComments] = useState<ManuscriptComment[]>(initialComments);
  const [replies, setReplies] = useState<CommentReply[]>(initialReplies);
  const [activeReview, setActiveReview] = useState<string | null>(null);
  const targetComment = initialComments.find(comment => comment.id === commentTarget);
  useEffect(() => {
    if (!canEdit || !targetComment) return;
    setComments(previous => previous.some(comment => comment.id === targetComment.id) ? previous : [...previous, targetComment]);
    setActiveReview(targetComment.section_key);
    setActiveKey(targetComment.section_key);
  }, [canEdit, targetComment]);
  useEffect(() => {
    if (!canEdit || !targetComment || activeReview !== targetComment.section_key) return;
    const element = document.getElementById(`review-comment-${targetComment.id}`);
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "center" });
    markReviewRead(currentUserId, targetComment.id);
  }, [activeReview, canEdit, currentUserId, targetComment, comments.length]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [quotes, setQuotes] = useState<Record<string, string>>({});
  const [reviewBusy, setReviewBusy] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [recovery, setRecovery] = useState<ManuscriptRecovery | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [planSelection, setPlanSelection] = useState<string[]>(["introduction", "methods"]);
  const plan = manuscriptPlan(project);
  const stateRef = useRef({ title, subtitle, authors, affiliations, keywords, articleType, targetJournal, citationStyle, citationIds, status, sections, manuscriptId });
  stateRef.current = { title, subtitle, authors, affiliations, keywords, articleType, targetJournal, citationStyle, citationIds, status, sections, manuscriptId };

  const totalWords = useMemo(() => sections.reduce((sum, section) => sum + wordCount(section.content), 0), [sections]);
  const completed = sections.filter(section => wordCount(section.content) >= (section.section_key === "abstract" ? 80 : 40)).length;
  const progress = Math.round(completed / sections.length * 100);

  useEffect(() => {
    if (!canEdit) return;
    try {
      const backup = readManuscriptRecovery(window.localStorage.getItem(`scholar-manuscript:${ownerId}:${project.id}`), sectionTemplates.map(section => section.section_key));
      if (backup && backup.sections.some(section => section.content !== (initialSections.find(saved => saved.section_key === section.section_key)?.content || ""))) setRecovery(backup);
    } catch { /* Browser backup is optional. */ }
  }, [canEdit, ownerId, project.id, initialSections]);

  async function recoverLocalText() {
    if (!recovery || recovering || saveLock.current || !canEdit) return;
    setRecovering(true);
    try {
      if (!await save(false)) throw new Error("Não foi possível preservar o texto atual na conta.");
      const current = stateRef.current;
      const { data, error } = await supabaseBrowser().from("scholar_manuscript_versions").insert({ manuscript_id: current.manuscriptId, owner_id: ownerId, label: "Antes de recuperar a cópia local", snapshot: { ...current } }).select("id,label,snapshot,created_at").single();
      if (error || !data) throw new Error("Não foi possível registrar a versão anterior. A recuperação não foi aplicada.");
      setVersions(currentVersions => [data, ...currentVersions].slice(0, 12));
      setSections(currentSections => currentSections.map(section => ({ ...section, content: recovery.sections.find(saved => saved.section_key === section.section_key)?.content || "" })));
      if (recovery.title) setTitle(recovery.title);
      setDirty(true); setRecovery(null); setMessage("Texto local recuperado. A versão anterior está no histórico; salvamento automático ativo.");
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Não foi possível recuperar o texto."); }
    finally { setRecovering(false); }
  }

  useEffect(() => {
    if (!dirty || !canEdit) return;
    const backup = window.setTimeout(() => {
      try { if(!discardedEdits.current) window.localStorage.setItem(`scholar-manuscript:${ownerId}:${project.id}`, JSON.stringify(stateRef.current)); } catch { /* Account save remains available. */ }
    }, 300);
    const autosave = window.setTimeout(() => { void save(false); }, 1800);
    return () => { window.clearTimeout(backup); window.clearTimeout(autosave); };
  // save deliberately reads the latest state through stateRef.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, dirty, title, subtitle, authors, affiliations, keywords, articleType, targetJournal, citationStyle, citationIds, status, sections]);

  function markMetadata(setter: (value: string) => void, value: string) { discardedEdits.current=false; setter(value); setDirty(true); setMessage("Alterações ainda não salvas."); }
  function updateSection(key: string, content: string) { discardedEdits.current=false; setSections(current => current.map(section => section.section_key === key ? { ...section, content } : section)); setDirty(true); setMessage("Alterações ainda não salvas."); }

  async function save(showConfirmation = true) {
    if (!canEdit || saveLock.current || discardedEdits.current) return false;
    saveLock.current = true; setSaving(true);
    const current = stateRef.current;
    try {
      const db = supabaseBrowser();
      const metadata = { owner_id: ownerId, project_id: project.id, title: current.title.trim(), subtitle: current.subtitle.trim(), authors: current.authors.split("\n").map(value => value.trim()).filter(Boolean), affiliations: current.affiliations.split("\n").map(value => value.trim()).filter(Boolean), keywords: current.keywords.split(",").map(value => value.trim()).filter(Boolean), article_type: current.articleType, target_journal: current.targetJournal.trim(), citation_style: current.citationStyle, citation_ids: current.citationIds, language: "pt-BR", status: current.status };
      const {data,error}=await db.rpc("scholar_save_manuscript", {p_project:project.id,p_expected:savedRevision.current,p_data:metadata,p_sections:current.sections});
      if(error || !data) throw saveError(error);
      const id=data.id; savedRevision.current=data.revision;
      setManuscriptId(id); stateRef.current.manuscriptId=id;
      const unchanged = current.sections === stateRef.current.sections && ["title", "subtitle", "authors", "affiliations", "keywords", "articleType", "targetJournal", "citationStyle", "status"].every(key => current[key as keyof typeof current] === stateRef.current[key as keyof typeof current]) && current.citationIds === stateRef.current.citationIds;
      if (unchanged) setDirty(false);
      setMessage(!unchanged ? "A versão enviada foi salva. Há alterações mais recentes ainda não salvas nesta página." : showConfirmation ? "Manuscrito salvo na sua conta." : `Salvo automaticamente às ${new Date().toLocaleTimeString(intlLocale(formatLocale), { hour: "2-digit", minute: "2-digit" })}.`);
      try { if (unchanged) window.localStorage.removeItem(`scholar-manuscript:${ownerId}:${project.id}`); } catch { /* Database copy is confirmed. */ }
      return unchanged;
    } catch(error) { setMessage(error instanceof Error ? error.message : "Não foi possível sincronizar agora. Seu rascunho continua aqui."); return false; }
    finally { saveLock.current = false; setSaving(false); }
  }

  useUnsavedChanges({label:"Manuscrito",dirty:canEdit&&dirty,busy:saving||versionSaving,onSave:()=>save(false),onDiscard:()=>{discardedEdits.current=true;setDirty(false);try{window.localStorage.removeItem(`scholar-manuscript:${ownerId}:${project.id}`);}catch{}}});
  async function createVersion() {
    if (!canEdit || versionLock.current || saveLock.current) return;
    versionLock.current = true; setVersionSaving(true);
    const current = stateRef.current;
    const snapshot = { title: current.title, subtitle: current.subtitle, authors: current.authors, affiliations: current.affiliations, keywords: current.keywords, articleType: current.articleType, targetJournal: current.targetJournal, citationStyle: current.citationStyle, citationIds: current.citationIds, status: current.status, sections: current.sections, resultsSource:lastResultsStamp(versions) };
    try {
      const data = await preserveVersion(snapshot, () => save(false), async captured => {
        const id = stateRef.current.manuscriptId;
        if (!id) throw new Error("Salve o manuscrito antes de criar uma versão.");
        const label = `Versão de ${new Date().toLocaleDateString(intlLocale(formatLocale))} — ${new Date().toLocaleTimeString(intlLocale(formatLocale), { hour: "2-digit", minute: "2-digit" })}`;
        const { data, error } = await supabaseBrowser().from("scholar_manuscript_versions").insert({ manuscript_id: id, owner_id: ownerId, label, snapshot: captured }).select("id,label,snapshot,created_at").single();
        if (error || !data) throw new Error("Não foi possível criar a versão. O texto salvo continua na conta.");
        return data;
      });
      setVersions(current => [data, ...current].slice(0, 12)); setMessage("Versão preservada no histórico.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível criar a versão."); }
    finally { versionLock.current = false; setVersionSaving(false); }
  }

  async function applySectionSuggestion(key: string, original: string, proposed: string, resultsSource?:string) {
    if (!canEdit || saving || stateRef.current.sections.find(section => section.section_key === key)?.content !== original) return false;
    if (!await save(false)) return false;
    const current = stateRef.current;
    if (current.sections.find(section => section.section_key === key)?.content !== original) return false;
    const snapshot = { ...current, resultsSource:resultsSource||lastResultsStamp(versions) };
    const { data, error } = await supabaseBrowser().from("scholar_manuscript_versions").insert({ manuscript_id: current.manuscriptId, owner_id: ownerId, label: resultsSource?"Antes de acrescentar resultados":`Antes da IA — ${sectionTemplates.find(section => section.section_key === key)?.heading || key}`, snapshot }).select("id,label,snapshot,created_at").single();
    if (error || !data || stateRef.current.sections.find(section => section.section_key === key)?.content !== original) return false;
    setVersions(currentVersions => [data, ...currentVersions].slice(0, 12));
    updateSection(key, proposed);
    setMessage("Versão anterior preservada. Sugestão aplicada; salvamento automático ativo.");
    return true;
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
    const inserted = insertCitationAt(current.content, citation, citationPositions.current[activeKey]);
    updateSection(activeKey, inserted.content);
    citationPositions.current[activeKey] = inserted.caret;
    requestAnimationFrame(() => {
      const field = editorFields.current[activeKey];
      field?.focus({ preventScroll: true });
      field?.setSelectionRange(inserted.caret, inserted.caret);
    });
    setMessage(`Citação adicionada em ${current.heading}. Confira o estilo exigido pelo periódico.`);
  }

  function applyAbstractTemplate() {
    const current = sections.find(section => section.section_key === "abstract");
    if (!current || (current.content.trim() && !window.confirm(dialogCopy("Substituir o conteúdo atual do resumo pela estrutura sugerida?")))) return;
    const template = articleType === "case-report" ? "Contexto:\nDescrição do caso:\nDiscussão:\nConclusão:" : articleType === "review" ? "Contexto:\nObjetivo:\nMétodos:\nResultados:\nConclusão:" : "Introdução:\nObjetivo:\nMétodos:\nResultados:\nConclusão:";
    updateSection("abstract", template); setActiveKey("abstract");
  }

  function syncReferences() {
    const cited = citationIds.map(id => articles.find(article => article.id === id)).filter(Boolean) as Article[];
    if (!cited.length) { setMessage("Insira ao menos uma citação antes de gerar as referências."); return; }
    updateSection("references", cited.map((article, index) => formattedReference(article, index, citationStyle)).join("\n\n"));
    setMessage(`${cited.length} referências foram formatadas em ${citationStyle === "vancouver" ? "Vancouver" : "ABNT"}.`);
  }

  async function exportWord() {
    if (exportLock.current) return;
    exportLock.current = true; setExporting(true);
    try {
      const input: import("@/lib/projects/manuscript-export").ManuscriptExport = { title, subtitle, authors, affiliations, keywords, sections, studyTable: includeStudyTable ? studyTable ?? undefined : undefined, references: currentUserId === ownerId ? formattedCitedReferences(citationIds, articles, citationStyle) : [] };
      let results: ResultsWorkspace | null = null;
      // Results remain private to the project owner; sharing a manuscript does not share its dataset.
      if (currentUserId === ownerId) {
        const response = await fetch(`/api/results?project=${encodeURIComponent(project.id)}`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Não foi possível conferir os resultados salvos.");
        if (body.workspace !== null && !validWorkspace(body.workspace)) throw new Error("Confira os resultados salvos antes de exportar.");
        results = body.workspace;
      }
      if (systematicReview && studyTable) {
        const decisions = new Map((results?.reviewScreening ?? []).map(decision => [decision.articleId, decision]));
        const counts = { pending: 0, included: 0, excluded: 0 };
        const exclusions: string[][] = [];
        const includedRows: string[][] = [];
        articles.forEach((article, index) => {
          const decision = decisions.get(article.id);
          const status = decision?.status ?? "pending";
          counts[status]++;
          if (status === "included") includedRows.push(studyTable.rows[index]);
          if (status === "excluded" && decision) exclusions.push([studyTable.rows[index][0], decision.reason]);
        });
        const es = locale === "es";
        input.studyTable = { ...studyTable, title: es ? "Estudios incluidos" : "Estudos incluídos", rows: includedRows };
        input.screening = {
          title: es ? "Resumen de selección de estudios" : "Resumo da triagem de estudos",
          counts: es ? [["Artículos vinculados",articles.length],["Pendientes",counts.pending],["Incluidos",counts.included],["Excluidos",counts.excluded]]
            : [["Artigos vinculados",articles.length],["Pendentes",counts.pending],["Incluídos",counts.included],["Excluídos",counts.excluded]],
          exclusionHeaders: es ? ["Estudio excluido","Motivo de exclusión"] : ["Estudo excluído","Motivo da exclusão"],
          exclusions,
        };
      }
      const checks=resultsChecklist(results,dirty,lastResultsStamp(versions));if(checks.length&&!window.confirm(dialogCopy(`Antes de exportar:\n\n${checks.join("\n")}\n\nDeseja exportar mesmo assim para revisão?`)))return;
      const image = results && chartData(results.dataset, results.figure.column, results.figure.kind, resultsLocale).length ? await figurePng(figureSvg(results, undefined, resultsLocale)) : null;
      const { manuscriptDocument } = await import("@/lib/projects/manuscript-export");
      downloadBinary(manuscriptDocument(input, results, image, locale), `${(input.title || "manuscrito").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      setMessage(results ? "DOCX gerado com o manuscrito, as referências citadas e os resultados salvos do projeto." : "DOCX gerado com o manuscrito e as referências citadas. Não há resultados salvos disponíveis para incluir.");
    } catch (error) { setMessage(`Exportação não concluída: ${error instanceof Error ? error.message : "tente novamente."}`); }
    finally { exportLock.current = false; setExporting(false); }
  }

  async function addComment(sectionKey: string) {
    if (canEdit) return;
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
    if (!comments.some(comment => comment.id === commentId && comment.author_id !== currentUserId)) return;
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
    if (!canEdit) return;
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

  return <div data-advising-view={canEdit ? undefined : "shared"} className="manuscript-workspace grid xl:grid-cols-[220px_minmax(0,1fr)_280px] gap-6 items-start">
    {recovery && canEdit && <section className="xl:col-span-3 border border-amber-200 bg-amber-soft rounded-2xl p-5"><h2 className="font-display text-xl"><InterfaceText message="screen.ebc3e205062e" /></h2><p className="text-sm mt-2"><InterfaceText message="screen.d2620e98f1e2" /></p><details className="mt-3"><summary className="text-sm cursor-pointer text-teal"><InterfaceText message="screen.35174923882c" /></summary>{recovery.sections.filter(section => section.content.trim()).map(section => <div key={section.section_key} className="mt-3"><strong className="text-sm">{sectionTemplates.find(template => template.section_key === section.section_key)?.heading}</strong><p className="text-sm whitespace-pre-wrap max-h-60 overflow-y-auto bg-white p-3 rounded-card mt-2">{section.content}</p></div>)}</details><div className="flex flex-wrap gap-3 mt-4"><button type="button" disabled={recovering || saving} onClick={() => void recoverLocalText()} className="bg-teal text-white rounded-card px-4 py-2 disabled:opacity-50">{recovering ? "Recuperando…" : uiText("screen.dace2a79326f")}</button><button type="button" disabled={recovering} onClick={() => { try { window.localStorage.removeItem(`scholar-manuscript:${ownerId}:${project.id}`); } catch {} setRecovery(null); }} className="text-sm text-teal underline"><InterfaceText message="screen.38fc42de3ca2" /></button></div></section>}

    {canEdit && <section className="xl:col-span-3 bg-white border border-line rounded-2xl p-5"><div className="flex flex-wrap justify-between gap-4 items-center"><div><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.e97e75d4b4f4" /></p><h2 className="font-display text-2xl mt-2"><InterfaceText message="screen.e88db8b5d621" /></h2><p className="text-sm text-ink-soft mt-2"><InterfaceText message="screen.6b37e7a78ed5" /></p></div><button type="button" onClick={() => setShowPlan(value => !value)} className="border border-teal/30 text-teal rounded-card px-4 py-2">{showPlan ? uiText("screen.1a1151248951") : (locale === "es" ? "Preparar la estructura del artículo" : "Preparar estrutura do artigo")}</button></div>{showPlan && <div className="mt-5 space-y-4">{Object.entries(plan).map(([key, content]) => { const occupied = Boolean(sections.find(section => section.section_key === key)?.content.trim()); return <details key={key} className="border border-line rounded-card p-4"><summary className="cursor-pointer flex gap-3 items-center"><input aria-label={`Incluir ${sectionTemplates.find(section => section.section_key === key)?.heading}`} type="checkbox" disabled={occupied} checked={!occupied && planSelection.includes(key)} onClick={event => event.stopPropagation()} onChange={() => setPlanSelection(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])}/><span>{sectionTemplates.find(section => section.section_key === key)?.heading}{occupied ? " · texto existente preservado" : uiText("screen.c5781a1f48c5")}</span></summary><p className="mt-3 whitespace-pre-wrap text-sm text-ink-soft">{content}</p></details>; })}<p className="text-xs text-ink-soft"><InterfaceText message="screen.81070dd9a18c" /></p><button type="button" disabled={saving || !planSelection.some(key => !sections.find(section => section.section_key === key)?.content.trim())} onClick={() => { setSections(current => applyManuscriptPlan(current, plan, planSelection)); setDirty(true); setShowPlan(false); setMessage("Estrutura aplicada às seções vazias. Revise e desenvolva o texto; o salvamento automático está ativo."); }} className="bg-teal text-white rounded-card px-4 py-3 disabled:opacity-50"><InterfaceText message="screen.91530fb65b3d" /></button></div>}</section>}
    <section className={`xl:col-span-3 rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3 ${canEdit ? "bg-teal-soft border-teal/20" : "bg-white border-line"}`}><div><p className="text-xs uppercase tracking-widest text-teal">{canEdit ? "Modo autor" : (locale === "es" ? "Modo tutor" : "Modo orientador")}</p><p className="text-sm text-ink-soft mt-1">{canEdit ? uiText("screen.6424012e691b") : uiText("screen.0b9e5ce314ac")}</p></div><p className="text-sm"><strong className="text-ink">{openComments.length}</strong> {openComments.length === 1 ? uiText("screen.308caaa0071a") : uiText("screen.e5176e8da85c")}</p></section>
    <aside className="bg-white border border-line rounded-2xl p-4 xl:sticky xl:top-24"><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.c9bbe9cc2ae9" /></p><div className="mt-4 h-2 bg-line rounded-full overflow-hidden"><div className="h-full bg-teal" style={{ width: `${progress}%` }} /></div><p className="text-xs text-ink-soft mt-2">{completed} de {sections.length} <InterfaceText message="screen.8f3948a298a3" /></p><nav className="mt-4 space-y-1">{sections.map(section => <button key={section.section_key} onClick={() => { setActiveKey(section.section_key); document.getElementById(`section-${section.section_key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className={`w-full text-left rounded-card p-2 text-sm ${activeKey === section.section_key ? "bg-teal-soft text-teal" : "hover:bg-paper"}`}><span className="inline-block w-6 text-xs">{wordCount(section.content) ? "✓" : "○"}</span>{section.heading}</button>)}</nav><div className="border-t border-line mt-4 pt-4 text-xs text-ink-soft"><p>{totalWords.toLocaleString(intlLocale(formatLocale))} <InterfaceText message="screen.f662cb9a3b0a" /></p><p role="status" aria-live="polite" className="mt-1"><AuthoredText text={message} />{message.includes("outra aba") && <a href={`/manuscrito?projeto=${project.id}`} target="_blank" rel="noopener noreferrer" className="block mt-2 text-teal underline"><InterfaceText message="screen.9ba83d0a162f" /></a>}</p></div></aside>

    <div className="min-w-0 space-y-5">{canEdit ? <section className="bg-white border border-line rounded-2xl p-5 md:p-7"><div className="grid md:grid-cols-2 gap-4"><label className="md:col-span-2 text-sm font-medium">Título científico<input disabled={!canEdit} value={title} onChange={event => markMetadata(setTitle, event.target.value)} className="block w-full mt-2 border border-line rounded-card p-3 bg-paper text-lg disabled:opacity-70" /></label><label className="md:col-span-2 text-sm font-medium">Subtítulo — opcional<input disabled={!canEdit} value={subtitle} onChange={event => markMetadata(setSubtitle, event.target.value)} className="block w-full mt-2 border border-line rounded-card p-3 bg-paper disabled:opacity-70" /></label><label className="text-sm font-medium"><InterfaceText message="screen.f52a850c03ed" /><textarea disabled={!canEdit} rows={3} value={authors} onChange={event => markMetadata(setAuthors, event.target.value)} placeholder={uiText("screen.ee1a720dc6d2")} className="block w-full mt-2 border border-line rounded-card p-3 bg-paper disabled:opacity-70" /></label><label className="text-sm font-medium"><InterfaceText message="screen.46d243b94d8f" /><textarea disabled={!canEdit} rows={3} value={affiliations} onChange={event => markMetadata(setAffiliations, event.target.value)} placeholder={uiText("screen.2d84d8ac6ac8")} className="block w-full mt-2 border border-line rounded-card p-3 bg-paper disabled:opacity-70" /></label><label className="md:col-span-2 text-sm font-medium"><InterfaceText message="screen.8cb5dd5f1884" /><input disabled={!canEdit} value={keywords} onChange={event => markMetadata(setKeywords, event.target.value)} placeholder={uiText("screen.a40639e5b1ef")} className="block w-full mt-2 border border-line rounded-card p-3 bg-paper disabled:opacity-70" /></label><label className="text-sm font-medium">Tipo de manuscrito<select disabled={!canEdit} value={articleType} onChange={event => markMetadata(setArticleType, event.target.value)} className="block w-full mt-2 border border-line rounded-card p-3 bg-paper disabled:opacity-70"><option value="original"><InterfaceText message="screen.404d8200a903" /></option><option value="review"><InterfaceText message="screen.f2e7f5487180" /></option><option value="case-report"><InterfaceText message="screen.60a84ae8356a" /></option><option value="brief-report"><InterfaceText message="screen.4484d881cafb" /></option></select></label><label className="text-sm font-medium"><InterfaceText message="screen.a4d0e398273d" /><input disabled={!canEdit} value={targetJournal} onChange={event => markMetadata(setTargetJournal, event.target.value)} placeholder={uiText("screen.bb2d5272a8e8")} className="block w-full mt-2 border border-line rounded-card p-3 bg-paper disabled:opacity-70" /></label></div></section> : <header className="border-b border-line pb-5"><h2 className="font-display text-2xl">{title}</h2>{subtitle&&<p className="mt-2">{subtitle}</p>}{authors&&<p className="mt-2 text-sm text-ink-soft whitespace-pre-line">{authors}</p>}</header>}
      {sections.map(section => {
        const sectionComments = comments.filter(comment => comment.section_key === section.section_key);
        const sectionOpen = sectionComments.filter(comment => comment.status === "open").length;
        return <section key={section.section_key} id={`section-${section.section_key}`} className="scroll-mt-28 bg-white border border-line rounded-2xl p-5 md:p-7" onFocus={() => setActiveKey(section.section_key)}><div className="flex justify-between gap-4 items-start"><div><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.bd4321ba9322" /></p><h2 className="font-display text-2xl mt-2">{section.heading}</h2></div><div className="text-right"><span className="text-xs text-ink-soft whitespace-nowrap">{wordCount(section.content)} <InterfaceText message="screen.f662cb9a3b0a" /></span>{canEdit && section.section_key === "abstract" && <button onClick={applyAbstractTemplate} className="block text-xs text-teal mt-2"><InterfaceText message="screen.d707d4fe2a7c" /></button>}{canEdit && section.section_key === "references" && <button onClick={syncReferences} className="block text-xs text-teal mt-2"><InterfaceText message="screen.096f4271c0c9" /></button>}</div></div>{canEdit && <p className="text-sm text-ink-soft mt-3 leading-relaxed"><AuthoredText text={guidance[section.section_key]} /></p>}<ExcerptHelp key={`${project.id}:${section.section_key}`} value={section.content} label={section.heading} projectId={project.id} area="manuscrito" disabled={!canEdit||currentUserId!==ownerId} onApply={(original,next)=>applySectionSuggestion(section.section_key,original,next)}><textarea ref={field => { editorFields.current[section.section_key] = field; }} onFocus={() => setActiveKey(section.section_key)} onBlur={event => { citationPositions.current[section.section_key] = event.currentTarget.selectionEnd; }} readOnly={!canEdit} value={section.content} onChange={event => updateSection(section.section_key, event.target.value)} onSelect={event => { const field = event.currentTarget; citationPositions.current[section.section_key] = field.selectionEnd; const selected = field.value.slice(field.selectionStart, field.selectionEnd).trim().slice(0, 2000); if (selected) setQuotes(current => ({ ...current, [section.section_key]: selected })); }} rows={section.section_key === "references" ? 7 : 12} placeholder={`Escreva ${section.heading.toLowerCase()} aqui…`} className="manuscript-textarea block w-full mt-5 border border-line rounded-card p-4 bg-paper leading-7 outline-none focus:border-teal resize-y read-only:text-ink-soft" /></ExcerptHelp>
          {section.section_key==="results"&&canEdit&&currentUserId===ownerId&&<ResultsTransferPanel projectId={project.id} currentText={sections.find(s=>s.section_key==="results")?.content||""} source={lastResultsStamp(versions)} onAppend={async(original,proposed,stamp)=>{const ok=await applySectionSuggestion("results",original,proposed,stamp);if(ok)setActiveKey("results");return ok;}}/>}
          {section.section_key === "results" && showStudyTable && studyTable && <details className="mt-4 rounded-card border border-line bg-paper/60 p-4">
            <summary className="cursor-pointer font-medium text-teal">{locale === "es" ? "Vista previa de la tabla de estudios" : "Prévia da tabela de estudos"}</summary>
            <p className="mt-3 text-sm text-ink-soft">{locale === "es" ? "Usa la extracción guardada en la Biblioteca. Un guion indica un campo sin completar." : "A tabela usa a extração salva na Biblioteca. Um traço indica um campo não preenchido."}</p>
            {studyTable.rows.length ? <>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead><tr>{studyTable.headers.map(label => <th key={label} scope="col" className="border border-line p-2">{label}</th>)}</tr></thead>
                  <tbody>{studyTable.rows.map((row,index) => <tr key={articles[index].id}>{row.map((cell,col) => <td key={col} className="whitespace-pre-wrap break-words border border-line p-2 align-top">{cell}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={includeStudyTable} onChange={event => setIncludeStudyTable(event.target.checked)} />{locale === "es" ? "Incluir esta tabla al exportar a Word" : "Incluir esta tabela ao exportar para Word"}</label>
            </> : <p className="mt-3 text-sm">{locale === "es" ? "Vincula artículos al proyecto en la Biblioteca para crear la tabla." : "Vincule artigos ao projeto na Biblioteca para montar a tabela."}</p>}
          </details>}
          {canEdit && section.section_key !== "references" && <SectionAssistant sectionKey={section.section_key} heading={section.heading} content={section.content} projectId={project.id} project={project} sources={articles as WritingSource[]} apply={(original, proposed) => applySectionSuggestion(section.section_key, original, proposed)} />}
          <div className="border-t border-line mt-5 pt-4"><button type="button" onClick={() => setActiveReview(current => current === section.section_key ? null : section.section_key)} className="w-full flex items-center justify-between text-left"><span><span className="text-sm font-medium"><InterfaceText message="screen.6280528a838a" /></span><span className="text-xs text-ink-soft ml-2">{sectionComments.length} <InterfaceText message="screen.e66f9a7567ab" /> {sectionOpen} <InterfaceText message="screen.bd0fbdfd15b6" /></span></span><span className="text-teal">{activeReview === section.section_key ? "−" : "+"}</span></button>
            {activeReview === section.section_key && <div className="mt-4 space-y-4">
              {!reviewAvailable && <p className="rounded-card bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900"><InterfaceText message="screen.e3a67d9540e9" /> <strong>scholar_manuscript_review.sql</strong> <InterfaceText message="screen.37339a78f936" /></p>}
              {sectionComments.map(comment => <article key={comment.id} id={`review-comment-${comment.id}`} tabIndex={-1} className={`review-comment-target rounded-card border p-4 ${comment.status === "resolved" ? "border-line bg-paper/60" : "border-teal/20 bg-teal-soft/40"}`}><div className="flex flex-wrap justify-between gap-2"><p className="text-xs font-medium text-teal">{comment.author_id === currentUserId ? uiText("screen.b21e91730d18") : comment.author_id === ownerId ? "Autor" : uiText("screen.b558acf5e5b3")} · {displayDate(comment.created_at)}</p><span className="text-[11px] uppercase tracking-wide text-ink-soft">{comment.status === "resolved" ? uiText("screen.dc4dbb82a797") : (locale === "es" ? "Abierto" : "Em aberto")}</span></div>{comment.quoted_text && <blockquote className="border-l-2 border-teal pl-3 mt-3 text-sm italic text-ink-soft">“{comment.quoted_text}”</blockquote>}<p className="text-sm mt-3 whitespace-pre-wrap">{comment.body}</p><div className="mt-3 space-y-2">{replies.filter(reply => reply.comment_id === comment.id).map(reply => <div key={reply.id} className="rounded-card bg-white border border-line p-3"><p className="text-[11px] text-ink-soft">{reply.author_id === currentUserId ? uiText("screen.b21e91730d18") : reply.author_id === ownerId ? "Autor" : uiText("screen.b558acf5e5b3")} · {displayDate(reply.created_at)}</p><p className="text-sm mt-1 whitespace-pre-wrap">{reply.body}</p></div>)}</div><div className="mt-3 flex flex-col sm:flex-row gap-2">{comment.author_id !== currentUserId && <><input value={replyDrafts[comment.id] || ""} onChange={event => setReplyDrafts(current => ({ ...current, [comment.id]: event.target.value }))} placeholder="Responder…" className="flex-1 border border-line rounded-card px-3 py-2 text-sm bg-white" /><button type="button" disabled={reviewBusy === `reply:${comment.id}`} onClick={() => void addReply(comment.id)} className="text-sm border border-line rounded-card px-3 py-2">Responder</button></>}{canEdit && <button type="button" disabled={reviewBusy === `resolve:${comment.id}`} onClick={() => void toggleResolved(comment)} className="text-sm text-teal px-2 py-2">{comment.status === "resolved" ? "Reabrir" : "Resolver"}</button>}</div></article>)}
              {!sectionComments.length && <p className="text-sm text-ink-soft"><InterfaceText message="screen.801151bfac03" /></p>}
              {!canEdit && <div className="rounded-card border border-line p-4"><p className="text-sm font-medium"><InterfaceText message="screen.d955ffa4a1e8" /></p>{quotes[section.section_key] && <div className="mt-3 rounded-card bg-paper p-3"><p className="text-[11px] uppercase tracking-wide text-teal"><InterfaceText message="screen.293310ddd1ad" /></p><p className="text-sm italic mt-1 line-clamp-4">“{quotes[section.section_key]}”</p><button type="button" onClick={() => setQuotes(current => ({ ...current, [section.section_key]: "" }))} className="text-xs text-ink-soft mt-2"><InterfaceText message="screen.f11c0077aac8" /></button></div>}<textarea value={commentDrafts[section.section_key] || ""} onChange={event => setCommentDrafts(current => ({ ...current, [section.section_key]: event.target.value }))} rows={3} placeholder={uiText("screen.2acbdf8ac06a")} className="block w-full border border-line rounded-card p-3 mt-3 bg-paper" /><button type="button" disabled={!reviewAvailable || reviewBusy === `comment:${section.section_key}`} onClick={() => void addComment(section.section_key)} className="bg-teal text-white rounded-card px-4 py-2 mt-3 disabled:opacity-50"><InterfaceText message="screen.94bd6b37869b" /></button></div>}
            </div>}
          </div>
        </section>;
      })}
      {comparisonVersions.length === 2 && <section className="bg-white border border-line rounded-2xl p-5 md:p-7"><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.2262ae46acc1" /></p><h2 className="font-display text-2xl mt-2"><InterfaceText message="screen.a70e858a4524" /></h2><div className="grid md:grid-cols-2 gap-3 mt-4 text-xs"><p className="rounded-card bg-paper p-3"><strong>Antes:</strong> {comparisonVersions[0].label}</p><p className="rounded-card bg-paper p-3"><strong><InterfaceText message="screen.f38f5ec7064a" /></strong> {comparisonVersions[1].label}</p></div>{comparisonSections.length ? <div className="mt-5 space-y-5">{comparisonSections.map(section => <article key={section.section_key}><h3 className="font-medium">{section.heading}</h3><div className="grid md:grid-cols-2 gap-3 mt-2"><div className="rounded-card border border-line p-4"><p className="text-[11px] uppercase tracking-wide text-ink-soft">Antes · {wordCount(section.before)} <InterfaceText message="screen.f662cb9a3b0a" /></p><p className="text-sm whitespace-pre-wrap mt-2">{section.before || uiText("screen.5843ceefee47")}</p></div><div className="rounded-card border border-teal/30 bg-teal-soft/30 p-4"><p className="text-[11px] uppercase tracking-wide text-teal"><InterfaceText message="screen.fb9168ea3ecc" /> {wordCount(section.after)} <InterfaceText message="screen.f662cb9a3b0a" /></p><p className="text-sm whitespace-pre-wrap mt-2">{section.after || uiText("screen.5843ceefee47")}</p></div></div></article>)}</div> : <p className="text-sm text-ink-soft mt-5"><InterfaceText message="screen.e531c1656390" /></p>}</section>}
      {canEdit && <div className="bg-ink text-white rounded-2xl p-5 flex flex-wrap gap-4 justify-between items-center"><div><p className="text-xs uppercase text-teal-soft"><InterfaceText message="screen.33618ccf0b30" /></p><p className="text-sm text-white/70 mt-2"><InterfaceText message="screen.671765f6b500" /></p></div><div className="flex flex-wrap gap-3"><button onClick={() => void createVersion()} disabled={saving || versionSaving} className="border border-white/30 rounded-card px-4 py-3 disabled:opacity-50">{versionSaving ? uiText("screen.a1a2e8bada0b") : uiText("screen.0f8fc43b90a0")}</button><button onClick={() => void save(true)} disabled={saving} className="bg-white text-ink rounded-card px-4 py-3 font-medium disabled:opacity-50">{saving ? "Salvando…" : uiText("screen.d7e3ed2182c8")}</button></div></div>}
    </div>

    <aside aria-label={uiText("screen.c925892e07ed")} tabIndex={0} className="manuscript-citation-sidebar space-y-5 xl:sticky xl:top-24 xl:max-h-[calc(100dvh-7rem)] xl:overflow-y-auto xl:overscroll-contain xl:pr-2"><section className="bg-white border border-line rounded-2xl p-5"><Link href={projectRadarHref(project.id, title, project.research_question || "")} className="inline-block text-sm text-teal mb-4"><InterfaceText message="screen.ffc77b596142" /></Link><Link href={`/resultados?projeto=${project.id}`} className="block text-sm text-teal mb-4"><InterfaceText message="screen.63fd6ff99695" /></Link><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.aa05aab5354e" /></p><h3 className="font-display text-xl mt-2"><InterfaceText message="screen.710ca8cce2cb" /></h3><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-ink-soft"><InterfaceText message="screen.82e83592a171" /></dt><dd className="mt-1">{project.research_question || uiText("screen.ac9d0b678908")}</dd></div><div><dt className="text-xs text-ink-soft">Objetivo</dt><dd className="mt-1">{project.objective || uiText("screen.18f8064674bb")}</dd></div><div><dt className="text-xs text-ink-soft"><InterfaceText message="screen.244c968a7a0b" /></dt><dd className="mt-1">{project.study_type || uiText("screen.18f8064674bb")}</dd></div></dl><Link href={`/meu-trabalho?id=${project.id}`} className="inline-block text-sm text-teal mt-4">Revisar protocolo →</Link></section>
      {canEdit && <section className="bg-white border border-line rounded-2xl p-5"><div className="grid gap-3"><div><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.82503d4833a0" /></p><h3 className="font-display text-xl mt-2"><InterfaceText message="screen.691efcc32e9b" /></h3></div><select disabled={!canEdit} value={citationStyle} onChange={event => markMetadata(setCitationStyle, event.target.value)} className="w-full min-w-0 text-xs border border-line rounded-card p-2 bg-paper disabled:opacity-70"><option value="vancouver">Vancouver</option><option value="abnt">ABNT</option></select></div><p className="text-xs text-ink-soft mt-3">{citationIds.length} <InterfaceText message="screen.356fa1ef9807" /></p></section>}
      {canEdit && <section className="bg-white border border-line rounded-2xl p-5"><button onClick={() => setShowSources(value => !value)} className="w-full flex justify-between items-center text-left"><span><span className="block text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.c87c4455ffdb" /></span><span className="block font-display text-xl mt-2"><InterfaceText message="screen.c3d8e6283081" /></span></span><span>{showSources ? "−" : "+"}</span></button>{showSources && <div className="mt-4 space-y-3">{articles.length ? articles.map(article => <article key={article.id} className="border-t border-line pt-3"><p className="text-sm line-clamp-3">{article.title}</p><p className="text-xs text-ink-soft mt-1">{firstAuthor(article)} · {article.publication_year || "sem ano"}</p><button onClick={() => cite(article)} className="text-xs text-teal mt-2">{citationIds.includes(article.id) ? (locale === "es" ? "Volver a citar" : "Citar novamente") : uiText("screen.1a2844a5bbc8")} →</button></article>) : <p className="text-sm text-ink-soft"><InterfaceText message="screen.e320cbdce63a" /></p>}<Link href={`/biblioteca?projeto=${project.id}`} className="inline-block text-sm text-teal mt-2">Abrir Biblioteca →</Link></div>}</section>}
      <section className="bg-white border border-line rounded-2xl p-5"><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.4d984c560f93" /></p><h3 className="font-display text-xl mt-2"><InterfaceText message="screen.50530cd08334" /></h3>{openComments.length ? <div className="mt-4 space-y-3">{openComments.map(comment => <button key={comment.id} onClick={() => { setActiveReview(comment.section_key); setActiveKey(comment.section_key); document.getElementById(`section-${comment.section_key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="w-full text-left border-t border-line pt-3"><span className="block text-xs text-teal">{sectionTemplates.find(section => section.section_key === comment.section_key)?.heading}</span><span className="block text-sm mt-1 line-clamp-2">{comment.body}</span></button>)}</div> : <p className="text-sm text-ink-soft mt-3"><InterfaceText message="screen.9fb9c79e632c" /></p>}</section>
      {canEdit && <section className="bg-teal-soft border border-teal/20 rounded-2xl p-5"><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.87139477eaaf" /></p><h3 className="font-display text-xl mt-2">Antes de exportar</h3><div className="mt-4 space-y-2">{editorialChecks.map(([ok, label]) => <p key={label} className="text-sm"><span className={ok ? "text-teal" : "text-ink-soft"}>{ok ? "✓" : "○"}</span> {label}</p>)}</div><button onClick={() => void exportWord()} disabled={exporting} className="w-full bg-ink text-white rounded-card px-4 py-3 mt-5 disabled:opacity-50">{exporting ? "Preparando DOCX…" : (locale === "es" ? "Exportar a Word" : "Exportar para Word")}</button><p className="text-[11px] text-ink-soft mt-3"><InterfaceText message="screen.44c80d2c947a" /></p></section>}
      {canEdit && <section className="bg-white border border-line rounded-2xl p-5"><div className="grid gap-3"><div><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.a80de96d9716" /></p><h3 className="font-display text-xl mt-2"><InterfaceText message="screen.e7e4a84eeafa" /></h3></div><select disabled={!canEdit} value={status} onChange={event => markMetadata(setStatus, event.target.value)} className="w-full min-w-0 text-xs border border-line rounded-card p-2 bg-paper disabled:opacity-70"><option value="draft"><InterfaceText message="screen.d7dbc9c5f24f" /></option><option value="review"><InterfaceText message="screen.5f8054983449" /></option><option value="ready"><InterfaceText message="screen.039eb59231cc" /></option><option value="submitted"><InterfaceText message="screen.ddd42a7d3ec6" /></option></select></div><p className="text-xs text-ink-soft mt-3"><InterfaceText message="screen.553b8691d3f4" /></p><div className="mt-4 space-y-3">{versions.length ? versions.map(version => <div key={version.id} className="border-t border-line pt-3"><label className="flex gap-2 items-start cursor-pointer"><input type="checkbox" checked={compareIds.includes(version.id)} onChange={() => toggleComparison(version.id)} className="mt-0.5" /><span><span className="block text-xs">{version.label}</span><span className="block text-[11px] text-ink-soft mt-1">{displayDate(version.created_at)}</span></span></label>{canEdit && <button onClick={() => restoreVersion(version)} className="text-xs text-teal mt-2 ml-5"><InterfaceText message="screen.af01f0eb81ef" /></button>}</div>) : <p className="text-sm text-ink-soft"><InterfaceText message="screen.63ac8294d01d" /></p>}</div></section>}
    </aside>
  </div>;
}
