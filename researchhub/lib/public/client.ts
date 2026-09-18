import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
export function publicClient() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error("Ambiente indisponível");
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function visitorHash(headers: Headers) {
 // Vercel rewrites this header at its trusted ingress. Avoid trusting caller IPs.
 const ip=process.env.VERCEL?headers.get("x-vercel-forwarded-for")||"unknown":headers.get("x-forwarded-for")||"local";
 return createHash("sha256").update(`scholar-public:${ip.split(",")[0].trim()}`).digest("hex");
}
export function validTopic(value: unknown): value is string { return typeof value==="string"&&value.trim().length>=3&&value.trim().length<=300; }
