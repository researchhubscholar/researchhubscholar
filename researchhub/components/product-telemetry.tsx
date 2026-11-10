"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { telemetryRoute } from "@/lib/telemetry/routes";

export function moduleFromPath(pathname:string) { return telemetryRoute(pathname).module; }

export function reportClientError(pathname:string) {
  return fetch("/api/telemetry",{method:"POST",headers:{"Content-Type":"application/json"},keepalive:true,
    body:JSON.stringify({kind:"error",...telemetryRoute(pathname),errorCode:"CLIENT_ERROR"})}).catch(()=>undefined);
}

export default function ProductTelemetry() {
  const pathname=usePathname();
  useEffect(()=>{
    if(moduleFromPath(pathname)==="other")return;
    void fetch("/api/telemetry",{method:"POST",headers:{"Content-Type":"application/json"},keepalive:true,
      body:JSON.stringify({kind:"event",eventName:"page_view",...telemetryRoute(pathname)})}).catch(()=>undefined);
  },[pathname]);
  return null;
}
