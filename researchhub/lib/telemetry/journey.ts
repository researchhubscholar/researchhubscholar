import { supabaseBrowser } from "@/lib/supabase/browser";
type Outcome = "completed" | "failed" | "review";
/** Best effort only: never block or retry the user's search. */
export function trackRadarAttempt(): (outcome: Outcome) => void {
 try {
  const id=crypto.randomUUID(),db=supabaseBrowser();
  const started=Promise.resolve(db.rpc("scholar_record_journey_attempt",{p_id:id,p_flow:"radar_search",p_status:"started"})).catch(()=>null);
  let ended=false;
  return outcome=>{if(ended)return;ended=true;void started.then(result=>{if(result && !result.error && result.data===true)return db.rpc("scholar_record_journey_attempt",{p_id:id,p_flow:"radar_search",p_status:outcome});}).catch(()=>undefined);};
 } catch { return ()=>{}; }
}
