"use client";
import { dialogCopy } from "@/lib/i18n/interface-copy";

import AuthoredText from "@/components/i18n/authored-text";


import { useLanguage } from "@/components/i18n/language-provider";
import InterfaceText from "@/components/i18n/interface-text";


import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import AILoadingDialog from "@/components/ai/loading-dialog";
import Link from "next/link";

import { articleKey } from "@/lib/literature/types";

import { useSearchParams } from "next/navigation";
import { useLibrary } from "@/lib/literature/use-library";
import { EvidenceNote, findDuplicateGroups, LibraryArticle, ReadingStatus, ResearchProject } from "@/lib/literature/library-store";
import { buildBibtex, buildCsv, buildRis, download } from "@/lib/exports/scientific";
import { designLabels, matrixGuidance, resolvedStudyDesign, StudyDesign, studyDesignOptions } from "@/lib/literature/matrix-template";
import { sourceIds } from "@/lib/ai/guide-sources";
import { DuplicateReview } from "@/components/library/duplicate-review";
import { OpenAccessStatus } from "@/components/library/open-access-status";
import AssistantPanel from "@/components/ai/assistant-panel";
import { useOpenAccess } from "@/lib/literature/use-open-access";

type Suggestion = { value: string; source: string; confidence: "alta" | "media" | "baixa" } | null;
type SuggestionSet = {
  objective: Suggestion;
  population: Suggestion;
  method: Suggestion;
  finding: Suggestion;
  limitation: Suggestion;
};
type SuggestionField = keyof SuggestionSet;



export default function BibliotecaPage() {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-sm text-ink-soft" role="status">
          <InterfaceText message="screen.24ee74fad813" />
        </p>
      }
    >
      <BibliotecaContent />
    </Suspense>
  );
}

function BibliotecaContent() {
  const { t: uiText } = useLanguage();
  const library = useLibrary();
  const params = useSearchParams();
  const [projectFilter, setProjectFilter] = useState(params.get("projeto") || "all");
  const [drafts, setDrafts] = useState<Record<string, EvidenceNote>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [folderFilter, setFolderFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [designFilter, setDesignFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const folders = useMemo(() => Array.from(new Set(library.articles.map(article => article.folder).filter(Boolean))).sort(), [library.articles]);
  const tags = useMemo(() => Array.from(new Set(library.articles.flatMap(article => article.tags))).sort(), [library.articles]);
  const years = useMemo(() => Array.from(new Set(library.articles.map(article => article.year).filter((year): year is number => Boolean(year)))).sort((a,b)=>b-a), [library.articles]);
  const articles = library.articles.filter(article =>
    (projectFilter === "all" || (projectFilter === "none" ? !article.projectIds.length : article.projectIds.includes(projectFilter))) &&
    (statusFilter === "all" || article.readingStatus === statusFilter || (statusFilter === "favorite" && article.favorite)) &&
    (folderFilter === "all" || (folderFilter === "none" ? !article.folder : article.folder === folderFilter)) &&
    (tagFilter === "all" || article.tags.includes(tagFilter)) &&
    (designFilter === "all" || resolvedStudyDesign(article) === designFilter) &&
    (yearFilter === "all" || String(article.year || "") === yearFilter) &&
    `${article.title} ${article.authors.join(" ")} ${article.doi || ""} ${article.pmid || ""}`.toLowerCase().includes(query.toLowerCase()));
  const selectedArticle = articles.find(article => article.id === selectedArticleId) || articles[0];
  const notes = { ...library.notes, ...drafts };
  const duplicateGroups = useMemo(() => findDuplicateGroups(library.articles), [library.articles]);
  const [sourceError,setSourceError]=useState("");
  const [comparison, setComparison] = useState<string[]>([]);
  const [view, setView] = useState<"library" | "matrix">("library");
  const [suggestions, setSuggestions] = useState<Record<string, SuggestionSet>>({});
  const analysisLock = useRef(false);
  const [loadingPmid, setLoadingPmid] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const openAccess = useOpenAccess();

  useEffect(() => {
    setSelectedArticleId(null); setComparison([]); setDrafts({}); setDirty({}); setSuggestions({}); setErrors({}); setLoadingPmid(null);
  }, [library.userId]);
  const hasUnsaved = Object.values(dirty).some(Boolean);
  useEffect(() => {
    if (!hasUnsaved) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [hasUnsaved]);
  const withAbstract = useMemo(() => articles.filter(article => article.abstract).length, [articles]);
  async function removeArticle(id: string) {
    if (!window.confirm(dialogCopy("Remover este artigo e suas anotações da sua conta?"))) return;
    if (await library.remove(id)) {
      setDrafts(previous => { const next = { ...previous }; delete next[id]; return next; });
      setDirty(previous => { const next = { ...previous }; delete next[id]; return next; });
    }
  }
  function updateNote(id: string, field: keyof EvidenceNote, value: string) {
    setDrafts(previous => ({ ...previous, [id]: { ...(previous[id] || library.notes[id] || {}), [field]: value } }));
    setDirty(previous => ({ ...previous, [id]: true }));
  }
  async function saveNotes(id: string) {
    if (await library.saveNote(id, notes[id] || {})) {
      setDrafts(previous => { const next = { ...previous }; delete next[id]; return next; });
      setDirty(previous => ({ ...previous, [id]: false }));
    }
  }

  async function analyzeArticle(article: LibraryArticle) {
    if (!article.abstract || analysisLock.current) return;
    analysisLock.current = true;
    setLoadingPmid(article.id);
    setErrors((prev) => ({ ...prev, [article.id]: "" }));
    try {
      const response = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature:"reading", projectId: article.projectId || null, context: { title:article.title, abstract: article.abstract, publicationTypes: article.publicationTypes, doi:article.doi, pmid:article.pmid } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Falha na pré-análise");
      const next:SuggestionSet={objective:null,population:null,method:null,finding:null,limitation:null};
      for(const item of data.output?.recommendations||[]){if(item.targetField in next)next[item.targetField as SuggestionField]={value:item.content,source:item.source,confidence:item.confidence};}
      setSuggestions((prev) => ({ ...prev, [article.id]: next }));
    } catch (error) {
      setErrors((prev) => ({ ...prev, [article.id]: error instanceof Error ? error.message : "Não foi possível analisar o artigo." }));
    } finally {
      analysisLock.current = false;
      setLoadingPmid(null);
    }
  }

  function acceptSuggestion(pmid: string, field: SuggestionField) {
    if (library.working) return;
    const suggestion = suggestions[pmid]?.[field];
    if (!suggestion) return;
    updateNote(pmid, field, suggestion.value);
  }

  function acceptAll(pmid: string) {
    if (library.working) return;
    const set = suggestions[pmid];
    if (!set) return;
    const nextNote = { ...(notes[pmid] || {}) };
    (Object.keys(set) as SuggestionField[]).forEach((field) => {
      if (set[field]) nextNote[field] = set[field]!.value;
    });
    setDrafts(previous => ({ ...previous, [pmid]: nextNote }));
    setDirty(previous => ({ ...previous, [pmid]: true }));
  }

  return (
    <div className="scholar-workspace library-page max-w-6xl mx-auto">
      <AILoadingDialog open={Boolean(loadingPmid)} title={uiText("screen.8244c69d2b60")} description={uiText("screen.c933224a4889")} />
      <header className="library-hero flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-widest text-teal font-semibold"><InterfaceText message="library.kicker" /></p>
          <h1 className="font-display text-4xl md:text-5xl mt-3"><InterfaceText message="library.title" /></h1>
          <p className="text-ink-soft mt-4 leading-relaxed"><InterfaceText message="library.intro" /></p>
        </div>
        <Link href={projectFilter !== "all" && projectFilter !== "none" ? `/descobrir?projeto=${encodeURIComponent(projectFilter)}` : "/descobrir"} className="bg-teal text-white px-5 py-3 rounded-card text-sm font-medium text-center"><InterfaceText message="library.searchMore" /></Link>
      </header>

      <section className="library-controls mt-6 bg-white border border-line rounded-2xl p-5">
        <p role="status" className="text-sm text-ink-soft">{library.loading ? uiText("library.loading") : library.userId ? uiText("library.private") : uiText("library.signin")}</p>
        {!library.loading && !library.userId && <Link href="/login" className="inline-block mt-3 text-teal underline"><InterfaceText message="library.signinAction" /></Link>}
        {library.error && <p role="alert" className="mt-3 text-red-700 text-sm"><AuthoredText text={library.error} /><button disabled={library.working} onClick={() => window.location.reload()} className="ml-3 underline"><InterfaceText message="screen.b9e10688be01" /></button></p>}
        {library.message && <p role="status" className="mt-3 text-teal text-sm"><AuthoredText text={library.message} /></p>}
        {library.userId && library.legacyCount > 0 && <div className="mt-4 bg-amber-soft rounded-card p-4 text-sm">
          <p>Encontramos {library.legacyCount} <InterfaceText message="screen.51280c101b90" /></p>
          <button disabled={library.working || hasUnsaved} onClick={() => library.importLegacy()} className="mt-3 bg-ink text-white px-4 py-2 rounded-card disabled:opacity-50">{library.working ? "Aguarde..." : uiText("screen.d5f84139c034")}</button>
        </div>}
        {library.userId && <div className="library-filter-grid mt-5">
          <label className="library-filter-project text-xs text-ink-soft"><InterfaceText message="library.project" /><select aria-label={uiText("screen.6c64535dc57d")} value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="block border border-line px-3 py-2 rounded-card mt-1"><option value="all"><InterfaceText message="library.all" /></option><option value="none"><InterfaceText message="library.noProject" /></option>{library.projects.map(project => <option key={project.id} value={project.id}>{project.title || project.theme || uiText("screen.53d02a124b87")}</option>)}</select></label>
          <label className="library-filter-search text-xs text-ink-soft"><InterfaceText message="library.search" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={uiText("library.searchPlaceholder")} className="block w-full border border-line px-3 py-2 rounded-card mt-1" /></label>
          <details className="library-extra-filters"><summary className="cursor-pointer text-sm text-teal"><InterfaceText message="library.filters" /></summary><div className="library-extra-filter-grid mt-4"><label className="library-filter-status text-xs text-ink-soft"><InterfaceText message="library.reading" /><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="block border border-line px-3 py-2 rounded-card mt-1"><option value="all"><InterfaceText message="library.allStatus" /></option><option value="unread"><InterfaceText message="library.unread" /></option><option value="reading"><InterfaceText message="library.readingStatus" /></option><option value="reviewed"><InterfaceText message="library.reviewed" /></option><option value="excluded"><InterfaceText message="library.excluded" /></option><option value="favorite"><InterfaceText message="library.favorite" /></option></select></label>
          <label className="text-xs text-ink-soft"><InterfaceText message="library.folder" /><select value={folderFilter} onChange={e=>setFolderFilter(e.target.value)} className="block border border-line px-3 py-2 rounded-card mt-1"><option value="all"><InterfaceText message="library.allFolders" /></option><option value="none"><InterfaceText message="library.noFolder" /></option>{folders.map(folder=><option key={folder} value={folder}>{folder}</option>)}</select></label>
          <label className="text-xs text-ink-soft"><InterfaceText message="library.tag" /><select value={tagFilter} onChange={e=>setTagFilter(e.target.value)} className="block border border-line px-3 py-2 rounded-card mt-1"><option value="all"><InterfaceText message="library.allTags" /></option>{tags.map(tag=><option key={tag} value={tag}>{tag}</option>)}</select></label>
          <label className="text-xs text-ink-soft"><InterfaceText message="library.design" /><select value={designFilter} onChange={e=>setDesignFilter(e.target.value)} className="block border border-line px-3 py-2 rounded-card mt-1"><option value="all"><InterfaceText message="library.allDesigns" /></option>{studyDesignOptions.filter(([value])=>value!=="auto").map(([value,label])=><option key={value} value={value}><AuthoredText text={label} /></option>)}</select></label>
          <label className="text-xs text-ink-soft"><InterfaceText message="library.year" /><select value={yearFilter} onChange={e=>setYearFilter(e.target.value)} className="block border border-line px-3 py-2 rounded-card mt-1"><option value="all"><InterfaceText message="library.allYears" /></option>{years.map(year=><option key={year} value={String(year)}>{year}</option>)}</select></label>
          </div></details>
          <div className="library-filter-links flex flex-wrap gap-4"><Link href={projectFilter !== "all" && projectFilter !== "none" ? `/ideias?projeto=${projectFilter}` : "/ideias"} className="text-sm text-teal"><InterfaceText message="library.ideasLink" /></Link><Link href="/dashboard" className="text-sm text-teal"><InterfaceText message="library.projectsLink" /></Link></div>
        </div>}
        {hasUnsaved && <p role="status" className="mt-4 text-sm text-amber"><InterfaceText message="screen.39cb7194cd8d" /></p>}
      </section>

      {library.userId && <details className="library-source-tools text-sm mt-4" aria-label={uiText("screen.580cfe248b0c")}>
        <summary className="cursor-pointer font-medium text-teal"><InterfaceText message="screen.3d2a087ce3ba" />{comparison.length})</summary>
        <p><InterfaceText message="screen.d56718c3d185" /></p>
        <button type="button" disabled={!comparison.length||comparison.length>3||hasUnsaved||library.loading||library.working} className="bg-teal text-white rounded-card px-3 py-2 disabled:opacity-50" onClick={()=>{try{sourceIds(comparison);setSourceError("");window.dispatchEvent(new CustomEvent("scholar-guide-sources",{detail:library.articles.filter(a=>comparison.includes(a.id)).map(a=>({id:a.id,title:a.title,abstractAvailable:Boolean(a.abstract),notesAvailable:Boolean(library.notes[a.id]&&Object.values(library.notes[a.id]).some(Boolean))}))}));}catch(e){setSourceError(e instanceof Error?e.message:"Confira a seleção.");}}}>Revisar {comparison.length} <InterfaceText message="screen.9e0c8d52b342" /></button>
        {comparison.length>3&&<p><InterfaceText message="screen.e7bd3f8006e4" /></p>}
        {hasUnsaved&&<p><InterfaceText message="screen.42aee6030f73" /></p>}
        {sourceError&&<p role="alert"><AuthoredText text={sourceError} /></p>}
      </details>}
      {library.userId && <DuplicateReview groups={duplicateGroups} notes={library.notes} disabled={library.working || hasUnsaved} onMerge={library.mergeDuplicates} />}

      <section className="library-metrics grid sm:grid-cols-3 gap-3 mt-8">
        <Metric value={String(articles.length)} label={uiText("library.saved")} />
        <Metric value={String(withAbstract)} label={uiText("library.abstractCount")} />
        <Metric value={String(articles.filter((x) => x.doi).length)} label={uiText("library.doiCount")} />
      </section>

      <div className="library-tabs mt-8 flex gap-2 border-b border-line">
        <button onClick={() => setView("library")} className={`px-4 py-3 text-sm font-medium border-b-2 ${view === "library" ? "border-teal text-teal" : "border-transparent text-ink-soft"}`}><InterfaceText message="library.articles" /></button>
        <button onClick={() => setView("matrix")} className={`px-4 py-3 text-sm font-medium border-b-2 ${view === "matrix" ? "border-teal text-teal" : "border-transparent text-ink-soft"}`}><InterfaceText message="library.matrix" /></button>
      </div>
      {library.userId && articles.length>0 && <section className="library-export mt-5 flex flex-wrap items-center gap-2 bg-teal-soft border border-teal/20 rounded-card p-4"><span className="text-sm font-medium mr-2"><InterfaceText message="library.export" /></span><button onClick={()=>download(buildCsv(articles,notes),"text/csv;charset=utf-8","matriz-scholar.csv")} className="border border-teal/30 bg-white px-3 py-2 rounded-card text-xs">Excel / CSV</button><button onClick={()=>download(buildRis(articles),"application/x-research-info-systems;charset=utf-8","referencias-scholar.ris")} className="border border-teal/30 bg-white px-3 py-2 rounded-card text-xs">RIS</button><button onClick={()=>download(buildBibtex(articles),"application/x-bibtex;charset=utf-8","referencias-scholar.bib")} className="border border-teal/30 bg-white px-3 py-2 rounded-card text-xs">BibTeX</button><span className="text-xs text-ink-soft"><InterfaceText message="library.csvHelp" /></span></section>}

      {view === "matrix" && library.userId && !library.loading && <section className="library-compare mt-5 bg-white border border-line rounded-2xl p-5"><h2 className="font-display text-2xl"><InterfaceText message="screen.35ee85ea46d7" /></h2><p className="text-sm text-ink-soft mt-2"><InterfaceText message="screen.81c9b115fa7e" /></p><div className="space-y-2 mt-4">{articles.map(article => <label key={article.id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={comparison.includes(article.id)} disabled={!comparison.includes(article.id) && comparison.length >= 5} onChange={e => setComparison(ids => e.target.checked ? [...ids, article.id] : ids.filter(id => id !== article.id))} className="mt-1" />{article.title}</label>)}</div>
      {articles.filter(article => comparison.includes(article.id)).length >= 2 && <div className="overflow-x-auto mt-5"><table className="w-full text-sm text-left"><caption className="text-left text-xs text-ink-soft mb-3"><InterfaceText message="screen.dbb242947ed8" /></caption><thead><tr><th scope="col" className="p-3">Campo</th>{articles.filter(article => comparison.includes(article.id)).map(article => <th scope="col" key={article.id} className="p-3 min-w-60">{article.title}<span className="block text-xs text-teal mt-1"><AuthoredText text={designLabels[resolvedStudyDesign(article)]} /></span>{dirty[article.id] && <span className="block text-xs text-amber"><InterfaceText message="library.unsaved" /></span>}</th>)}</tr></thead><tbody>{([ ["Objetivo", "objective"], ["População", "population"], ["Método", "method"], ["Tamanho da amostra", "sampleSize"], ["Intervenção / exposição", "intervention"], ["Comparador", "comparator"], ["Desfechos", "outcomes"], ["Achado", "finding"], ["Limitação", "limitation"], ["Nível de evidência", "evidenceLevel"], ["Risco de viés", "riskOfBias"], ["Notas gerais", "generalNotes"] ] as const).map(([label, key]) => <tr key={key} className="border-t border-line"><th scope="row" className="p-3 align-top"><AuthoredText text={label} /></th>{articles.filter(article => comparison.includes(article.id)).map(article => <td key={article.id} className="p-3 align-top text-ink-soft whitespace-pre-wrap">{notes[article.id]?.[key] || uiText("screen.2346695afd53")}</td>)}</tr>)}</tbody></table></div>}</section>}
      {view === "matrix" && comparison.length >= 2 && <AssistantPanel
        feature="matrix"
        title={uiText("screen.808630f5f236")}
        description={uiText("screen.d0692b943f01")}
        projectId={projectFilter !== "all" && projectFilter !== "none" ? projectFilter : null}
        context={articles.filter(article => comparison.includes(article.id)).map(article => ({ id: article.id, title: article.title, doi: article.doi, pmid: article.pmid, abstract: article.abstract, notes: notes[article.id] || {} }))}
      />}

      {library.loading ? <p className="mt-8 text-sm text-ink-soft"><InterfaceText message="library.loadingArticles" /></p> : !library.userId ? null : articles.length === 0 ? (
        <div className="library-empty mt-8 border border-dashed border-line rounded-2xl p-10 text-center bg-white">
          <p className="font-display text-2xl">{library.articles.length ? uiText("library.noMatch") : uiText("library.empty")}</p>
          <p className="text-sm text-ink-soft mt-2"><InterfaceText message="library.emptyHelp" /></p>
          <Link href={projectFilter !== "all" && projectFilter !== "none" ? `/descobrir?projeto=${encodeURIComponent(projectFilter)}` : "/descobrir"} className="inline-block mt-5 text-teal font-medium text-sm"><InterfaceText message="library.radar" /></Link>
        </div>
      ) : view === "library" ? (
        <div className="library-reading-layout mt-6">
          <aside className="library-reading-list" aria-label={uiText("screen.b3a272ef4dce")}>
            <p className="text-sm text-ink-soft mb-3">{articles.length} {articles.length === 1 ? "artigo" : "artigos"} <InterfaceText message="screen.4bcdf1df1301" /></p>
            {articles.map(article => <div key={article.id} className={`library-reading-row ${selectedArticle?.id === article.id ? "is-selected" : ""}`}>
              <input type="checkbox" aria-label={`Comparar ${article.title}`} checked={comparison.includes(article.id)} disabled={!comparison.includes(article.id) && comparison.length >= 5} onChange={e => setComparison(ids => e.target.checked ? [...ids, article.id] : ids.filter(id => id !== article.id))} />
              <button type="button" aria-pressed={selectedArticle?.id === article.id} onClick={() => setSelectedArticleId(article.id)} className="library-reading-choice">
                <span className="font-display library-reading-title">{article.title}</span>
                <span className="text-xs text-ink-soft">{article.authors.slice(0, 1).join("")}{article.authors.length > 1 ? " et al." : ""} · {article.journal || uiText("screen.93b425e2264f")} · {article.year || "Sem ano"}</span>
                <span className="library-reading-status">{{unread:"Não lido",reading:"Em leitura",reviewed:"Avaliado",excluded:"Excluído"}[article.readingStatus]}{dirty[article.id] ? uiText("screen.0273eb740aee") : ""}</span>
              </button>
            </div>)}
          </aside>
          <div className="library-reading-detail" aria-label={uiText("screen.898f58475284")}>
          {articles.map((article) => (
            <article key={article.id} hidden={selectedArticle?.id !== article.id} className="library-article-card bg-white border border-line rounded-2xl p-6">
              <div className="flex flex-col lg:flex-row lg:justify-between gap-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                    {article.year && <span className="bg-teal-soft text-teal px-2 py-1 rounded-full">{article.year}</span>}
                    <span className="bg-paper border border-line px-2 py-1 rounded-full"><AuthoredText text={designLabels[resolvedStudyDesign(article)]} /></span>
                    {article.folder && <span className="bg-paper border border-line px-2 py-1 rounded-full"><InterfaceText message="screen.cc9f3b6a13a0" /> {article.folder}</span>}
                    {article.publicationTypes?.slice(0, 2).map((type) => <span key={type}>{type}</span>)}
                  </div>
                  <h2 className="font-display text-xl md:text-2xl mt-3 leading-snug">{article.title}</h2>
                  <p className="text-sm text-ink-soft mt-2">{article.authors?.slice(0, 6).join(", ")}{article.authors?.length > 6 ? " et al." : ""}</p>
                  <p className="text-xs text-ink-soft/80 mt-1">{article.journal} {article.pmid ? `· PMID ${article.pmid}` : "· Crossref"}{article.doi ? ` · DOI ${article.doi}` : ""}</p>
                  <section className="library-reading-abstract mt-6"><h3 className="font-display text-2xl"><InterfaceText message="library.abstract" /></h3><p className="text-sm text-ink-soft leading-relaxed mt-3 whitespace-pre-wrap">{article.abstract || uiText("library.noAbstract")}</p></section>
                  <div className="flex flex-wrap gap-4 mt-4 text-xs">
                    {article.pubmedUrl && <a href={article.pubmedUrl} target="_blank" rel="noreferrer" className="text-teal hover:underline">PubMed ↗</a>}
                    {article.doiUrl && <a href={article.doiUrl} target="_blank" rel="noreferrer" className="text-teal hover:underline">DOI ↗</a>}
                  </div>
                  <OpenAccessStatus existingUrl={article.fullTextUrl} result={openAccess.results[articleKey(article)]} loading={openAccess.loading.has(articleKey(article))} onCheck={() => openAccess.results[articleKey(article)] ? void openAccess.retry(article) : void openAccess.lookup([article])} onSave={url => void library.setFullTextUrl(article.id, url)} disabled={library.working} />
                </div>
                <div className="flex lg:flex-col gap-2 self-start">
                  <label className="text-xs text-ink-soft"><InterfaceText message="library.primaryProject" /><select aria-label={`Projeto do artigo ${article.title}`} value={article.projectId || ""} disabled={library.working} onChange={e => library.assignProject(article.id, e.target.value || null)} className="block border border-line rounded-card px-2 py-2 mt-1 max-w-56"><option value=""><InterfaceText message="library.noPrimary" /></option>{library.projects.map(project => <option key={project.id} value={project.id}>{project.title || project.theme || uiText("screen.53d02a124b87")}</option>)}</select></label>
                  <button disabled={library.working || !article.abstract || Boolean(loadingPmid)} onClick={() => analyzeArticle(article)} className="text-xs text-white bg-ink px-3 py-2 rounded-card disabled:opacity-40">{loadingPmid === article.id ? uiText("library.analyzing") : uiText("library.analyze")}</button>
                  <button onClick={() => { setView("matrix"); if (!suggestions[article.id] && article.abstract) analyzeArticle(article); }} className="text-xs text-teal border border-teal/30 px-3 py-2 rounded-card"><InterfaceText message="library.toMatrix" /></button>
                  <button disabled={library.working} onClick={() => removeArticle(article.id)} className="text-xs text-red-600 border border-red-200 px-3 py-2 rounded-card hover:bg-red-50"><InterfaceText message="library.remove" /></button>
                </div>
              </div>
              <section className="library-reading-notes mt-6 border-t border-line pt-5">
                <label htmlFor={`reading-notes-${article.id}`} className="font-display text-2xl"><InterfaceText message="library.notes" /></label>
                <p className="text-xs text-ink-soft mt-2"><InterfaceText message="library.notesHelp" /></p>
                <textarea id={`reading-notes-${article.id}`} value={notes[article.id]?.generalNotes || ""} disabled={library.working} maxLength={20000} rows={5} onChange={event => updateNote(article.id, "generalNotes", event.target.value)} className="block w-full border border-line rounded-card p-3 mt-3 text-sm" placeholder={uiText("library.notesPlaceholder")} />
                <div className="flex flex-wrap items-center justify-end gap-3 mt-3"><span role="status" className="text-xs text-ink-soft">{dirty[article.id] ? uiText("library.unsaved") : uiText("library.noChanges")}</span><button disabled={library.working || !dirty[article.id]} onClick={() => saveNotes(article.id)} className="bg-teal text-white px-4 py-2 rounded-card text-sm disabled:opacity-50"><InterfaceText message="library.saveNotes" /></button></div>
              </section>
              <ArticleOrganization article={article} projects={library.projects} disabled={library.working} save={metadata=>library.updateArticle(article.id,metadata)} addProject={projectId=>library.addProjectLink(article.id,projectId)} removeProject={projectId=>library.removeProjectLink(article.id,projectId)}/>
            </article>
          ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="bg-amber-soft border border-amber/20 rounded-card p-4 text-sm text-ink-soft">
            <InterfaceText message="screen.81a58b53b05b" />
          </div>

          {articles.map((article, index) => {
            const set = suggestions[article.id];
            return (
              <section key={article.id} className="library-matrix-card bg-white border border-line rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-line bg-paper flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex gap-4">
                    <span className="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center text-sm shrink-0">{index + 1}</span>
                    <div>
                      <h2 className="font-medium leading-snug">{article.title}</h2>
                      <p className="text-xs text-ink-soft mt-1">{article.year || uiText("screen.0d116becb93b")} · {article.journal || uiText("screen.93b425e2264f")} {article.pmid ? `· PMID ${article.pmid}` : "· Crossref"}</p><p className="text-xs text-teal mt-1">Modelo: <AuthoredText text={designLabels[resolvedStudyDesign(article)]} /></p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button disabled={library.working || !article.abstract || Boolean(loadingPmid)} onClick={() => analyzeArticle(article)} className="text-xs bg-ink text-white px-3 py-2 rounded-card disabled:opacity-40">{loadingPmid === article.id ? uiText("library.analyzing") : set ? uiText("screen.3e0b9bad9adb") : "Sugerir campos"}</button>
                    {set && <button disabled={library.working} onClick={() => acceptAll(article.id)} className="text-xs border border-teal text-teal px-3 py-2 rounded-card"><InterfaceText message="screen.482f112dd391" /></button>}
                  </div>
                </div>

                {errors[article.id] && <div className="mx-5 mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-card p-3"><AuthoredText text={errors[article.id]} /></div>}
                <div className="mx-5 mt-4 text-sm bg-paper border border-line rounded-card p-4"><strong><InterfaceText message="screen.5ec28452fe36" /></strong><span className="text-ink-soft"> {matrixGuidance(resolvedStudyDesign(article))}</span></div>

                {set && (
                  <div className="p-5 border-b border-line bg-teal-soft/50">
                    <p className="text-xs uppercase tracking-widest text-teal font-semibold"><InterfaceText message="screen.60ac36ddbe34" /></p>
                    <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-3 mt-3">
                      <SuggestionCard label="Objetivo" suggestion={set.objective} onAccept={() => acceptSuggestion(article.id, "objective")} />
                      <SuggestionCard label={uiText("screen.135a5854d5bf")} suggestion={set.population} onAccept={() => acceptSuggestion(article.id, "population")} />
                      <SuggestionCard label="Método" suggestion={set.method} onAccept={() => acceptSuggestion(article.id, "method")} />
                      <SuggestionCard label={uiText("screen.3824c028f624")} suggestion={set.finding} onAccept={() => acceptSuggestion(article.id, "finding")} />
                      <SuggestionCard label={uiText("screen.6dc3e34f4ecf")} suggestion={set.limitation} onAccept={() => acceptSuggestion(article.id, "limitation")} />
                    </div>
                  </div>
                )}

                <div className="p-5 border-b border-line flex flex-wrap items-center gap-3">
                  <button disabled={library.working || !dirty[article.id]} onClick={() => saveNotes(article.id)} className="bg-teal text-white px-4 py-2 rounded-card text-sm disabled:opacity-50">{library.working ? "Aguarde..." : uiText("screen.5164b93502be")}</button>
                  <span role="status" className="text-xs text-ink-soft">{dirty[article.id] ? uiText("library.unsaved") : uiText("screen.ee26e4d05962")}</span>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-5">
                  <EvidenceField disabled={library.working} label="Objetivo" value={notes[article.id]?.objective || ""} onChange={(v) => updateNote(article.id, "objective", v)} />
                  <EvidenceField disabled={library.working} label={uiText("screen.09828b0f7eef")} value={notes[article.id]?.population || ""} onChange={(v) => updateNote(article.id, "population", v)} />
                  <EvidenceField disabled={library.working} label="Método" value={notes[article.id]?.method || ""} onChange={(v) => updateNote(article.id, "method", v)} />
                  <EvidenceField disabled={library.working} label={uiText("screen.4d04250d354e")} value={notes[article.id]?.finding || ""} onChange={(v) => updateNote(article.id, "finding", v)} />
                  <EvidenceField disabled={library.working} label={uiText("screen.6dc3e34f4ecf")} value={notes[article.id]?.limitation || ""} onChange={(v) => updateNote(article.id, "limitation", v)} />
                </div>
                <details className="border-t border-line p-5"><summary className="cursor-pointer text-sm font-medium text-teal"><InterfaceText message="screen.3a66477d136e" /></summary><div className="grid md:grid-cols-2 lg:grid-cols-3 mt-4 border border-line rounded-card overflow-hidden"><EvidenceField disabled={library.working} label={uiText("screen.d996a84e2773")} value={notes[article.id]?.sampleSize||""} onChange={v=>updateNote(article.id,"sampleSize",v)}/><EvidenceField disabled={library.working} label={uiText("screen.98d29d7d4048")} value={notes[article.id]?.intervention||""} onChange={v=>updateNote(article.id,"intervention",v)}/><EvidenceField disabled={library.working} label="Comparador" value={notes[article.id]?.comparator||""} onChange={v=>updateNote(article.id,"comparator",v)}/><EvidenceField disabled={library.working} label={uiText("screen.13d1fc4eb5b2")} value={notes[article.id]?.outcomes||""} onChange={v=>updateNote(article.id,"outcomes",v)}/><EvidenceField disabled={library.working} label={uiText("screen.c77c0111841a")} value={notes[article.id]?.evidenceLevel||""} onChange={v=>updateNote(article.id,"evidenceLevel",v)}/><EvidenceField disabled={library.working} label={uiText("screen.69bb5d1f6fe6")} value={notes[article.id]?.riskOfBias||""} onChange={v=>updateNote(article.id,"riskOfBias",v)}/></div><div className="mt-4 border border-line rounded-card"><EvidenceField disabled={library.working} label={uiText("screen.5ac5133cf16f")} value={notes[article.id]?.generalNotes||""} onChange={v=>updateNote(article.id,"generalNotes",v)}/></div></details>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArticleOrganization({article,projects,disabled,save,addProject,removeProject}:{article:LibraryArticle;projects:ResearchProject[];disabled:boolean;save:(metadata:{readingStatus:ReadingStatus;favorite:boolean;tags:string[];folder:string;studyDesign:StudyDesign;exclusionReason:string;fullTextUrl:string})=>Promise<boolean>;addProject:(projectId:string)=>Promise<boolean>;removeProject:(projectId:string)=>Promise<boolean>}){
  const { t: uiText } = useLanguage();
  const [status,setStatus]=useState<ReadingStatus>(article.readingStatus);const [favorite,setFavorite]=useState(article.favorite);const [tags,setTags]=useState(article.tags.join(", "));const [folder,setFolder]=useState(article.folder);const [studyDesign,setStudyDesign]=useState<StudyDesign>(article.studyDesign);const [reason,setReason]=useState(article.exclusionReason);const [url,setUrl]=useState(article.fullTextUrl);
  useEffect(()=>{setStatus(article.readingStatus);setFavorite(article.favorite);setTags(article.tags.join(", "));setFolder(article.folder);setStudyDesign(article.studyDesign);setReason(article.exclusionReason);setUrl(article.fullTextUrl)},[article]);
  return <details className="mt-5 border-t border-line pt-4"><summary className="cursor-pointer text-sm text-teal"><InterfaceText message="library.organize" /></summary><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4"><label className="text-xs"><InterfaceText message="screen.920e413c7d41" /><select value={status} onChange={e=>setStatus(e.target.value as ReadingStatus)} className="block w-full border rounded-card p-2 mt-1"><option value="unread"><InterfaceText message="screen.722cb48a5051" /></option><option value="reading"><InterfaceText message="library.readingStatus" /></option><option value="reviewed"><InterfaceText message="screen.4a9bb051aa6f" /></option><option value="excluded"><InterfaceText message="screen.e660ce34d4df" /></option></select></label><label className="text-xs"><InterfaceText message="library.folder" /><input value={folder} maxLength={120} onChange={e=>setFolder(e.target.value)} className="block w-full border rounded-card p-2 mt-1" placeholder={uiText("screen.798a730ad8d0")}/></label><label className="text-xs"><InterfaceText message="screen.74d60d8d7c06" /><select value={studyDesign} onChange={e=>setStudyDesign(e.target.value as StudyDesign)} className="block w-full border rounded-card p-2 mt-1">{studyDesignOptions.map(([value,label])=><option key={value} value={value}><AuthoredText text={label} /></option>)}</select></label><label className="text-xs"><InterfaceText message="screen.f669e15bf3ec" /><input value={tags} maxLength={1000} onChange={e=>setTags(e.target.value)} className="block w-full border rounded-card p-2 mt-1" placeholder={uiText("screen.c4e05782dbd7")}/></label><label className="text-xs"><InterfaceText message="screen.287f69f3bf51" /><input value={url} maxLength={1000} onChange={e=>setUrl(e.target.value)} className="block w-full border rounded-card p-2 mt-1" placeholder="https://..."/></label><label className="text-xs"><InterfaceText message="screen.b192d05265fe" /><input value={reason} disabled={status!=="excluded"} maxLength={1000} onChange={e=>setReason(e.target.value)} className="block w-full border rounded-card p-2 mt-1 disabled:opacity-50"/></label></div><fieldset className="mt-4 border border-line rounded-card p-3"><legend className="text-xs font-medium px-1"><InterfaceText message="screen.9d4c1c5e14bb" /></legend><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">{projects.map(project=>{const checked=article.projectIds.includes(project.id);const primary=article.projectId===project.id;return <label key={project.id} className="text-xs flex items-start gap-2"><input type="checkbox" checked={checked} disabled={disabled||primary} onChange={e=>{if(e.target.checked) void addProject(project.id);else void removeProject(project.id)}} className="mt-0.5"/><span>{project.title||project.theme||uiText("screen.53d02a124b87")}{primary&&<span className="block text-teal"><InterfaceText message="screen.82524a622933" /></span>}</span></label>})}{!projects.length&&<p className="text-xs text-ink-soft"><InterfaceText message="screen.630ae618b029" /></p>}</div></fieldset><div className="flex gap-3 items-center mt-3"><label className="text-sm"><input type="checkbox" checked={favorite} onChange={e=>setFavorite(e.target.checked)} className="mr-2"/>Favorito</label><button disabled={disabled} onClick={()=>save({readingStatus:status,favorite,tags:[...new Set(tags.split(",").map(x=>x.trim()).filter(Boolean))],folder:folder.trim(),studyDesign,exclusionReason:status==="excluded"?reason:"",fullTextUrl:url.trim()})} className="bg-teal text-white px-3 py-2 rounded-card text-xs disabled:opacity-50"><InterfaceText message="screen.b5a2211367e5" /></button></div></details>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="bg-white border border-line rounded-card p-4"><p className="text-3xl font-semibold">{value}</p><p className="text-xs text-ink-soft mt-1"><AuthoredText text={label} /></p></div>;
}

function SuggestionCard({ label, suggestion, onAccept }: { label: string; suggestion: Suggestion; onAccept: () => void }) {
  if (!suggestion) return <div className="bg-white/70 border border-line rounded-card p-3"><p className="text-[11px] uppercase tracking-wider text-ink-soft"><AuthoredText text={label} /></p><p className="text-xs text-ink-soft/60 mt-2"><InterfaceText message="screen.aa2f36385fbf" /></p></div>;
  return (
    <div className="bg-white border border-line rounded-card p-3">
      <div className="flex items-center justify-between gap-2"><p className="text-[11px] uppercase tracking-wider text-teal font-semibold"><AuthoredText text={label} /></p><span className="text-[10px] text-ink-soft">conf. {suggestion.confidence}</span></div>
      <p className="text-xs text-ink mt-2 leading-relaxed line-clamp-5">{suggestion.value}</p>
      <details className="mt-2"><summary className="text-[11px] text-ink-soft cursor-pointer"><InterfaceText message="screen.0483dd3197a0" /></summary><p className="text-[11px] text-ink-soft mt-2 leading-relaxed">{suggestion.source}</p></details>
      <button onClick={onAccept} className="mt-3 w-full text-xs bg-teal text-white py-2 rounded-card">Confirmar e incorporar</button>
    </div>
  );
}

function EvidenceField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const { t: uiText } = useLanguage();
  return (
    <div className="p-4 border-b md:border-b-0 md:border-r border-line last:border-r-0">
      <label className="text-[11px] uppercase tracking-wider text-teal font-semibold"><AuthoredText text={label} /></label>
      <textarea aria-label={label} disabled={disabled} maxLength={20000} value={value} onChange={(e) => onChange(e.target.value)} rows={7} className="w-full mt-2 text-sm border-0 resize-y outline-none bg-transparent placeholder:text-ink-soft/40" placeholder={uiText("screen.ba9a5c59bffa")} />
    </div>
  );
}
