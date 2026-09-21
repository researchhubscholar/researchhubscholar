"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export type SearchStrategy = {
  id: string; name: string; query: string; period: string; study_type: string;
  source: string; sort: string; alerts_enabled: boolean;
  last_run_at: string | null; last_result_count: number | null;
};

export default function SavedSearches({ query, period, studyType, source, sort, resultCount, onApply }: {
  query: string; period: string; studyType: string; source: string; sort: string;
  resultCount: number | null; onApply: (item: SearchStrategy) => void;
}) {
  const [items, setItems] = useState<SearchStrategy[]>([]);
  const [owner, setOwner] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const db = supabaseBrowser();
    const { data } = await db.auth.getUser();
    const id = data.user?.id || null;
    setOwner(id);
    if (!id) return;
    const result = await db.from("scholar_saved_searches")
      .select("id,name,query,period,study_type,source,sort,alerts_enabled,last_run_at,last_result_count")
      .eq("owner_id", id).order("updated_at", { ascending: false });
    if (result.error) { setMessage("Ative as estratégias salvas com scholar_productivity.sql."); return; }
    setItems(result.data || []);
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    if (busy || !owner || name.trim().length < 2) return;
    setBusy(true); setMessage("");
    const { error } = await supabaseBrowser().from("scholar_saved_searches").upsert({
      owner_id: owner, name: name.trim(), query: query.trim(), period,
      study_type: studyType, source, sort,
      last_run_at: resultCount === null ? null : new Date().toISOString(),
      last_result_count: resultCount,
    }, { onConflict: "owner_id,name" });
    setBusy(false);
    if (error) { setMessage("Não foi possível salvar. Confira se scholar_productivity.sql foi executado."); return; }
    setName(""); setMessage("Estratégia salva."); void load();
  }

  async function remove(id: string) {
    if (busy || !owner) return;
    setBusy(true);
    const { error } = await supabaseBrowser().from("scholar_saved_searches").delete().eq("id", id).eq("owner_id", owner);
    setBusy(false);
    if (error) setMessage("Não foi possível remover a estratégia."); else void load();
  }

  if (!owner && !items.length && !message) return null;
  return <section className="mt-6 bg-white border border-line rounded-2xl p-5">
    <div className="flex flex-wrap justify-between gap-3">
      <div><p className="text-xs uppercase tracking-widest text-teal">Estratégias de busca</p><h2 className="font-display text-2xl mt-2">Salve uma busca reproduzível</h2></div>
      <div className="flex gap-2"><input aria-label="Nome da estratégia" value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder="Ex.: Busca principal" className="border rounded-card px-3 py-2"/><button type="button" disabled={busy || name.trim().length < 2 || query.trim().length < 3} onClick={save} className="bg-teal text-white px-4 py-2 rounded-card disabled:opacity-40">Salvar busca</button></div>
    </div>
    <p className="text-xs text-ink-soft mt-3">Guarda consulta, período, tipo, fonte e ordenação. Alertas estão preparados, mas o envio automático ainda não está ativo.</p>
    {message && <p role="status" className="text-sm mt-3 text-ink-soft">{message}</p>}
    <div className="grid md:grid-cols-2 gap-3 mt-4">
      {items.map(item => <article key={item.id} className="border border-line rounded-card p-4"><div className="flex justify-between gap-3"><div><h3 className="font-medium">{item.name}</h3><p className="text-xs text-ink-soft mt-1 line-clamp-2">{item.query}</p><p className="text-[11px] text-ink-soft mt-2">{item.source} · {item.period === "all" ? "todo o período" : `${item.period} anos`} · {item.last_result_count === null ? "ainda não executada" : `${item.last_result_count.toLocaleString("pt-BR")} resultados`}</p></div><button type="button" disabled={busy} onClick={() => remove(item.id)} className="text-xs text-red-600">Remover</button></div><button type="button" onClick={() => onApply(item)} className="text-sm text-teal mt-3 underline">Aplicar estratégia</button></article>)}
      {!items.length && <p className="text-sm text-ink-soft">Nenhuma estratégia salva.</p>}
    </div>
  </section>;
}
