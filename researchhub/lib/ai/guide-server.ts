import { sourceManifest,type GuideSource,type SourceManifest } from "./guide-sources";
import { guideAreas,guideScope,type GuideArea } from "./areas";
import type { supabaseServer } from "../supabase/server";
import { validWorkspace } from "../results/data";
import { guideSnapshot, guideStages, guideText, type GuideInput } from "./guide";
import { isAssistantOutput, type AssistantOutput } from "./assist";
type DB=Awaited<ReturnType<typeof supabaseServer>>;
export type GuideTurn={id:string;message:string;output:AssistantOutput;at:string;mode:string;tokens:number;excerptToken?:string;sources?:SourceManifest[]};
export async function guideProject(db:DB,userId:string,projectId:string) {
 const {data,error}=await db.from("research_projects").select("id,title,research_question,study_type,population,primary_outcome,methods,objective,analysis_plan,inclusion_criteria,exclusion_criteria").eq("id",projectId).eq("owner_id",userId).maybeSingle();
 if(error)throw Error("Não foi possível verificar o projeto.");if(!data)throw Error("Projeto indisponível.");return data;
}
export async function guideHistory(db:DB,userId:string,projectId:string|null,area?:GuideArea):Promise<GuideTurn[]> {
 let query=db.from("scholar_generation_artifacts").select("usage_id,input_snapshot,output_snapshot,created_at,scholar_usage!inner(project_id,user_id,status,mode,input_tokens,output_tokens)")
 .eq("user_id",userId).eq("input_snapshot->>feature","guide").eq("scholar_usage.user_id",userId).eq("scholar_usage.status","completed");
 query=projectId?query.eq("scholar_usage.project_id",projectId):query.is("scholar_usage.project_id",null).eq("input_snapshot->context->>areaKey",area||"dashboard");
 const {data,error}=await query.order("created_at",{ascending:false}).limit(20);
 if(error)throw Error("Não foi possível carregar a conversa. Tente novamente antes de enviar outra mensagem.");
 return (data||[]).flatMap(row=>{const input=row.input_snapshot as {context?:{message?:unknown;sources?:GuideSource[]}};const usage=Array.isArray(row.scholar_usage)?row.scholar_usage[0]:row.scholar_usage;
 if(!isAssistantOutput(row.output_snapshot)||typeof input?.context?.message!=="string"||!usage)return[];
 return[{sources:sourceManifest(input.context?.sources||[]),id:row.usage_id,message:input.context.message.slice(0,1200),output:row.output_snapshot,at:row.created_at,mode:usage.mode,tokens:(usage.input_tokens||0)+(usage.output_tokens||0)}];}).reverse();
}
export async function prepareGuideContext(db:DB,userId:string,projectId:string|null,input:GuideInput) {
 const area=input.area||"resultados";
 const sources:GuideSource[]=[];
 if(input.sourceIds?.length){
 const [articles,notes]=await Promise.all([
 db.from("library_articles").select("id,title,pmid,doi,abstract").eq("owner_id",userId).in("id",input.sourceIds),
 db.from("evidence_matrix").select("article_id,objective,population,method,main_finding,limitation,notes").eq("owner_id",userId).in("article_id",input.sourceIds)]);
 if(articles.error||notes.error)throw Error("Não foi possível conferir as fontes salvas. Nenhum envio foi reservado.");
 for(const [index,id] of input.sourceIds.entries()){
 const a=articles.data?.find(a=>a.id===id);if(!a)throw Error("Uma fonte selecionada não está disponível nesta conta. Selecione novamente.");
 const n=notes.data?.find(n=>n.article_id===id);
 const rawNotes=n?[n.objective,n.population,n.method,n.main_finding,n.limitation,n.notes].filter(Boolean).join("\n"):"";
 const abstract=guideText(a.abstract,2000),noteText=guideText(rawNotes,800);
 if(!abstract&&!noteText)throw Error("Uma fonte não possui resumo ou anotações salvas utilizáveis. Complete a leitura ou retire-a da seleção.");
 sources.push({id,label:`S${index+1}`,title:guideText(a.title,200),pmid:guideText(a.pmid,30),doi:guideText(a.doi,150),abstract,notes:noteText,truncated:Boolean((a.abstract?.length||0)>2000||rawNotes.length>800)});
 }
 }

 if(!projectId){if(guideScope(area)==="project")throw Error("Selecione um projeto para conversar.");const turns=await guideHistory(db,userId,null,area);return {sources,message:input.message,areaKey:area,area:guideAreas[area].title,pageHelp:guideAreas[area].help,scope:"Conversa sem projeto. Use somente a mensagem e esta conversa. Nenhum protocolo, manuscrito ou dado de projeto foi consultado. Somente as referências explicitamente selecionadas em sources estão disponíveis. Ajude a explorar ideias ou tarefas avulsas, sem pressupor um estudo já definido.",history:turns.slice(-3).map(t=>({user:t.message,assistant:t.mode==="simulation"?"Simulação sem análise científica.":t.output.summary}))};}
 if(guideScope(area)==="general")throw Error("Esta conversa deve continuar sem projeto.");
 const project=await guideProject(db,userId,projectId);
 const [{data,error},turns]=await Promise.all([db.from("scholar_project_results").select("workspace").eq("project_id",projectId).eq("owner_id",userId).maybeSingle(),guideHistory(db,userId,projectId)]);
 if(error)throw Error("Não foi possível verificar os resultados salvos.");if(data?.workspace&&!validWorkspace(data.workspace))throw Error("Os resultados salvos precisam de revisão antes de usar o assistente.");
 let overview:unknown=null;
 if(input.area&&input.area!=="resultados"){
  const [direct,links,manuscript]=await Promise.all([db.from("library_articles").select("id").eq("owner_id",userId).eq("project_id",projectId),db.from("library_article_projects").select("article_id").eq("owner_id",userId).eq("project_id",projectId),db.from("scholar_manuscripts").select("id").eq("owner_id",userId).eq("project_id",projectId).maybeSingle()]);
  let sections:string[]|null=null;
  if(manuscript.data&&!manuscript.error){const result=await db.from("scholar_manuscript_sections").select("section_key").eq("manuscript_id",manuscript.data.id).eq("owner_id",userId).neq("content","");if(!result.error)sections=(result.data||[]).map(s=>s.section_key);}
  overview={linkedArticleCount:direct.error||links.error?null:new Set([...(direct.data||[]).map(a=>a.id),...(links.data||[]).map(a=>a.article_id)]).size,manuscriptExists:manuscript.error?null:Boolean(manuscript.data),nonemptyManuscriptSections:sections,scope:"Contagens e seções preenchidas, sem conteúdo de artigos ou texto do manuscrito. Contagem não mede suficiência científica."};
 }
 const saved=data?.workspace?guideSnapshot(data.workspace):null;
 const compact=(snapshot:ReturnType<typeof guideSnapshot>|null)=>snapshot?{...snapshot,fieldCount:snapshot.fields.length,fields:snapshot.fields.slice(0,12)}:null;
 return {excerpt:input.excerpt||null,sources,areaKey:area,overview,area:guideAreas[input.area||"resultados"].title,pageHelp:guideAreas[input.area||"resultados"].help,scope:input.area&&input.area!=="resultados"?"Somente protocolo e resultados salvos. Do texto em edição, somente o trecho explicitamente anexado em excerpt está disponível; é um rascunho, não validado nem salvo por este envio. Outras telas não foram enviadas. Somente as fontes explicitamente selecionadas em sources estão disponíveis; não afirme ter lido o manuscrito.":"Dados da tela de Resultados e protocolo salvo",message:input.message,stage:guideStages[input.stage],question:input.question,workingSource:input.dirty?"Rascunho informado pela tela, ainda não salvo nem verificado no servidor":"Dados salvos verificados no servidor",working:input.dirty?compact(input.draft):null,saved:compact(saved),
 protocol:Object.fromEntries((["title","research_question","study_type","population","primary_outcome","methods","objective","analysis_plan","inclusion_criteria","exclusion_criteria"] as const).map(k=>[k,guideText(project[k],400)])),
 history:turns.slice(-3).map(t=>({user:t.message.slice(0,600),assistant:t.mode==="simulation"?"Resposta anterior em simulação, sem análise científica.":[t.output.summary,...t.output.recommendations.slice(0,2).map(r=>r.content)].join("\n").slice(0,1000)}))};
}
