"use client";
import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { postAI } from "@/lib/ai/client-request";
import type { Article } from "@/lib/literature/types";
import type { AssistantOutput } from "@/lib/ai/assist";
import { extractPdfText, normalizePdfText } from "@/lib/literature/pdf-text";

export function PdfReading({ owner, id, title, projectId, spanish, saveMetadata, existingFields }: { owner: string; id: string; title: string; projectId: string | null; spanish: boolean; existingFields: Record<string, string>; saveMetadata: (fields: Record<string, string>) => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ label: string; content: string; quote: string; page: number }[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [lookup, setLookup] = useState(false);
  const [lookupNotice, setLookupNotice] = useState("");
  const [source, setSource] = useState<{ label: string; url: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coverage, setCoverage] = useState("");
  const t = (pt: string, es: string) => spanish ? es : pt;
  return <details className="mt-3 basis-full rounded-card border border-line p-3 text-sm">
    <summary className="cursor-pointer text-teal">{t("Leitura assistida do PDF", "Lectura asistida del PDF")}</summary>
    <p className="mt-2 text-ink-soft">{t("A IA analisa o texto selecionável e mostra os trechos de apoio. Usa sua franquia de IA. Envie apenas artigos, sem dados de pacientes.", "La IA analiza el texto seleccionable y muestra los fragmentos de respaldo. Usa tu cuota de IA. Envía solo artículos, sin datos de pacientes.")}</p>
    <button type="button" disabled={busy || lookup || saving} className="mt-3 rounded-card bg-teal px-3 py-2 text-white disabled:opacity-50" onClick={async () => {
      if (lock.current) return;
      lock.current = true; setBusy(true); setError(""); setResult([]); setCoverage(""); setFields({}); setSaved(false); setSource(null); setLookupNotice("");
      try {
        const { data: file, error: downloadError } = await supabaseBrowser().storage.from("library-pdfs").download(`${owner}/${id}.pdf`);
        if (downloadError || !file) throw new Error(t("Não foi possível baixar o PDF.", "No se pudo descargar el PDF."));
        const { pages, totalPages, partial } = await extractPdfText(file);
        if (pages.reduce((count, page) => count + page.text.length, 0) < 100) throw new Error(t("O PDF não tem texto selecionável suficiente. Arquivos escaneados ainda não são compatíveis.", "El PDF no tiene suficiente texto seleccionable. Los archivos escaneados aún no son compatibles."));
        setCoverage(`${t("Páginas com texto enviado", "Páginas con texto enviado")}: ${pages.map(page => page.page).join(", ")} / ${totalPages}.${partial ? " " + t("Leitura parcial.", "Lectura parcial.") : ""}`);
        const {data} = await postAI<{ output: AssistantOutput; mode: string }>("/api/ai/assist", { feature: "reading", projectId, context: { title, pdfPages: pages, partial } });
        if (data.mode !== "live") throw new Error(t("A leitura do PDF requer IA ativa.", "La lectura del PDF requiere IA activa."));
        const grounded = data.output.recommendations.flatMap(item => {
          const quote = normalizePdfText(item.source);
          const page = quote.length >= 8 ? pages.find(page => page.text.includes(quote)) : undefined;
          return page ? [{ key: item.targetField, label: item.label, content: item.content, quote, page: page.page }] : [];
        });
        if (!grounded.length) throw new Error(t("Nenhum trecho de apoio pôde ser confirmado no PDF.", "No se pudo confirmar ningún fragmento de respaldo en el PDF."));
        const keys = ["title", "authors", "journal", "year", "doi", "abstract"];
        setFields(Object.fromEntries(grounded.filter(item => keys.includes(item.key)).map(item => [item.key, item.content])));
        const sections = [
          ["objective", t("Objetivo", "Objetivo")], ["method", t("Método e população", "Método y población")],
          ["finding", t("Principais resultados", "Resultados principales")], ["limitation", t("Limitações", "Limitaciones")],
        ];
        setResult(sections.flatMap(([key, label]) => {
          const item = grounded.find(candidate => candidate.key === key);
          return item ? [{...item, label}] : [];
        }));
      } catch (reason) { setError(reason instanceof Error ? reason.message : t("Não foi possível ler o PDF.", "No se pudo leer el PDF.")); }
      finally { lock.current = false; setBusy(false); }
    }}>{busy ? t("Analisando…", "Analizando…") : t("Analisar PDF", "Analizar PDF")}</button>
    {coverage && <p role="status" className="mt-2 text-xs text-ink-soft">{coverage}</p>}
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    <button type="button" disabled={busy || lookup || saving} className="mt-3 ml-3 text-teal underline disabled:opacity-50" onClick={async () => {
      if (lock.current) return;
      const current = Object.fromEntries(Object.entries(existingFields).map(([key, value]) => [key, fields[key]?.trim() || value]));
      if (!current.title || (!current.doi && (!current.authors || !current.journal))) {
        setLookupNotice(t("Analise o PDF ou informe título, autores e periódico na ficha antes de consultar.", "Analiza el PDF o indica título, autores y revista antes de consultar."));
        setFields({...existingFields, ...fields});
        return;
      }
      lock.current = true; setLookup(true); setLookupNotice(""); setSource(null);
      try {
        const response = await fetch("/api/literature/bibliography", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({title:current.title, authors:current.authors, journal:current.journal, year:current.year, doi:current.doi}), signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error();
        const {article} = await response.json() as {article: Article | null};
        if (!article) { setLookupNotice(t("Nenhuma correspondência segura encontrada.", "No se encontró una coincidencia fiable.")); return; }
        const suggestions = {year: String(article.year || ""), doi: article.doi || "", abstract: article.abstract || ""};
        const additions = Object.fromEntries(Object.entries(suggestions).filter(([key, value]) => !current[key]?.trim() && value.trim()));
        setSource({label: article.source || "PubMed", url: article.pubmedUrl || article.doiUrl || ""});
        if (!Object.keys(additions).length) { setLookupNotice(t("O registro encontrado não trouxe dados adicionais.", "El registro encontrado no aportó datos adicionales.")); return; }
        setFields({...current, ...additions}); setSaved(false);
        setLookupNotice(t("Campos vazios preenchidos para revisão. Nada foi salvo.", "Campos vacíos completados para revisión. No se guardó nada."));
      } catch { setLookupNotice(t("Não foi possível consultar as fontes agora.", "No se pudieron consultar las fuentes.")); }
      finally { lock.current = false; setLookup(false); }
    }}>{lookup ? t("Consultando…", "Consultando…") : t("Completar ficha pelo PubMed ou Crossref", "Completar ficha con PubMed o Crossref")}</button>
    {lookupNotice && <p role="status" className="mt-2">{lookupNotice}</p>}
    {source && <p className="mt-2">{t("Fonte:", "Fuente:")} {source.url ? <a className="text-teal underline" href={source.url} target="_blank" rel="noreferrer">{source.label}</a> : source.label}</p>}
    {Object.keys(fields).length > 0 && <section className="mt-4 grid gap-3 rounded-card bg-paper p-3">
      <strong>{t("Revisar ficha do artigo", "Revisar ficha del artículo")}</strong>
      <p className="text-xs text-ink-soft">{t("Confira os dados antes de salvar. Campos em branco mantêm o valor atual.", "Revisa los datos antes de guardar. Los campos vacíos conservan el valor actual.")}</p>
      {([["title", "Título", "Título"], ["authors", "Autores (separados por ;)", "Autores (separados por ;)"], ["journal", "Periódico", "Revista"], ["year", "Ano", "Año"], ["doi", "DOI", "DOI"], ["abstract", "Resumo original", "Resumen original"]] as const).map(([key, pt, es]) => <label key={key} className="grid gap-1">{t(pt, es)}<textarea rows={key === "abstract" ? 6 : 1} className="rounded-card border border-line bg-white p-2" value={fields[key] || ""} disabled={saving || lookup} onChange={event => { setSaved(false); setFields({...fields, [key]: event.target.value}); }} /></label>)}
      <button type="button" disabled={saving || saved || lookup || busy} className="justify-self-start rounded-card bg-teal px-3 py-2 text-white disabled:opacity-50" onClick={async () => {
        setSaving(true);
        try { setSaved(await saveMetadata(fields)); } finally { setSaving(false); }
      }}>{saved ? t("Ficha atualizada", "Ficha actualizada") : t("Salvar ficha do artigo", "Guardar ficha del artículo")}</button>
    </section>}
    {result.length > 0 && <section className="mt-4 rounded-card border border-line bg-paper p-3">
      <h3 className="font-medium">{t("Síntese do trabalho gerada por IA", "Síntesis del trabajo generada por IA")}</h3>
      <p className="mt-1 text-xs text-ink-soft">{t("Baseada nas páginas analisadas. O resumo original da ficha permanece separado.", "Basada en las páginas analizadas. El resumen original de la ficha se mantiene por separado.")}</p>
      <ul className="mt-3 grid gap-3">{result.map(item => <li key={item.label} className="rounded-card bg-white p-3">
        <strong>{item.label}</strong><p className="mt-1">{item.content}</p>
        <details className="mt-2 text-xs text-ink-soft"><summary className="cursor-pointer text-teal">{t("Ver trecho de apoio", "Ver fragmento de respaldo")} · {t("Página", "Página")} {item.page}</summary>
          <blockquote className="mt-2 border-l-2 border-line pl-3">“{item.quote}”</blockquote>
        </details>
      </li>)}</ul>
    </section>}

  </details>;
}
