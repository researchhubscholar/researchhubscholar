"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Article, articleKey } from "./types";
import { EvidenceNote, LibraryArticle, LibraryStore, mergeImportedNote, ReadingStatus, ResearchProject } from "./library-store";
import type { StudyDesign } from "./matrix-template";

const LEGACY_KEY = "researchhub-scholar-library";
const NOTES_KEY = "researchhub-scholar-evidence-notes";
const IMPORT_OWNER = "researchhub-scholar-library-import-owner";
const IMPORT_COMPLETE = "researchhub-scholar-library-import-complete";
function legacyStamp() {
  const value = `${localStorage.getItem(LEGACY_KEY) || "[]"}|${localStorage.getItem(NOTES_KEY) || "{}"}`;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `${value.length}:${hash >>> 0}`;
}
export function useLibrary() {
  const db = useMemo(() => supabaseBrowser(), []);
  const owner = useRef<string | null>(null);
  const version = useRef(0);
  const busy = useRef(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [articles, setArticles] = useState<LibraryArticle[]>([]);
  const [notes, setNotes] = useState<Record<string, EvidenceNote>>({});
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [legacyCount, setLegacyCount] = useState(0);
  const refresh = useCallback(async () => {
    const current = version.current;
    const id = owner.current;
    if (!id) return;
    const data = await new LibraryStore(db, id).load();
    if (current !== version.current) return;
    setArticles(data.articles); setNotes(data.notes); setProjects(data.projects);
  }, [db]);
  useEffect(() => {
    let active = true;
    async function load() {
      const current = ++version.current;
      setLoading(true); setError(null);
      try {
        const { data, error: authError } = await db.auth.getUser();
        if (!active || current !== version.current) return;
        if (authError && authError.name !== "AuthSessionMissingError") throw authError;
        const id = data.user?.id || null;
        owner.current = id; setUserId(id);
        if (!id) { setArticles([]); setNotes({}); setProjects([]); setLegacyCount(0); return; }
        await refresh();
        if (!active || current !== version.current) return;
        try {
          const claimed = localStorage.getItem(IMPORT_OWNER);
          const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
          const completed = claimed === id && localStorage.getItem(IMPORT_COMPLETE) === legacyStamp();
          setLegacyCount(!completed && (!claimed || claimed === id) && Array.isArray(legacy) ? legacy.length : 0);
        } catch { setLegacyCount(0); }
      } catch { if (active && current === version.current) setError("Não foi possível carregar sua biblioteca. Tente novamente."); }
      finally { if (active && current === version.current) setLoading(false); }
    }
    void load();
    const { data: subscription } = db.auth.onAuthStateChange((_event, session) => {
      const nextOwner = session?.user.id || null;
      if (nextOwner === owner.current) return;
      ++version.current; owner.current = nextOwner;
      setUserId(nextOwner); setArticles([]); setNotes({}); setProjects([]); setMessage(null); setLegacyCount(0);
      // Run outside the auth callback to avoid awaiting another auth call inside it.
      setTimeout(() => { if (active) void load(); }, 0);
    });
    const onFocus = () => { if (!busy.current) void refresh().catch(() => setError("Não foi possível atualizar a biblioteca.")); };
    window.addEventListener("focus", onFocus);
    return () => { active = false; ++version.current; subscription.subscription.unsubscribe(); window.removeEventListener("focus", onFocus); };
  }, [db, refresh]);

  async function run(operation: (store: LibraryStore, id: string) => Promise<void>, success: string) {
    if (busy.current || loading) return false;
    busy.current = true; setWorking(true); setError(null); setMessage(null);
    const current = version.current;
    try {
      const { data, error: authError } = await db.auth.getUser();
      const id = data.user?.id;
      if (authError || !id || id !== owner.current) throw new Error("Entre na sua conta para salvar na biblioteca.");
      await operation(new LibraryStore(db, id), id);
      await refresh();
      if (current === version.current) setMessage(success);
      return true;
    } catch (e) {
      if (current === version.current && owner.current) { try { await refresh(); } catch {} }
      if (current === version.current) setError(e instanceof Error ? e.message : "Não foi possível salvar. Tente novamente.");
      return false;
    } finally { busy.current = false; setWorking(false); }
  }
  const saveArticle = (article: Article, projectId: string | null = null) => run(async store => { await store.saveArticle(article, projectId); }, "Artigo salvo na sua conta.");
  const saveNote = (id: string, note: EvidenceNote) => run(store => store.saveNote(id, note), "Anotações salvas na sua conta.");
  const assignProject = (id: string, projectId: string | null) => run(store => store.assignProject(id, projectId), "Projeto associado ao artigo.");
  const updateArticle = (id: string, metadata: { readingStatus: ReadingStatus; favorite: boolean; tags: string[]; folder: string; studyDesign: StudyDesign; exclusionReason: string; fullTextUrl: string }) => run(store => store.updateArticle(id, metadata), "Organização do artigo atualizada.");
  const addProjectLink = (id: string, projectId: string) => run(store => store.addProjectLink(id, projectId), "Artigo vinculado ao projeto.");
  const removeProjectLink = (id: string, projectId: string) => run(store => store.removeProjectLink(id, projectId), "Vínculo removido.");
  const mergeDuplicate = (keepId: string, removeId: string) => run(store => store.mergeDuplicate(keepId, removeId), "Registros duplicados unidos; anotações e vínculos foram preservados.");
  const remove = (id: string) => run(store => store.remove(id), "Artigo removido da sua biblioteca.");
  const importLegacy = () => run(async (store, id) => {
    const claimed = localStorage.getItem(IMPORT_OWNER);
    if (claimed && claimed !== id) throw new Error("Os artigos deste navegador já foram importados por outra conta.");
    const stamp = legacyStamp();
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]") as Article[];
    const legacyNotes = JSON.parse(localStorage.getItem(NOTES_KEY) || "{}") as Record<string, EvidenceNote>;
    if (!Array.isArray(legacy)) throw new Error("Não foi possível ler a biblioteca antiga.");
    localStorage.setItem(IMPORT_OWNER, id);
    const data = await store.load();
    for (const article of legacy) {
      const saved = await store.saveArticle(article, null);
      const incoming = legacyNotes[articleKey(article)] || {};
      const merged = mergeImportedNote(data.notes[saved.id], incoming);
      if (Object.values(merged).some(value => value?.trim())) { await store.saveNote(saved.id, merged); data.notes[saved.id] = merged; }
    }
    localStorage.setItem(IMPORT_COMPLETE, stamp);
    setLegacyCount(0);
  }, "Artigos e anotações importados. A cópia antiga continua preservada neste navegador.");
  return { userId, articles, notes, projects, loading, working, error, message, legacyCount, saveArticle, saveNote, assignProject, updateArticle, addProjectLink, removeProjectLink, mergeDuplicate, remove, importLegacy, refresh };
}
