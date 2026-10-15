"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function DeleteProject({ id, title, ownerId }: { id: string; title: string; ownerId: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);
  async function remove() {
    if (lock.current || confirmation !== "EXCLUIR") return;
    lock.current = true; setPending(true); setError("");
    try {
      const { error: failure } = await supabaseBrowser().rpc("scholar_delete_project", { p_project_id: id });
      if (failure) throw new Error(failure.code === "PGRST202"
        ? "A exclusão segura precisa ser ativada com scholar_project_delete.sql no Supabase."
        : "Não foi possível excluir o projeto. Verifique sua sessão e tente novamente.");
      try {
        const key = `researchhub-scholar-draft:${ownerId}`;
        const raw = window.localStorage.getItem(key);
        if (raw && JSON.parse(raw)?._projectId === id) window.localStorage.removeItem(key);
      } catch { /* A exclusão na conta já foi confirmada. */ }
      dialog.current?.close(); setDeleted(true); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível excluir."); }
    finally { lock.current = false; setPending(false); }
  }
  if (deleted) return <p role="status" className="mt-4 text-sm text-teal">Projeto excluído. Atualizando a lista…</p>;
  return <div className="mt-4">
    <button type="button" className="text-sm text-red-700 underline" onClick={() => { setConfirmation(""); setError(""); dialog.current?.showModal(); }}>Excluir projeto</button>
    <dialog ref={dialog} aria-labelledby={`delete-title-${id}`} aria-describedby={`delete-description-${id}`} onCancel={event => { if (lock.current) event.preventDefault(); }} className="w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line p-6 text-ink backdrop:bg-black/50">
      <h2 id={`delete-title-${id}`} className="font-display text-2xl">Excluir este projeto?</h2>
      <p className="mt-3 font-medium break-words">{title}</p>
      <p id={`delete-description-${id}`} className="mt-3 text-sm text-ink-soft">Esta ação é permanente. O protocolo, manuscrito e suas versões, resultados, jornada e registros de orientação vinculados serão excluídos. Os compartilhamentos serão encerrados. Artigos e avaliações da biblioteca serão preservados, assim como as ideias salvas.</p>
      <label className="block text-sm mt-5">Digite EXCLUIR para confirmar<input autoComplete="off" value={confirmation} disabled={pending} onChange={event => setConfirmation(event.target.value)} className="block w-full rounded-card border border-line p-3 mt-2" /></label>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-3"><button type="button" autoFocus disabled={pending} onClick={() => dialog.current?.close()} className="border border-line rounded-card px-4 py-2 disabled:opacity-50">Cancelar</button><button type="button" disabled={pending || confirmation !== "EXCLUIR"} onClick={remove} className="bg-red-700 text-white rounded-card px-4 py-2 disabled:opacity-50">{pending ? "Excluindo…" : "Excluir definitivamente"}</button></div>
    </dialog>
  </div>;
}
