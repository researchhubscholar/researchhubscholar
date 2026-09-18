"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Article } from "@/lib/literature/types";

import { useSearchParams } from "next/navigation";
import { useLibrary } from "@/lib/literature/use-library";
import { EvidenceNote } from "@/lib/literature/library-store";

type Suggestion = { value: string; source: string; confidence: "alta" | "media" | "baixa" } | null;
type SuggestionSet = {
  objective: Suggestion;
  population: Suggestion;
  method: Suggestion;
  finding: Suggestion;
  limitation: Suggestion;
};



export default function BibliotecaPage() {
  const library = useLibrary();
  const params = useSearchParams();
  const [projectFilter, setProjectFilter] = useState(params.get("projeto") || "all");
  const [drafts, setDrafts] = useState<Record<string, EvidenceNote>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const articles = library.articles.filter(article =>
    (projectFilter === "all" || (projectFilter === "none" ? !article.projectId : article.projectId === projectFilter)) &&
    `${article.title} ${article.authors.join(" ")} ${article.doi || ""} ${article.pmid || ""}`.toLowerCase().includes(query.toLowerCase()));
  const notes = { ...library.notes, ...drafts };
  const [view, setView] = useState<"library" | "matrix">("library");
  const [suggestions, setSuggestions] = useState<Record<string, SuggestionSet>>({});
  const [loadingPmid, setLoadingPmid] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setDrafts({}); setDirty({}); setSuggestions({}); setErrors({}); setLoadingPmid(null);
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
    if (!window.confirm("Remover este artigo e suas anotações da sua conta?")) return;
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

  async function analyzeArticle(article: Article & { id: string }) {
    if (!article.abstract) return;
    setLoadingPmid(article.id);
    setErrors((prev) => ({ ...prev, [article.id]: "" }));
    try {
      const response = await fetch("/api/literature/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abstract: article.abstract, publicationTypes: article.publicationTypes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Falha na pré-análise");
      setSuggestions((prev) => ({ ...prev, [article.id]: data.suggestions }));
    } catch (error) {
      setErrors((prev) => ({ ...prev, [article.id]: error instanceof Error ? error.message : "Não foi possível analisar o artigo." }));
    } finally {
      setLoadingPmid(null);
    }
  }

  function acceptSuggestion(pmid: string, field: keyof EvidenceNote) {
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
    (Object.keys(set) as (keyof EvidenceNote)[]).forEach((field) => {
      if (set[field]) nextNote[field] = set[field]!.value;
    });
    setDrafts(previous => ({ ...previous, [pmid]: nextNote }));
    setDirty(previous => ({ ...previous, [pmid]: true }));
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-widest text-teal font-semibold">Biblioteca científica</p>
          <h1 className="font-display text-4xl md:text-5xl mt-3">Da leitura do abstract à matriz de evidências.</h1>
          <p className="text-ink-soft mt-4 leading-relaxed">O Scholar pode pré-analisar o abstract e sugerir objetivo, população, método, principal achado e limitação. Nada entra automaticamente: você confirma cada campo antes de incorporar.</p>
        </div>
        <Link href={projectFilter !== "all" && projectFilter !== "none" ? `/descobrir?projeto=${encodeURIComponent(projectFilter)}` : "/descobrir"} className="bg-teal text-white px-5 py-3 rounded-card text-sm font-medium text-center">+ Buscar artigos</Link>
      </div>

      <section className="mt-6 bg-white border border-line rounded-2xl p-5">
        <p role="status" className="text-sm text-ink-soft">{library.loading ? "Carregando sua biblioteca..." : library.userId ? "Biblioteca privada da sua conta · artigos e anotações salvos na nuvem" : "Entre na sua conta para acessar sua biblioteca."}</p>
        {!library.loading && !library.userId && <Link href="/login" className="inline-block mt-3 text-teal underline">Entrar na minha conta</Link>}
        {library.error && <p role="alert" className="mt-3 text-red-700 text-sm">{library.error}<button disabled={library.working} onClick={() => window.location.reload()} className="ml-3 underline">Tentar novamente</button></p>}
        {library.message && <p role="status" className="mt-3 text-teal text-sm">{library.message}</p>}
        {library.userId && library.legacyCount > 0 && <div className="mt-4 bg-amber-soft rounded-card p-4 text-sm">
          <p>Encontramos {library.legacyCount} artigos da versão anterior neste navegador. Se esse material é seu, importe-o para a conta atual. As anotações já salvas na conta serão preservadas.</p>
          <button disabled={library.working || hasUnsaved} onClick={() => library.importLegacy()} className="mt-3 bg-ink text-white px-4 py-2 rounded-card disabled:opacity-50">{library.working ? "Aguarde..." : "Importar artigos e anotações para minha conta"}</button>
        </div>}
        {library.userId && <div className="mt-5 flex flex-wrap gap-4 items-end">
          <label className="text-xs text-ink-soft">Projeto<select aria-label="Filtrar biblioteca por projeto" value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="block border border-line px-3 py-2 rounded-card mt-1"><option value="all">Todos os artigos</option><option value="none">Sem projeto associado</option>{library.projects.map(project => <option key={project.id} value={project.id}>{project.title || project.theme || "Projeto sem título"}</option>)}</select></label>
          <label className="text-xs text-ink-soft flex-1">Buscar na biblioteca<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Título, autor, DOI ou PMID" className="block w-full border border-line px-3 py-2 rounded-card mt-1" /></label>
          <Link href={projectFilter !== "all" && projectFilter !== "none" ? `/ideias?projeto=${projectFilter}` : "/ideias"} className="text-sm text-teal">Explorar ideias com estas leituras →</Link><Link href="/dashboard" className="text-sm text-teal">Meus projetos →</Link>
        </div>}
        {hasUnsaved && <p role="status" className="mt-4 text-sm text-amber">Você tem anotações não salvas. Use Salvar anotações em cada artigo antes de sair.</p>}
      </section>

      <section className="grid sm:grid-cols-3 gap-3 mt-8">
        <Metric value={String(articles.length)} label="Artigos salvos" />
        <Metric value={String(withAbstract)} label="Com resumo disponível" />
        <Metric value={String(articles.filter((x) => x.doi).length)} label="Com DOI identificado" />
      </section>

      <div className="mt-8 flex gap-2 border-b border-line">
        <button onClick={() => setView("library")} className={`px-4 py-3 text-sm font-medium border-b-2 ${view === "library" ? "border-teal text-teal" : "border-transparent text-ink-soft"}`}>Artigos</button>
        <button onClick={() => setView("matrix")} className={`px-4 py-3 text-sm font-medium border-b-2 ${view === "matrix" ? "border-teal text-teal" : "border-transparent text-ink-soft"}`}>Matriz de evidências</button>
      </div>

      {library.loading ? <p className="mt-8 text-sm text-ink-soft">Carregando artigos...</p> : !library.userId ? null : articles.length === 0 ? (
        <div className="mt-8 border border-dashed border-line rounded-2xl p-10 text-center bg-white">
          <p className="font-display text-2xl">{library.articles.length ? "Nenhum artigo corresponde a este filtro." : "Sua biblioteca ainda está vazia."}</p>
          <p className="text-sm text-ink-soft mt-2">Faça uma busca no Radar e adicione artigos relevantes ao seu projeto.</p>
          <Link href={projectFilter !== "all" && projectFilter !== "none" ? `/descobrir?projeto=${encodeURIComponent(projectFilter)}` : "/descobrir"} className="inline-block mt-5 text-teal font-medium text-sm">Ir para o Radar Científico →</Link>
        </div>
      ) : view === "library" ? (
        <div className="mt-6 space-y-4">
          {articles.map((article) => (
            <article key={article.id} className="bg-white border border-line rounded-2xl p-6">
              <div className="flex flex-col lg:flex-row lg:justify-between gap-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                    {article.year && <span className="bg-teal-soft text-teal px-2 py-1 rounded-full">{article.year}</span>}
                    {article.publicationTypes?.slice(0, 2).map((type) => <span key={type}>{type}</span>)}
                  </div>
                  <h2 className="font-display text-xl md:text-2xl mt-3 leading-snug">{article.title}</h2>
                  <p className="text-sm text-ink-soft mt-2">{article.authors?.slice(0, 6).join(", ")}{article.authors?.length > 6 ? " et al." : ""}</p>
                  <p className="text-xs text-ink-soft/80 mt-1">{article.journal} {article.pmid ? `· PMID ${article.pmid}` : "· Crossref"}{article.doi ? ` · DOI ${article.doi}` : ""}</p>
                  {article.abstract && <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-teal">Ler abstract</summary><p className="text-sm text-ink-soft leading-relaxed mt-3 max-w-4xl">{article.abstract}</p></details>}
                  <div className="flex flex-wrap gap-4 mt-4 text-xs">
                    {article.pubmedUrl && <a href={article.pubmedUrl} target="_blank" rel="noreferrer" className="text-teal hover:underline">PubMed ↗</a>}
                    {article.doiUrl && <a href={article.doiUrl} target="_blank" rel="noreferrer" className="text-teal hover:underline">DOI ↗</a>}
                  </div>
                </div>
                <div className="flex lg:flex-col gap-2 self-start">
                  <label className="text-xs text-ink-soft">Projeto associado<select aria-label={`Projeto do artigo ${article.title}`} value={article.projectId || ""} disabled={library.working} onChange={e => library.assignProject(article.id, e.target.value || null)} className="block border border-line rounded-card px-2 py-2 mt-1 max-w-56"><option value="">Sem projeto</option>{library.projects.map(project => <option key={project.id} value={project.id}>{project.title || project.theme || "Projeto sem título"}</option>)}</select></label>
                  <button disabled={library.working || !article.abstract || loadingPmid === article.id} onClick={() => analyzeArticle(article)} className="text-xs text-white bg-ink px-3 py-2 rounded-card disabled:opacity-40">{loadingPmid === article.id ? "Analisando..." : "Pré-analisar abstract"}</button>
                  <button onClick={() => { setView("matrix"); if (!suggestions[article.id] && article.abstract) analyzeArticle(article); }} className="text-xs text-teal border border-teal/30 px-3 py-2 rounded-card">Ir para matriz</button>
                  <button disabled={library.working} onClick={() => removeArticle(article.id)} className="text-xs text-red-600 border border-red-200 px-3 py-2 rounded-card hover:bg-red-50">Remover</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="bg-amber-soft border border-amber/20 rounded-card p-4 text-sm text-ink-soft">
            A pré-análise usa apenas o abstract e o tipo de publicação. Ela ajuda a organizar a leitura, mas não substitui a leitura crítica do artigo completo. Confirme cada sugestão antes de incorporar.
          </div>

          {articles.map((article, index) => {
            const set = suggestions[article.id];
            return (
              <section key={article.id} className="bg-white border border-line rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-line bg-paper flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex gap-4">
                    <span className="w-8 h-8 rounded-full bg-teal text-white flex items-center justify-center text-sm shrink-0">{index + 1}</span>
                    <div>
                      <h2 className="font-medium leading-snug">{article.title}</h2>
                      <p className="text-xs text-ink-soft mt-1">{article.year || "Ano não informado"} · {article.journal || "Periódico não informado"} {article.pmid ? `· PMID ${article.pmid}` : "· Crossref"}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button disabled={library.working || !article.abstract || loadingPmid === article.id} onClick={() => analyzeArticle(article)} className="text-xs bg-ink text-white px-3 py-2 rounded-card disabled:opacity-40">{loadingPmid === article.id ? "Analisando..." : set ? "Refazer análise" : "Sugerir campos"}</button>
                    {set && <button disabled={library.working} onClick={() => acceptAll(article.id)} className="text-xs border border-teal text-teal px-3 py-2 rounded-card">Confirmar todos</button>}
                  </div>
                </div>

                {errors[article.id] && <div className="mx-5 mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-card p-3">{errors[article.id]}</div>}

                {set && (
                  <div className="p-5 border-b border-line bg-teal-soft/50">
                    <p className="text-xs uppercase tracking-widest text-teal font-semibold">Sugestões do abstract</p>
                    <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-3 mt-3">
                      <SuggestionCard label="Objetivo" suggestion={set.objective} onAccept={() => acceptSuggestion(article.id, "objective")} />
                      <SuggestionCard label="População" suggestion={set.population} onAccept={() => acceptSuggestion(article.id, "population")} />
                      <SuggestionCard label="Método" suggestion={set.method} onAccept={() => acceptSuggestion(article.id, "method")} />
                      <SuggestionCard label="Achado" suggestion={set.finding} onAccept={() => acceptSuggestion(article.id, "finding")} />
                      <SuggestionCard label="Limitação" suggestion={set.limitation} onAccept={() => acceptSuggestion(article.id, "limitation")} />
                    </div>
                  </div>
                )}

                <div className="p-5 border-b border-line flex flex-wrap items-center gap-3">
                  <button disabled={library.working || !dirty[article.id]} onClick={() => saveNotes(article.id)} className="bg-teal text-white px-4 py-2 rounded-card text-sm disabled:opacity-50">{library.working ? "Aguarde..." : "Salvar anotações"}</button>
                  <span role="status" className="text-xs text-ink-soft">{dirty[article.id] ? "Alterações não salvas" : "As anotações salvas reaparecem em qualquer dispositivo."}</span>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-5">
                  <EvidenceField disabled={library.working} label="Objetivo" value={notes[article.id]?.objective || ""} onChange={(v) => updateNote(article.id, "objective", v)} />
                  <EvidenceField disabled={library.working} label="População / amostra" value={notes[article.id]?.population || ""} onChange={(v) => updateNote(article.id, "population", v)} />
                  <EvidenceField disabled={library.working} label="Método" value={notes[article.id]?.method || ""} onChange={(v) => updateNote(article.id, "method", v)} />
                  <EvidenceField disabled={library.working} label="Principal achado" value={notes[article.id]?.finding || ""} onChange={(v) => updateNote(article.id, "finding", v)} />
                  <EvidenceField disabled={library.working} label="Limitação" value={notes[article.id]?.limitation || ""} onChange={(v) => updateNote(article.id, "limitation", v)} />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="bg-white border border-line rounded-card p-4"><p className="text-3xl font-semibold">{value}</p><p className="text-xs text-ink-soft mt-1">{label}</p></div>;
}

function SuggestionCard({ label, suggestion, onAccept }: { label: string; suggestion: Suggestion; onAccept: () => void }) {
  if (!suggestion) return <div className="bg-white/70 border border-line rounded-card p-3"><p className="text-[11px] uppercase tracking-wider text-ink-soft">{label}</p><p className="text-xs text-ink-soft/60 mt-2">Não identificado com segurança no abstract.</p></div>;
  return (
    <div className="bg-white border border-line rounded-card p-3">
      <div className="flex items-center justify-between gap-2"><p className="text-[11px] uppercase tracking-wider text-teal font-semibold">{label}</p><span className="text-[10px] text-ink-soft">conf. {suggestion.confidence}</span></div>
      <p className="text-xs text-ink mt-2 leading-relaxed line-clamp-5">{suggestion.value}</p>
      <details className="mt-2"><summary className="text-[11px] text-ink-soft cursor-pointer">Ver trecho-fonte</summary><p className="text-[11px] text-ink-soft mt-2 leading-relaxed">{suggestion.source}</p></details>
      <button onClick={onAccept} className="mt-3 w-full text-xs bg-teal text-white py-2 rounded-card">Confirmar e incorporar</button>
    </div>
  );
}

function EvidenceField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <div className="p-4 border-b md:border-b-0 md:border-r border-line last:border-r-0">
      <label className="text-[11px] uppercase tracking-wider text-teal font-semibold">{label}</label>
      <textarea aria-label={label} disabled={disabled} maxLength={20000} value={value} onChange={(e) => onChange(e.target.value)} rows={7} className="w-full mt-2 text-sm border-0 resize-y outline-none bg-transparent placeholder:text-ink-soft/40" placeholder="Confirme uma sugestão ou registre após a leitura..." />
    </div>
  );
}
