"use client";
import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { postAI } from "@/lib/ai/client-request";
import type { AssistantOutput } from "@/lib/ai/assist";
import { extractPdfText, normalizePdfText } from "@/lib/literature/pdf-text";

export function PdfReading({ owner, id, title, projectId, spanish }: { owner: string; id: string; title: string; projectId: string | null; spanish: boolean }) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ label: string; content: string; quote: string; page: number }[]>([]);
  const [coverage, setCoverage] = useState("");
  const t = (pt: string, es: string) => spanish ? es : pt;
  return <details className="mt-3 basis-full rounded-card border border-line p-3 text-sm">
    <summary className="cursor-pointer text-teal">{t("Leitura assistida do PDF", "Lectura asistida del PDF")}</summary>
    <p className="mt-2 text-ink-soft">{t("A IA analisa o texto selecionável e mostra os trechos de apoio. Usa sua franquia de IA. Envie apenas artigos, sem dados de pacientes.", "La IA analiza el texto seleccionable y muestra los fragmentos de respaldo. Usa tu cuota de IA. Envía solo artículos, sin datos de pacientes.")}</p>
    <button type="button" disabled={busy} className="mt-3 rounded-card bg-teal px-3 py-2 text-white disabled:opacity-50" onClick={async () => {
      if (lock.current) return;
      lock.current = true; setBusy(true); setError(""); setResult([]); setCoverage("");
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
          const page = quote.length >= 16 ? pages.find(page => page.text.includes(quote)) : undefined;
          return page ? [{ label: item.label, content: item.content, quote, page: page.page }] : [];
        });
        if (!grounded.length) throw new Error(t("Nenhum trecho de apoio pôde ser confirmado no PDF.", "No se pudo confirmar ningún fragmento de respaldo en el PDF."));
        setResult(grounded);
      } catch (reason) { setError(reason instanceof Error ? reason.message : t("Não foi possível ler o PDF.", "No se pudo leer el PDF.")); }
      finally { lock.current = false; setBusy(false); }
    }}>{busy ? t("Analisando…", "Analizando…") : t("Analisar PDF", "Analizar PDF")}</button>
    {coverage && <p role="status" className="mt-2 text-xs text-ink-soft">{coverage}</p>}
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    {result.length > 0 && <ul className="mt-3 grid gap-3">{result.map((item, i) => <li key={i} className="rounded-card bg-paper p-3"><strong>{item.label}</strong><p>{item.content}</p><blockquote className="mt-2 border-l-2 border-line pl-3 text-xs">{t("Página", "Página")} {item.page}: “{item.quote}”</blockquote></li>)}</ul>}
  </details>;
}
