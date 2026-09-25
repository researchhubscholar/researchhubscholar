"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const modules: [string,string][] = [
  ["/dashboard","dashboard"],["/descobrir","radar"],["/ideias","ideas"],["/biblioteca","library"],
  ["/meu-trabalho","project"],["/orientacao","advising"],["/documentos","documents"],
  ["/licenca","license"],["/residencia","residency"],["/conta","account"],["/operacao","operation"],
];

export function moduleFromPath(pathname:string) {
  return modules.find(([prefix])=>pathname===prefix||pathname.startsWith(prefix+"/"))?.[1]||"other";
}

export function reportClientError(pathname:string,error:Error & {digest?:string}) {
  return fetch("/api/telemetry",{method:"POST",headers:{"Content-Type":"application/json"},keepalive:true,
    body:JSON.stringify({kind:"error",module:moduleFromPath(pathname),route:pathname,errorCode:error.digest||"CLIENT_ERROR",message:(error.message||"Erro no cliente").slice(0,500)})}).catch(()=>undefined);
}

export default function ProductTelemetry() {
  const pathname=usePathname();
  useEffect(()=>{
    if(moduleFromPath(pathname)==="other")return;
    void fetch("/api/telemetry",{method:"POST",headers:{"Content-Type":"application/json"},keepalive:true,
      body:JSON.stringify({kind:"event",eventName:"page_view",module:moduleFromPath(pathname),route:pathname})});
  },[pathname]);
  return null;
}
