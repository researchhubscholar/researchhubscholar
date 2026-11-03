"use client";
import InterfaceText from "@/components/i18n/interface-text";


import type { OpenAccessResult } from "@/lib/literature/open-access";

export function OpenAccessStatus({ result, existingUrl, loading, onCheck, onSave, disabled }: {
  result?: OpenAccessResult; existingUrl?: string | null; loading?: boolean;
  onCheck?: () => void; onSave?: (url: string) => void; disabled?: boolean;
}) {
  const url = existingUrl || result?.url;
  if (existingUrl) return <div className="flex flex-wrap items-center gap-3 mt-4 text-xs"><span className="bg-teal-soft text-teal px-2 py-1 rounded-full"><InterfaceText message="screen.8207e7ee14a1" /></span><a href={existingUrl} target="_blank" rel="noreferrer" className="text-teal underline">Abrir texto completo ↗</a></div>;
  if (loading) return <p role="status" className="text-xs text-ink-soft mt-4"><InterfaceText message="screen.d8483eefa47d" /></p>;
  if (result?.status === "open" && url) return <div className="mt-4"><div className="flex flex-wrap items-center gap-3 text-xs"><span className="bg-teal-soft text-teal px-2 py-1 rounded-full"><InterfaceText message="screen.332432094ef6" /></span><span className="text-ink-soft">{result.source}{result.license ? ` · ${result.license}` : ""}</span><a href={url} target="_blank" rel="noreferrer" className="text-teal underline">{result.isPdf ? "Abrir PDF" : "Abrir texto completo"} ↗</a></div>{onSave && <button type="button" disabled={disabled} onClick={() => onSave(url)} className="mt-2 text-xs text-teal underline disabled:opacity-50"><InterfaceText message="screen.54b3b4fabff5" /></button>}</div>;
  if (result?.status === "unavailable") return <p className="text-xs text-ink-soft mt-4"><span className="bg-paper border border-line px-2 py-1 rounded-full"><InterfaceText message="screen.bc561bd15d2a" /></span> <span className="ml-2"><InterfaceText message="screen.7b8dce514348" /></span></p>;
  if (result?.status === "unknown") return <p className="text-xs text-ink-soft mt-4"><InterfaceText message="screen.b29a769d08d2" />{onCheck && <button type="button" onClick={onCheck} className="ml-2 text-teal underline"><InterfaceText message="screen.b9e10688be01" /></button>}</p>;
  return onCheck ? <button type="button" onClick={onCheck} className="mt-4 text-xs text-teal border border-teal/30 px-3 py-2 rounded-card"><InterfaceText message="screen.22befd293885" /></button> : null;
}
