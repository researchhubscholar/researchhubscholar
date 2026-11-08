"use client";

import { PdfReading } from "./pdf-reading";
import { useEffect, useState } from "react";
import type { Article } from "@/lib/literature/types";
import type { LibraryArticle, ResearchProject } from "@/lib/literature/library-store";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function PdfImport({ articles, projects, busy, attach, spanish }: {
  articles: LibraryArticle[]; projects: ResearchProject[]; busy: boolean; spanish: boolean;
  attach: (file: File, article: Article, project: string | null, existing?: string) => Promise<boolean>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [doi, setDoi] = useState("");
  const [project, setProject] = useState("");
  const [existing, setExisting] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const t = (pt: string, es: string) => spanish ? es : pt;
  return <details className="mt-5 rounded-card border border-line bg-white p-4">
    <summary className="cursor-pointer font-medium text-teal">{t("Adicionar PDF", "Añadir PDF")}</summary>
    <p className="mt-2 text-sm text-ink-soft">{t("PDF de até 10 MB. O arquivo fica privado na sua conta.", "PDF de hasta 10 MB. El archivo es privado en tu cuenta.")}</p>
    <form className="mt-3 grid gap-3" onSubmit={async event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!file || busy) return;
      setError(""); setSaved(false);
      const normalizedDoi = doi.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
      if (!existing && normalizedDoi && !/^10\.\d{4,9}\/\S+$/i.test(normalizedDoi)) {
        setError(t("Confira o DOI antes de salvar.", "Revisa el DOI antes de guardar.")); return;
      }
      if (await attach(file, { title: title.trim(), authors: authors.split(";").map(x => x.trim()).filter(Boolean),
        journal: "", year: year ? Number(year) : null, pubdate: year, doi: normalizedDoi || null, pmid: null,
        abstract: null, publicationTypes: [], doiUrl: normalizedDoi ? `https://doi.org/${normalizedDoi}` : null, pubmedUrl: null,
      }, project || null, existing || undefined)) { form.reset(); setFile(null); setSaved(true); }
    }}>
      <label className="grid gap-1 text-sm">{t("Arquivo PDF", "Archivo PDF")}<input required type="file" accept=".pdf,application/pdf" disabled={busy} onChange={e => {
        const next = e.target.files?.[0] ?? null;
        setFile(next); setSaved(false); setError("");
        setTitle(next?.name.replace(/\.pdf$/i, "").replace(/_/g, " ").slice(0, 500) || "");
      }} /></label>
      {file && <fieldset disabled={busy} className="grid gap-3">
        <label className="grid gap-1 text-sm">{t("Registro na Biblioteca", "Registro en la Biblioteca")}<select className="w-full min-w-0 rounded-card border border-line p-2" value={existing} onChange={e => setExisting(e.target.value)}><option value="">{t("Criar novo registro", "Crear un registro nuevo")}</option>{articles.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
        {!existing && <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">{t("Título", "Título")}<input required maxLength={500} className="rounded-card border border-line p-2" value={title} onChange={e => setTitle(e.target.value)} /></label>
          <label className="grid gap-1 text-sm">{t("Autores (separe por ponto e vírgula)", "Autores (separa con punto y coma)")}<input maxLength={1000} className="rounded-card border border-line p-2" value={authors} onChange={e => setAuthors(e.target.value)} /></label>
          <label className="grid gap-1 text-sm">{t("Ano", "Año")}<input type="number" min="1500" max={new Date().getFullYear() + 1} className="rounded-card border border-line p-2" value={year} onChange={e => setYear(e.target.value)} /></label>
          <label className="grid gap-1 text-sm">DOI<input maxLength={250} className="rounded-card border border-line p-2" value={doi} onChange={e => setDoi(e.target.value)} /></label>
        </div>}
        <label className="grid gap-1 text-sm">{t("Vincular a projeto (opcional)", "Vincular a un proyecto (opcional)")}<select className="w-full min-w-0 rounded-card border border-line p-2" value={project} onChange={e => setProject(e.target.value)}><option value="">{t("Biblioteca geral", "Biblioteca general")}</option>{projects.map(p => <option key={p.id} value={p.id}>{p.title || p.theme}</option>)}</select></label>
        <button className="justify-self-start rounded-card bg-teal px-4 py-2 text-sm text-white" type="submit">{t("Salvar PDF", "Guardar PDF")}</button>
      </fieldset>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {saved && <p role="status" className="text-sm text-teal">{t("PDF salvo na Biblioteca.", "PDF guardado en la Biblioteca.")}</p>}
    </form>
  </details>;
}

export function PdfDownload({ owner, id, spanish, refresh, title, projectId, saveMetadata, existingFields }: { owner: string; id: string; spanish: boolean; refresh: boolean; title: string; projectId: string | null; existingFields: Record<string, string>; saveMetadata: (fields: Record<string, string>) => Promise<boolean> }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    const check = () => void supabaseBrowser().storage.from("library-pdfs").list(owner, { search: `${id}.pdf`, limit: 10 })
      .then(({data}) => { if (active) setAvailable(Boolean(data?.some(item => item.name === `${id}.pdf`))); });
    check();
    return () => { active = false; };
  }, [owner, id, refresh]);
  if (!available) return null;
  return <><span><button type="button" disabled={busy} className="text-teal underline" onClick={async () => {
    setBusy(true); setMessage("");
    try {
      const { data, error } = await supabaseBrowser().storage.from("library-pdfs").download(`${owner}/${id}.pdf`);
      if (error || !data) throw error;
      const url = URL.createObjectURL(data);
      const link = document.createElement("a"); link.href = url; link.download = "artigo.pdf"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setMessage(spanish ? "No hay un PDF disponible para descargar." : "Não há um PDF disponível para baixar."); }
    finally { setBusy(false); }
  }}>{spanish ? "Descargar PDF adjunto" : "Baixar PDF anexado"}</button>{message && <span role="status" className="ml-2">{message}</span>}</span><PdfReading owner={owner} id={id} title={title} projectId={projectId} saveMetadata={saveMetadata} existingFields={existingFields} spanish={spanish} /></>;
}
