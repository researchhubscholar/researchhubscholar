"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type ProjectOption = { id: string; title: string | null; theme: string | null };
export default function ProjectSwitcher({ ownerId, projectId, title, busy, dirty, onSelect, onSave }: {
  ownerId: string | null; projectId: string | null; title: string; busy: boolean; dirty: boolean;
  onSelect: (id: string | null) => void; onSave: () => void;
}) {
  const [projectList, setProjectList] = useState<{ ownerId: string | null; items: ProjectOption[] }>({ ownerId: null, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setProjectList({ ownerId, items: [] }); setError(""); setLoading(Boolean(ownerId));
    if (!ownerId) return () => { active = false; };
    async function load() {
      try {
        const { data, error } = await supabaseBrowser().from("research_projects").select("id,title,theme").eq("owner_id", ownerId).order("updated_at", { ascending: false });
        if (error) throw error;
        if (active) setProjectList({ ownerId, items: data || [] });
      } catch { if (active) setError("Não foi possível carregar a lista de projetos."); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [ownerId, projectId, retry]);
  if (!ownerId) return null;
  const projects = projectList.ownerId === ownerId ? projectList.items : [];
  const isLoading = loading || projectList.ownerId !== ownerId;
  const current = projects.find(project => project.id === projectId);
  const currentTitle = title.trim() || current?.title || current?.theme || "Projeto sem título";
  return <section aria-label="Escolher projeto de trabalho" className="project-picker-strip mb-6 bg-white border border-line rounded-2xl p-5">
    <p className="text-xs uppercase tracking-widest text-teal">Seus projetos</p>
    <div className="grid md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-end mt-3">
      <label className="block min-w-0 text-sm font-medium">Projeto em edição
        <select value={projectId || ""} disabled={busy || isLoading || Boolean(error)} onChange={event => {
          const id = event.target.value;
          if (!busy && !isLoading && id !== projectId && projects.some(project => project.id === id)) onSelect(id);
        }} className="block mt-2 w-full min-w-0 max-w-full border border-line rounded-card p-3 bg-white text-sm font-normal disabled:opacity-60">
          {!projectId && <option value="">{isLoading ? "Carregando projetos…" : "Rascunho atual · ainda não salvo"}</option>}
          {projectId && !projects.some(project => project.id === projectId) && <option value={projectId}>{currentTitle}</option>}
          {projects.map(project => <option key={project.id} value={project.id}>{project.id === projectId ? currentTitle : project.title || project.theme || "Projeto sem título"}</option>)}
        </select>
      </label>
      <button type="button" disabled={busy || isLoading} onClick={() => { if (!busy && !isLoading) onSelect(null); }} className="border border-teal/30 text-teal rounded-card px-4 py-3 text-sm disabled:opacity-50">+ Novo projeto</button>
    </div>
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error} <button type="button" disabled={busy} onClick={() => setRetry(value => value + 1)} className="underline">Tentar novamente</button></p>
      : !isLoading && <p className="mt-3 text-xs text-ink-soft">{projects.length ? `${projects.length} projeto${projects.length === 1 ? " salvo" : "s salvos"} na sua conta. Selecione o que deseja consultar ou editar.` : "Você ainda não tem projetos salvos. Preencha o rascunho abaixo para começar."}</p>}
    {dirty && <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm"><p className="text-ink-soft">Há alterações não salvas neste projeto.</p><button type="button" disabled={busy} onClick={onSave} className="text-teal underline disabled:opacity-50">Salvar antes de trocar</button></div>}
  </section>;
}
