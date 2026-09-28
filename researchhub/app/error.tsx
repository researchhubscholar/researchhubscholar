"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { reportClientError } from "@/components/product-telemetry";

export default function ErrorPage({error,reset}:{error:Error & {digest?:string};reset:()=>void}) {
  const pathname=usePathname();
  useEffect(()=>{void reportClientError(pathname,error);},[error,pathname]);
  return <div className="max-w-xl mx-auto py-16 text-center">
    <p className="text-xs uppercase tracking-widest text-teal">Algo saiu do esperado</p>
    <h1 className="font-display text-4xl mt-3">Não foi possível concluir esta etapa.</h1>
    <p className="text-ink-soft mt-4">Seus dados já salvos permanecem preservados. Tente novamente; se o problema continuar, abra uma solicitação em Conta.</p>
    <div className="flex justify-center gap-3 mt-6"><button type="button" onClick={reset} className="bg-teal text-white px-5 py-3 rounded-card">Tentar novamente</button><a href="/conta" className="border border-line px-5 py-3 rounded-card">Ir para Conta</a></div>
  </div>;
}
