"use client";

import { useEffect, useId, useRef, useState } from "react";

export default function AILoadingDialog({ open, statusText = "Aguardando a resposta do modelo.", title = "Preparando suas ideias de pesquisa", description = "A IA está elaborando três propostas com pergunta, desenho e métodos. Ao receber a resposta, o Scholar confere a estrutura antes de exibi-las." }: { open: boolean; title?: string; description?: string; statusText?: string }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const element = dialog.current;
    if (!open) { element?.close(); return; }
    const started = Date.now();
    setSeconds(0);
    element?.showModal();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => { window.clearInterval(timer); element?.close(); };
  }, [open]);
  return <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => event.preventDefault()} className="w-[calc(100%_-_2rem)] max-w-lg rounded-2xl border border-line bg-white p-7 text-ink shadow-xl backdrop:bg-ink/50">
    <div aria-hidden="true" className="mx-auto h-10 w-10 rounded-full border-4 border-teal-soft border-t-teal motion-safe:animate-spin" />
    <h2 id={`${id}-title`} className="mt-5 text-center font-display text-2xl">{title}</h2>
    <p id={`${id}-description`} className="mt-3 text-center text-sm leading-relaxed text-ink-soft">{description}</p>
    <p className="mt-5 text-center font-medium tabular-nums">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} de espera</p>
    <p role="status" className="mt-3 text-center text-sm text-teal">{seconds < 60 ? statusText : "Está demorando mais que o esperado. A solicitação continua em andamento; uma falha será informada na tela."}</p>
    <p className="mt-5 text-center text-xs text-ink-soft">Aguarde sem recarregar. Esta janela fecha automaticamente ao concluir ou informar uma falha.</p>
  </dialog>;
}
