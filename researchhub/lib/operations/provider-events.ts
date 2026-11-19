import "server-only";
import {supabaseAdmin} from "@/lib/supabase/admin";
export type ProviderService="decs"|"asaas";
export type ProviderOutcome="success"|"http_error"|"network_error"|"timeout"|"parse_error"|"unmatched"|"invalid_payload"|"unlinked_checkout"|"amount_mismatch"|"duplicate"|"ineligible"|"processing_failed"|"ignored";
export type ProviderEvent={service:ProviderService;outcome:ProviderOutcome;status_code?:number;duration_ms?:number};
export async function recordProviderEvent(input:ProviderEvent):Promise<void>{
  // Best-effort: telemetry must never change provider behavior, prevent an
  // activation, or expose any search terms, secrets, IDs or payment payloads.
  try{
    const {error}=await supabaseAdmin().from("scholar_provider_health_events").insert({
      service:input.service,outcome:input.outcome,
      status_code:input.status_code??null,duration_ms:input.duration_ms??null
    });
    if(error)console.warn("[provider-health] write unavailable",{service:input.service,code:error.code});
  }catch{console.warn("[provider-health] storage unavailable",{service:input.service});}
}
