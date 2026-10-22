import type { supabaseServer } from "../supabase/server";
import { validWorkspace } from "../results/data";
import { guideSnapshot, guideStages, guideText, type GuideInput } from "./guide";
import { isAssistantOutput, type AssistantOutput } from "./assist";
type DB=Awaited<ReturnType<typeof supabaseServer>>;
export type GuideTurn={id:string;message:string;output:AssistantOutput;at:string;mode:string;tokens:number};
export async function guideProject(db:DB,userId:string,projectId:string) {
 const {data,error}=await db.from("research_projects").select("id,title,research_question,study_type,population,primary_outcome,methods").eq("id",projectId).eq("owner_id",userId).maybeSingle();
 if(error)throw Error("Não foi possível verificar o projeto.");if(!data)throw Error("Projeto indisponível.");return data;
}
export async function guideHistory(db:DB,userId:string,projectId:string):Promise<GuideTurn[]> {
 const {data,error}=await db.from("scholar_generation_artifacts").select("usage_id,input_snapshot,output_snapshot,created_at,scholar_usage!inner(project_id,user_id,status,mode,input_tokens,output_tokens)")
 .eq("user_id",userId).eq("input_snapshot->>feature","guide").eq("scholar_usage.project_id",projectId).eq("scholar_usage.user_id",userId).eq("scholar_usage.status","completed").order("created_at",{ascending:false}).limit(20);
 if(error)throw Error("Não foi possível carregar a conversa. Tente novamente antes de enviar outra mensagem.");
 return (data||[]).flatMap(row=>{const input=row.input_snapshot as {context?:{message?:unknown}};const usage=Array.isArray(row.scholar_usage)?row.scholar_usage[0]:row.scholar_usage;
 if(!isAssistantOutput(row.output_snapshot)||typeof input?.context?.message!=="string"||!usage)return[];
 return[{id:row.usage_id,message:input.context.message.slice(0,1200),output:row.output_snapshot,at:row.created_at,mode:usage.mode,tokens:(usage.input_tokens||0)+(usage.output_tokens||0)}];}).reverse();
}
export async function prepareGuideContext(db:DB,userId:string,projectId:string,input:GuideInput) {
 const project=await guideProject(db,userId,projectId);
 const [{data,error},turns]=await Promise.all([db.from("scholar_project_results").select("workspace").eq("project_id",projectId).eq("owner_id",userId).maybeSingle(),guideHistory(db,userId,projectId)]);
 if(error)throw Error("Não foi possível verificar os resultados salvos.");if(data?.workspace&&!validWorkspace(data.workspace))throw Error("Os resultados salvos precisam de revisão antes de usar o assistente.");
 const saved=data?.workspace?guideSnapshot(data.workspace):null;
 const compact=(snapshot:ReturnType<typeof guideSnapshot>|null)=>snapshot?{...snapshot,fieldCount:snapshot.fields.length,fields:snapshot.fields.slice(0,12)}:null;
 return {message:input.message,stage:guideStages[input.stage],question:input.question,workingSource:input.dirty?"Rascunho informado pela tela, ainda não salvo nem verificado no servidor":"Dados salvos verificados no servidor",working:input.dirty?compact(input.draft):null,saved:compact(saved),
 protocol:Object.fromEntries((["title","research_question","study_type","population","primary_outcome","methods"] as const).map(k=>[k,guideText(project[k],400)])),
 history:turns.slice(-3).map(t=>({user:t.message.slice(0,600),assistant:t.mode==="simulation"?"Resposta anterior em simulação, sem análise científica.":[t.output.summary,...t.output.recommendations.slice(0,2).map(r=>r.content)].join("\n").slice(0,1000)}))};
}
