import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scholarAI, scholarAIModels } from "@/lib/ai/config";
import { performanceSummary } from "@/lib/ai/evaluation/rubric";
export const dynamic="force-dynamic";
export async function GET() {
 const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:"Não autorizado."},{status:401});
 const {data:role}=await db.from("scholar_platform_admins").select("role").eq("user_id",user.id).maybeSingle();if(!role)return NextResponse.json({error:"Acesso restrito."},{status:403});
 try{const admin=supabaseAdmin();const since=new Date(Date.now()-7*86400000).toISOString();const day=new Date().toISOString().slice(0,10)+"T00:00:00Z";
 const [usage,budget,admissions,evaluations]=await Promise.all([admin.from("scholar_usage").select("status,input_tokens,output_tokens,cost_usd,created_at,finished_at").gte("created_at",since).eq("mode","live").limit(2000),admin.from("scholar_ai_budget_settings").select("enabled,global_daily_usd,license_daily_usd,operation_envelope_usd").eq("id",true).maybeSingle(),admin.from("scholar_ai_budget_admissions").select("reserved_usd").gte("created_at",day).limit(10000),admin.from("scholar_ai_evaluations").select("specificity,methods,feasibility,sources,usefulness").limit(2000)]);
 const pricingReady=[scholarAI.inputUsdPerToken,scholarAI.outputUsdPerToken].every(n=>Number.isFinite(n)&&n>0);const requiredEnvelope=pricingReady?scholarAI.reservedTokens*Math.max(scholarAI.inputUsdPerToken,scholarAI.outputUsdPerToken)*scholarAIModels.length:null;
 return NextResponse.json({summary:usage.error?null:performanceSummary(usage.data||[]),sampleLimit:2000,budget:budget.data,budgetAvailable:!budget.error,pricingReady,requiredEnvelope,envelopeReady:requiredEnvelope!==null&&Number(budget.data?.operation_envelope_usd)>=requiredEnvelope,admittedToday:admissions.error?null:(admissions.data||[]).reduce((s,a)=>s+Number(a.reserved_usd),0),evaluationCount:evaluations.error?null:evaluations.data?.length||0,evaluationMean:evaluations.data?.length?evaluations.data.reduce((sum,r)=>sum+(r.specificity+r.methods+r.feasibility+r.sources+r.usefulness)/5,0)/evaluations.data.length:null,emailConfigured:Boolean(process.env.RESEND_API_KEY&&process.env.SCHOLAR_EMAIL_FROM),cronConfigured:Boolean(process.env.CRON_SECRET),model:scholarAI.model});
 }catch{return NextResponse.json({error:"Diagnóstico indisponível."},{status:503});}
}
