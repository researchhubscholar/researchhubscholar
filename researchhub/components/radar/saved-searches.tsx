"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export type SearchStrategy = {
  id: string; name: string; query: string; period: string; study_type: string;
  source: string; sort: string; alerts_enabled: boolean;
  last_run_at: string | null; last_result_count: number | null;
};

type SearchAlert = {
  id: string; saved_search_id: string; title: string; journal: string | null;
  published_year: number | null; source: string; article_url: string | null;
  read_at: string | null; created_at: string;
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
  const [alerts, setAlerts] = useState<SearchAlert[]>([]);
  const [alertsReady, setAlertsReady] = useState(true);

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
    const alertResult = await db.from("scholar_search_alerts")
      .select("id,saved_search_id,title,journal,published_year,source,article_url,read_at,created_at")
      .eq("owner_id", id).order("created_at", { ascending: false }).limit(30);
    setAlertsReady(!alertResult.error);
    setAlerts(alertResult.data || []);
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
    if (error) { setMessage(source === "both" ? "Para salvar a busca combinada, execute scholar_radar_upgrade.sql no Supabase." : "Não foi possível salvar. Confira se scholar_productivity.sql foi executado."); return; }
    setName(""); setMessage("Estratégia salva."); void load();
  }

  async function remove(id: string) {
    if (busy || !owner) return;
    setBusy(true);
    const { error } = await supabaseBrowser().from("scholar_saved_searches").delete().eq("id", id).eq("owner_id", owner);
    setBusy(false);
    if (error) setMessage("Não foi possível remover a estratégia."); else void load();
  }

  async function toggleAlert(item: SearchStrategy) {
    if (busy || !owner) return;
    setBusy(true); setMessage("");
    if (item.alerts_enabled) {
      const { error } = await supabaseBrowser().from("scholar_saved_searches").update({ alerts_enabled: false }).eq("id", item.id).eq("owner_id", owner);
      setBusy(false);
      if (error) setMessage("Não foi possível pausar o alerta."); else { setMessage("Alerta pausado. As novidades anteriores continuam disponíveis."); void load(); }
      return;
    }
    try {
      const response = await fetch("/api/literature/alerts/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ savedSearchId: item.id, initialize: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao ativar.");
      setMessage("Alerta ativado. A literatura atual virou a linha de base; daqui em diante somente novidades serão sinalizadas.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível ativar o alerta."); }
    finally { setBusy(false); }
  }

  async function checkNow(item: SearchStrategy) {
    if (busy) return;
    setBusy(true); setMessage("Verificando PubMed e Crossref...");
    try {
      const response = await fetch("/api/literature/alerts/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ savedSearchId: item.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha na verificação.");
      setMessage(data.found ? `${data.found} nova${data.found === 1 ? " publicação encontrada" : "s publicações encontradas"}.` : "Nenhuma publicação nova desde a última verificação.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível verificar novidades."); }
    finally { setBusy(false); }
  }

  async function markRead(id: string) {
    if (!owner) return;
    const readAt = new Date().toISOString();
    const { error } = await supabaseBrowser().from("scholar_search_alerts").update({ read_at: readAt }).eq("id", id).eq("owner_id", owner);
    if (!error) setAlerts(current => current.map(item => item.id === id ? { ...item, read_at: readAt } : item));
  }

  if (!owner && !items.length && !message) return null;
  return <section className="mt-6 bg-white border border-line rounded-2xl p-5">
    <div className="flex flex-wrap justify-between gap-3">
      <div><p className="text-xs uppercase tracking-widest text-teal">Estratégias de busca</p><h2 className="font-display text-2xl mt-2">Salve uma busca reproduzível</h2></div>
      <div className="flex gap-2"><input aria-label="Nome da estratégia" value={name} maxLength={120} onChange={e => setName(e.target.value)} placeholder="Ex.: Busca principal" className="border rounded-card px-3 py-2"/><button type="button" disabled={busy || name.trim().length < 2 || query.trim().length < 3} onClick={save} className="bg-teal text-white px-4 py-2 rounded-card disabled:opacity-40">Salvar busca</button></div>
    </div>
    <p className="text-xs text-ink-soft mt-3">Guarda consulta, período, tipo, fonte e ordenação. Ative o alerta para comparar as próximas verificações com a literatura disponível hoje.</p>
    {message && <p role="status" className="text-sm mt-3 text-ink-soft">{message}</p>}
    <div className="grid md:grid-cols-2 gap-3 mt-4">
      {items.map(item => <article key={item.id} className="border border-line rounded-card p-4"><div className="flex justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{item.name}</h3>{item.alerts_enabled && <span className="text-[10px] uppercase tracking-wide bg-teal-soft text-teal px-2 py-1 rounded-full">Alerta ativo</span>}</div><p className="text-xs text-ink-soft mt-1 line-clamp-2">{item.query}</p><p className="text-[11px] text-ink-soft mt-2">{item.source} · {item.period === "all" ? "todo o período" : `${item.period} anos`} · {item.last_result_count === null ? "ainda não executada" : `${item.last_result_count.toLocaleString("pt-BR")} resultados`}</p></div><button type="button" disabled={busy} onClick={() => remove(item.id)} className="text-xs text-red-600">Remover</button></div><div className="flex flex-wrap gap-3 mt-3"><button type="button" onClick={() => onApply(item)} className="text-sm text-teal underline">Aplicar estratégia</button>{alertsReady && <button type="button" disabled={busy} onClick={() => toggleAlert(item)} className="text-sm text-teal underline disabled:opacity-40">{item.alerts_enabled ? "Pausar alerta" : "Ativar alerta"}</button>}{item.alerts_enabled && alertsReady && <button type="button" disabled={busy} onClick={() => checkNow(item)} className="text-sm text-teal underline disabled:opacity-40">Verificar agora</button>}</div></article>)}
      {!items.length && <p className="text-sm text-ink-soft">Nenhuma estratégia salva.</p>}
    </div>
    {!alertsReady && items.length > 0 && <p className="text-xs text-ink-soft mt-4 border-t border-line pt-4">Para ativar novidades das buscas, execute a nova migração <code>scholar_search_alerts.sql</code>.</p>}
    {alerts.length > 0 && <div className="mt-6 border-t border-line pt-5">
      <div className="flex flex-wrap justify-between gap-2"><div><p className="text-xs uppercase tracking-widest text-teal">Novas publicações</p><h3 className="font-display text-xl mt-1">Atualizações das suas estratégias</h3></div><span className="text-xs text-ink-soft">{alerts.filter(item => !item.read_at).length} não lidas</span></div>
      <div className="space-y-3 mt-4">{alerts.map(alert => <article key={alert.id} className={`rounded-card border p-4 ${alert.read_at ? "border-line bg-paper/40" : "border-teal/30 bg-teal-soft/40"}`}>
        <div className="flex flex-wrap justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-[11px] uppercase tracking-wide text-teal">{alert.source} · {alert.published_year || "ano não informado"}</p><h4 className="font-medium mt-1">{alert.title}</h4><p className="text-xs text-ink-soft mt-1">{alert.journal || "Periódico não informado"}</p></div><div className="flex items-start gap-3">{alert.article_url && <a href={alert.article_url} target="_blank" rel="noreferrer" className="text-sm text-teal underline">Abrir artigo</a>}{!alert.read_at && <button type="button" onClick={() => markRead(alert.id)} className="text-sm text-teal underline">Marcar como lido</button>}</div></div>
      </article>)}</div>
    </div>}
  </section>;
}
