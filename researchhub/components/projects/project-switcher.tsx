"use client";
import AuthoredText from "@/components/i18n/authored-text";

import { useLanguage } from "@/components/i18n/language-provider";

import InterfaceText from "@/components/i18n/interface-text";


import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type ProjectOption = { id: string; title: string | null; theme: string | null };
export default function ProjectSwitcher({ ownerId, projectId, title, busy, dirty, onSelect, onSave, emptyLabel }: {
  ownerId: string | null; projectId: string | null; title: string; busy: boolean; dirty: boolean;
  emptyLabel?: string;
  onSelect: (id: string | null) => void; onSave: () => void;
}) {
  const { t: uiText } = useLanguage();
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
  return <section aria-label={uiText("screen.a522f5a6dd79")} className="project-picker-strip mb-6 bg-white border border-line rounded-2xl p-5">
    <p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.cc11df91e214" /></p>
    <div className="grid md:grid-cols-[minmax(0,1fr)_auto] gap-4 items-end mt-3">
      <label className="block min-w-0 text-sm font-medium"><InterfaceText message="screen.8944ff85e734" />
        <select value={projectId || ""} disabled={busy || isLoading || Boolean(error)} onChange={event => {
          const id = event.target.value;
          if (!busy && !isLoading && id !== projectId && projects.some(project => project.id === id)) onSelect(id);
        }} className="block mt-2 w-full min-w-0 max-w-full border border-line rounded-card p-3 bg-white text-sm font-normal disabled:opacity-60">
          {!projectId && <option value="">{isLoading ? uiText("screen.8c92ee30a95e") : emptyLabel || uiText("screen.32786623cd1d")}</option>}
          {projectId && !projects.some(project => project.id === projectId) && <option value={projectId}>{currentTitle}</option>}
          {projects.map(project => <option key={project.id} value={project.id}>{project.id === projectId ? currentTitle : project.title || project.theme || uiText("screen.53d02a124b87")}</option>)}
        </select>
      </label>
      <button type="button" disabled={busy || isLoading} onClick={() => { if (!busy && !isLoading) onSelect(null); }} className="border border-teal/30 text-teal rounded-card px-4 py-3 text-sm disabled:opacity-50"><InterfaceText message="screen.7983bf7895e9" /></button>
    </div>
    {error ? <p role="alert" className="mt-3 text-sm text-red-700"><AuthoredText text={error} /> <button type="button" disabled={busy} onClick={() => setRetry(value => value + 1)} className="underline"><InterfaceText message="screen.b9e10688be01" /></button></p>
      : !isLoading && <p className="mt-3 text-xs text-ink-soft">{projects.length ? `${projects.length} projeto${projects.length === 1 ? " salvo" : "s salvos"} na sua conta. Selecione o que deseja consultar ou editar.` : uiText("screen.2c536f7f9c87")}</p>}
    {dirty && <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm"><p className="text-ink-soft"><InterfaceText message="screen.f1e8688b77de" /></p><button type="button" disabled={busy} onClick={onSave} className="text-teal underline disabled:opacity-50"><InterfaceText message="screen.a16e52b9cc6d" /></button></div>}
  </section>;
}
