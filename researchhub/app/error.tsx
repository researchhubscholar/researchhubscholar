"use client";
import InterfaceText from "@/components/i18n/interface-text";


import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { reportClientError } from "@/components/product-telemetry";

export default function ErrorPage({error,reset}:{error:Error & {digest?:string};reset:()=>void}) {
  const pathname=usePathname();
  useEffect(()=>{void reportClientError(pathname);},[error,pathname]);
  return <div className="max-w-xl mx-auto py-16 text-center">
    <p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.069828758bb8" /></p>
    <h1 className="font-display text-4xl mt-3"><InterfaceText message="screen.f54a4e9eb8a6" /></h1>
    <p className="text-ink-soft mt-4"><InterfaceText message="screen.3a973c99e35b" /></p>
    <div className="flex justify-center gap-3 mt-6"><button type="button" onClick={reset} className="bg-teal text-white px-5 py-3 rounded-card"><InterfaceText message="screen.b9e10688be01" /></button><a href="/conta" className="border border-line px-5 py-3 rounded-card"><InterfaceText message="screen.1fe45fbaf5ac" /></a></div>
  </div>;
}
