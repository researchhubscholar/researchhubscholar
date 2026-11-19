import {NextResponse} from "next/server";
import {supabaseServer} from "@/lib/supabase/server";
import {supabaseAdmin} from "@/lib/supabase/admin";
import {operationalAlerts,type HealthCount,type HealthMetrics} from "@/lib/operations/health";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const safeCount=(result:{count:number|null;error:unknown}):HealthCount=>result.error?null:result.count??null;
export async function GET(){
  const client=await supabaseServer();
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)return NextResponse.json({error:"Sessão necessária."},{status:401});
  const {data:adminRole,error:roleError}=await client.from("scholar_platform_admins").select("role").eq("user_id",user.id).maybeSingle();
  if(roleError)return NextResponse.json({error:"Não foi possível verificar o acesso administrativo."},{status:503});
  if(!adminRole||!["owner","analyst"].includes(adminRole.role))return NextResponse.json({error:"Acesso restrito."},{status:403});
  try {
    const db=supabaseAdmin();
    const now=Date.now(),hours24=new Date(now-86400000).toISOString(),days7=new Date(now-7*86400000).toISOString(),hourAgo=new Date(now-3600000).toISOString();
    // Count-only queries avoid fetching project content, users' messages or patient data.
    const [ai24,aiFail24,aiReserved,ai7,aiFail7,checkoutPending,checkoutStale,checkoutActivated,openErrors,decs24,decsFailures24,asaas24,asaasFailures24]=await Promise.all([
      db.from("scholar_usage").select("*",{count:"exact",head:true}).eq("mode","live").gte("created_at",hours24),
      db.from("scholar_usage").select("*",{count:"exact",head:true}).eq("mode","live").eq("status","failed").gte("created_at",hours24),
      db.from("scholar_usage").select("*",{count:"exact",head:true}).eq("mode","live").eq("status","reserved").gte("created_at",hours24),
      db.from("scholar_usage").select("*",{count:"exact",head:true}).eq("mode","live").gte("created_at",days7),
      db.from("scholar_usage").select("*",{count:"exact",head:true}).eq("mode","live").eq("status","failed").gte("created_at",days7),
      db.from("scholar_purchase_requests").select("*",{count:"exact",head:true}).eq("status","payment_pending").gte("created_at",hours24),
      db.from("scholar_purchase_requests").select("*",{count:"exact",head:true}).eq("status","payment_pending").lt("created_at",hourAgo),
      db.from("scholar_purchase_requests").select("*",{count:"exact",head:true}).eq("status","activated").gte("updated_at",days7),
      db.from("scholar_error_events").select("*",{count:"exact",head:true}).eq("status","open"),
      db.from("scholar_provider_health_events").select("*",{count:"exact",head:true}).eq("service","decs").gte("created_at",hours24),
      db.from("scholar_provider_health_events").select("*",{count:"exact",head:true}).eq("service","decs").in("outcome",["http_error","network_error","timeout","parse_error"]).gte("created_at",hours24),
      db.from("scholar_provider_health_events").select("*",{count:"exact",head:true}).eq("service","asaas").gte("created_at",hours24),
      db.from("scholar_provider_health_events").select("*",{count:"exact",head:true}).eq("service","asaas").in("outcome",["processing_failed","invalid_payload","unlinked_checkout","amount_mismatch","ineligible"]).gte("created_at",hours24)
    ]);
    const metrics:HealthMetrics={
      ai24h:safeCount(ai24),aiFailed24h:safeCount(aiFail24),aiReserved24h:safeCount(aiReserved),
      ai7d:safeCount(ai7),aiFailed7d:safeCount(aiFail7),
      paymentsPending24h:safeCount(checkoutPending),paymentsStale:safeCount(checkoutStale),
      paymentsActivated7d:safeCount(checkoutActivated),appErrorsOpen:safeCount(openErrors)
    };
    const providers={decs:{attempts24h:safeCount(decs24),failures24h:safeCount(decsFailures24)},asaas:{events24h:safeCount(asaas24),attention24h:safeCount(asaasFailures24)}};
    const partial=Object.values(metrics).some(v=>v===null)||[decs24,decsFailures24,asaas24,asaasFailures24].some(v=>v.error);
    return NextResponse.json({asOf:new Date(now).toISOString(),partial,metrics,providers,alerts:operationalAlerts(metrics),checks:{
      decs:{state:decs24.error?"unavailable":"instrumented",label:decs24.error?"DeCS: sem dados de telemetria; aplicar migração de observabilidade.":"DeCS: tentativas e falhas externas registradas; ausência de chamadas não comprova disponibilidade."},
      gateway:{state:"inferred",label:"IA: indicador baseado nas operações registradas, não em disponibilidade do provedor"},
      payments:{state:asaas24.error?"unavailable":"instrumented",label:asaas24.error?"Asaas: sem dados de telemetria; aplicar migração de observabilidade.":"Asaas: webhooks recebidos e falhas de processamento locais; eventos não recebidos não são detectáveis."}
    }},{headers:{"Cache-Control":"private, no-store"}});
  }catch{
    return NextResponse.json({error:"Não foi possível consultar os indicadores operacionais."},{status:503,headers:{"Cache-Control":"private, no-store"}});
  }
}
