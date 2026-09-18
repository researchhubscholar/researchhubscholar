"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { SavedIdea, validSavedIdea, historyError } from "@/lib/ideas/history";
export default function IdeaHistory({ ownerId, refresh, restore }: { ownerId: string | null; refresh: number; restore: (row: SavedIdea) => void }) {
  const [rows, setRows] = useState<SavedIdea[]>([]);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(20); const [retry, setRetry] = useState(0);
  const lastOwner = useRef(ownerId);
  useEffect(() => { if (lastOwner.current !== ownerId) { setRows([]); setError(''); setLimit(20); lastOwner.current = ownerId; } }, [ownerId]);
  useEffect(() => {
    let active = true; setRows([]); setError('');
    if (!ownerId) { setLoading(false); return; }
    setLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabaseBrowser().from('idea_versions').select('id,series_id,context,proposal,evidence_signature,reason,created_at').eq('owner_id', ownerId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1);
        if (!active) return;
        if (error) throw error;
        setRows((data || []).filter(validSavedIdea));
      } catch (error) { if (active) setError(historyError(error as { code?: string })); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [ownerId, refresh, limit, retry]);
  return <section className="mt-8 bg-white border border-line rounded-2xl p-5">
    <h2 className="font-display text-2xl">Seu histórico de propostas</h2>
    <p className="text-sm text-ink-soft mt-2">Salve uma versão antes de ajustar a proposta. Cada salvamento preserva o contexto, as referências e o motivo da mudança.</p>
    {!ownerId && <p className="text-sm mt-3">Entre para salvar e recuperar propostas em outros dispositivos.</p>}
    {loading && <p role="status" className="text-sm mt-3">Carregando versões...</p>}
    {error && <p role="alert" className="text-sm mt-3 text-red-700">{error} <button onClick={() => setRetry(value => value + 1)} className="underline">Tentar novamente</button></p>}
    {!loading && !error && ownerId && !rows.length && <p className="text-sm text-ink-soft mt-3">Nenhuma proposta salva ainda.</p>}
    <div className="space-y-3 mt-4">{rows.slice(0, limit).map(row => <details key={row.id} className="border border-line rounded-card p-3"><summary className="cursor-pointer text-sm font-medium">{row.proposal.title} · {new Date(row.created_at).toLocaleString('pt-BR')}</summary><p className="text-sm mt-3">{row.proposal.question}</p><p className="text-xs text-ink-soft mt-2">Motivo: {row.reason || 'Versão inicial'} · {row.proposal.references.length} referências preservadas · Série {row.series_id.slice(0, 8)}</p><button onClick={() => restore(row)} className="mt-3 text-sm text-teal underline">Retomar esta versão</button></details>)}</div>
    {rows.length > limit && <button onClick={() => setLimit(value => value + 20)} className="mt-4 text-sm text-teal underline">Mostrar mais versões</button>}
  </section>;
}
