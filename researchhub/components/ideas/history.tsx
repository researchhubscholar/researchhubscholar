"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { compareSavedIdeas, validSavedIdea, historyError, type SavedIdea } from "@/lib/ideas/history";
export default function IdeaHistory({ ownerId, refresh, restore }: { ownerId: string | null; refresh: number; restore: (row: SavedIdea) => void }) {
  const [rows, setRows] = useState<SavedIdea[]>([]);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(20); const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectionMessage, setSelectionMessage] = useState('');
  const lastOwner = useRef(ownerId);
  useEffect(() => { if (lastOwner.current !== ownerId) { setRows([]); setError(''); setLimit(20); setSelected([]); setSelectionMessage(''); lastOwner.current = ownerId; } }, [ownerId]);
  useEffect(() => {
    let active = true; setRows([]); setError('');
    if (!ownerId) { setLoading(false); return; }
    setLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabaseBrowser().from('idea_versions').select('id,series_id,context,proposal,evidence_signature,reason,created_at').eq('owner_id', ownerId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1);
        if (!active) return;
        if (error) throw error;
        const validRows = (data || []).filter(validSavedIdea);
        setRows(validRows);
        const validIds = new Set(validRows.map(row => row.id));
        setSelected(current => current.filter(id => validIds.has(id)));
      } catch (error) { if (active) setError(historyError(error as { code?: string })); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [ownerId, refresh, limit, retry]);
  function toggle(id: string) {
    if (selected.includes(id)) { setSelected(current => current.filter(value => value !== id)); setSelectionMessage(''); return; }
    if (selected.length >= 3) { setSelectionMessage('Selecione no máximo três versões para comparar.'); return; }
    setSelected(current => [...current, id]); setSelectionMessage('');
  }
  const comparison = rows.filter(row => selected.includes(row.id));
  const comparisonRows = compareSavedIdeas(comparison);
  return <section className="mt-8 bg-white border border-line rounded-2xl p-5">
    <div className="flex flex-wrap justify-between gap-3 items-start"><div><h2 className="font-display text-2xl">Seu histórico de propostas</h2><p className="text-sm text-ink-soft mt-2">Salve uma versão antes de ajustar a proposta. Cada salvamento preserva o contexto, as referências e o motivo da mudança.</p></div>{rows.length > 0 && <span className="text-xs text-teal border border-teal/20 rounded-full px-3 py-1.5">{selected.length}/3 para comparar</span>}</div>
    {!ownerId && <p className="text-sm mt-3">Entre para salvar e recuperar propostas em outros dispositivos.</p>}
    {loading && <p role="status" className="text-sm mt-3">Carregando versões...</p>}
    {error && <p role="alert" className="text-sm mt-3 text-red-700">{error} <button onClick={() => setRetry(value => value + 1)} className="underline">Tentar novamente</button></p>}
    {!loading && !error && ownerId && !rows.length && <p className="text-sm text-ink-soft mt-3">Nenhuma proposta salva ainda.</p>}
    {selectionMessage && <p role="status" className="text-sm mt-3 text-amber-800">{selectionMessage}</p>}
    <div className="space-y-3 mt-4">{rows.slice(0, limit).map(row => <article key={row.id} className={`border rounded-card p-3 ${selected.includes(row.id) ? "border-teal bg-teal-soft/40" : "border-line"}`}><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={selected.includes(row.id)} disabled={!selected.includes(row.id) && selected.length >= 3} onChange={() => toggle(row.id)} className="mt-1 accent-teal"/><span><strong>{row.proposal.title}</strong><span className="block text-xs text-ink-soft mt-1">{new Date(row.created_at).toLocaleString('pt-BR')} · {row.reason || 'Versão inicial'}</span></span></label><details className="mt-3 ml-6"><summary className="cursor-pointer text-sm text-teal">Ver detalhes desta versão</summary><p className="text-sm mt-3">{row.proposal.question}</p><p className="text-xs text-ink-soft mt-2">{row.proposal.studyType} · {row.proposal.references.length} referências preservadas · Série {row.series_id.slice(0, 8)}</p><button type="button" onClick={() => restore(row)} className="mt-3 text-sm text-teal underline">Retomar esta versão</button></details></article>)}</div>
    {rows.length > limit && <button onClick={() => setLimit(value => value + 20)} className="mt-4 text-sm text-teal underline">Mostrar mais versões</button>}
    {comparison.length >= 2 && <section className="mt-7 border-t border-line pt-6" aria-labelledby="saved-ideas-comparison"><div className="flex flex-wrap justify-between gap-3 items-end"><div><p className="text-xs uppercase tracking-widest text-teal">Decisão entre versões</p><h3 id="saved-ideas-comparison" className="font-display text-2xl mt-2">Compare o que mudou antes de escolher</h3></div><button type="button" onClick={() => { setSelected([]); setSelectionMessage(''); }} className="text-sm text-teal underline">Limpar comparação</button></div><p className="text-sm text-ink-soft mt-3">A comparação organiza diferenças registradas pelo usuário; não define automaticamente qual proposta é cientificamente superior.</p><div className="overflow-x-auto mt-5"><table className="w-full text-sm text-left"><caption className="sr-only">Comparação de versões de ideias salvas</caption><thead><tr><th scope="col" className="p-3 min-w-44">Critério</th>{comparison.map(row => <th scope="col" key={row.id} className="p-3 min-w-64 align-top"><span className="block">{row.proposal.title}</span><span className="block text-xs font-normal text-ink-soft mt-1">{new Date(row.created_at).toLocaleString('pt-BR')}</span><button type="button" onClick={() => restore(row)} className="text-xs text-teal underline mt-2 font-normal">Retomar</button></th>)}</tr></thead><tbody>{comparisonRows.map((row, rowIndex) => <tr key={row.key} className={`border-t border-line ${rowIndex === 0 ? "bg-teal-soft/50" : ""}`}><th scope="row" className="p-3 align-top">{row.label}</th>{row.values.map((value, index) => <td key={`${row.key}-${comparison[index].id}`} className={`p-3 align-top ${rowIndex === 0 ? "font-semibold text-teal" : "text-ink-soft"}`}>{value}</td>)}</tr>)}</tbody></table></div></section>}
  </section>;
}
