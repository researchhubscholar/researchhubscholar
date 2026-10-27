import type { SupabaseClient } from "@supabase/supabase-js";
type Source={key:string;label:string;table:string;owner?:string;project?:string;parent?:string;order?:string[];select?:string;pageSize?:number};
export const accountExportSources:Source[]=[
 {key:"profile",label:"Perfil",table:"profiles",owner:"id"},
 {key:"projects",label:"Projetos",table:"research_projects",owner:"owner_id"},
 {key:"projectOrigins",label:"Origem das propostas",table:"scholar_project_origins",owner:"owner_id",order:["project_id"]},
 {key:"library",label:"Biblioteca",table:"library_articles",owner:"owner_id"},
 {key:"articleProjects",label:"Vínculos de artigos",table:"library_article_projects",owner:"owner_id",order:["article_id","project_id"]},
 {key:"evidenceMatrix",label:"Matriz de evidências",table:"evidence_matrix",owner:"owner_id"},
 {key:"searchHistory",label:"Histórico de buscas",table:"search_history",owner:"owner_id"},
 {key:"ideaVersions",label:"Versões das ideias",table:"idea_versions",owner:"owner_id",pageSize:10},
 {key:"savedSearches",label:"Buscas salvas",table:"scholar_saved_searches",owner:"owner_id"},
 {key:"searchAlerts",label:"Alertas",table:"scholar_search_alerts",owner:"owner_id"},
 {key:"projectTasks",label:"Tarefas",table:"scholar_project_tasks",owner:"owner_id"},
 {key:"milestones",label:"Etapas do projeto",table:"scholar_project_milestones",owner:"owner_id"},
 {key:"results",label:"Coleta, visitas, análises e figuras",table:"scholar_project_results",owner:"owner_id",order:["project_id"],pageSize:1},
 {key:"manuscripts",label:"Manuscritos",table:"scholar_manuscripts",owner:"owner_id"},
 {key:"manuscriptSections",label:"Seções do manuscrito",table:"scholar_manuscript_sections",owner:"owner_id",pageSize:10},
 {key:"manuscriptVersions",label:"Versões do manuscrito",table:"scholar_manuscript_versions",owner:"owner_id",pageSize:1},
 {key:"projectVersions",label:"Versões do projeto",table:"scholar_project_versions",owner:"owner_id",pageSize:1},
 {key:"projectComments",label:"Comentários nos seus projetos",table:"scholar_project_comments",project:"project_id"},
 {key:"advisorMeetings",label:"Reuniões dos seus projetos",table:"scholar_advisor_meetings",project:"project_id"},
 {key:"collaborators",label:"Orientadores dos seus projetos",table:"scholar_project_collaborators",project:"project_id",order:["project_id","user_id"]},
 {key:"advisorInvites",label:"Convites criados",table:"scholar_advisor_invites",owner:"created_by",select:"id,project_id,created_by,email,expires_at,redeemed_by,redeemed_at,revoked,created_at"},
 {key:"manuscriptComments",label:"Comentários dos seus manuscritos",table:"scholar_manuscript_comments",project:"project_id"},
 {key:"manuscriptReplies",label:"Respostas nos seus manuscritos",table:"scholar_manuscript_comment_replies",project:"comment_id",parent:"manuscriptComments"},
 {key:"projectShares",label:"Compartilhamentos dos seus projetos",table:"scholar_project_shares",project:"project_id",order:["project_id","organization_id"]},
 {key:"personalLicenses",label:"Licenças pessoais",table:"scholar_licenses",owner:"owner_id"},
 {key:"commentsAuthored",label:"Comentários de projeto que você escreveu",table:"scholar_project_comments",owner:"author_id"},
 {key:"manuscriptCommentsAuthored",label:"Comentários de manuscrito que você escreveu",table:"scholar_manuscript_comments",owner:"author_id"},
 {key:"manuscriptRepliesAuthored",label:"Respostas que você escreveu",table:"scholar_manuscript_comment_replies",owner:"author_id"},
 {key:"meetingsAuthored",label:"Reuniões que você registrou",table:"scholar_advisor_meetings",owner:"created_by"},
 {key:"advisingMemberships",label:"Seus vínculos de orientação",table:"scholar_project_collaborators",owner:"user_id",order:["project_id"]},
 {key:"memberships",label:"Vínculos institucionais",table:"scholar_memberships",owner:"user_id",order:["organization_id"]},
 {key:"wallets",label:"Franquias",table:"scholar_wallets",owner:"user_id"},
 {key:"usage",label:"Histórico de uso",table:"scholar_usage",owner:"user_id"},
 {key:"generationReviews",label:"Avaliações das gerações",table:"scholar_generation_reviews",owner:"user_id",order:["usage_id"]},
 {key:"generationArtifacts",label:"Conversas e gerações",table:"scholar_generation_artifacts",owner:"user_id",order:["usage_id"],pageSize:1},
 {key:"scientificEvaluations",label:"Avaliações científicas",table:"scholar_ai_evaluations",owner:"evaluator_id",order:["usage_id"]},
 {key:"supportRequests",label:"Chamados",table:"scholar_support_requests",owner:"owner_id"},
 {key:"supportMessages",label:"Mensagens de suporte",table:"scholar_support_messages",owner:"owner_id"},
 {key:"accountRequests",label:"Solicitações da conta",table:"scholar_account_requests",owner:"owner_id"},
 {key:"productEvents",label:"Eventos de uso",table:"scholar_product_events",owner:"owner_user_id"},
 {key:"errorEvents",label:"Erros da conta",table:"scholar_error_events",owner:"owner_user_id"},
 {key:"purchaseRequests",label:"Solicitações comerciais da conta",table:"scholar_purchase_requests",owner:"requester_id"},
];
type Section={key:string;label:string;rows:number;status:"complete"|"partial"|"unavailable";code?:string};
type ExportUser={id:string;email?:string;created_at?:string;last_sign_in_at?:string;user_metadata?:unknown};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Cursor values come only from UUID primary keys returned by the database. */
export function nextExportCursor(keys:string[],row:Record<string,unknown>){
 const values=keys.map(key=>{const value=String(row[key]||"");if(!uuid.test(value))throw Error("INVALID_CURSOR");return value;});
 return keys.map((key,i)=>i===0?`${key}.gt.${values[i]}`:`and(${keys.slice(0,i).map((prior,j)=>`${prior}.eq.${values[j]}`).join(",")},${key}.gt.${values[i]})`).join(",");
}
/** Stream pages; report every omission. Uses the user's RLS session, not service_role. */
export async function* accountExportChunks(db:SupabaseClient,user:ExportUser,signal:AbortSignal,options:{sources?:Source[];deadlineMs?:number}={}):AsyncGenerator<string>{
 const startedAt=new Date().toISOString(),deadline=Date.now()+(options.deadlineMs??240000),sections:Section[]=[],projects:string[]=[],commentIds:string[]=[];
 let projectsComplete=false,commentsComplete=false,first=true;
 yield `{"format":"researchhub-scholar-export-v2","generatedAt":${JSON.stringify(startedAt)},"account":${JSON.stringify({id:user.id,email:user.email,createdAt:user.created_at,lastSignInAt:user.last_sign_in_at,userMetadata:user.user_metadata})},"data":{`;
 for(const source of options.sources??accountExportSources){
  if(signal.aborted)throw Error("EXPORT_CANCELLED");
  const section:Section={key:source.key,label:source.label,rows:0,status:"complete"};
  yield `${first?"":","}${JSON.stringify(source.key)}:[`;first=false;
  try{
   if(source.project&&!(source.parent?commentsComplete:projectsComplete))throw Error("PARENT_LIST_INCOMPLETE");
   const ids=source.parent?commentIds:projects;
   const scopes:(string[]|null)[]=source.project?Array.from({length:Math.ceil(ids.length/50)},(_,i)=>ids.slice(i*50,i*50+50)):[null];
   for(const scope of scopes){let cursor="";const keys=source.order??["id"];
    for(;;){
     if(Date.now()>=deadline)throw Error("TIME_LIMIT");if(signal.aborted)throw Error("EXPORT_CANCELLED");
     let query=db.from(source.table).select(source.select??"*");
     if(source.owner)query=query.eq(source.owner,user.id);if(source.project&&scope)query=query.in(source.project,scope);
     for(const key of keys)query=query.order(key,{ascending:true});if(cursor)query=query.or(cursor);
     const page=await query.limit(source.pageSize??100).abortSignal(AbortSignal.any([signal,AbortSignal.timeout(20000)]));
     if(page.error)throw Error(["42P01","PGRST205","PGRST202","42703"].includes(page.error.code)?"MODULE_UNAVAILABLE":"READ_FAILED");
     const rows=(page.data??[]) as unknown as Record<string,unknown>[];if(!rows.length)break;
     const next=nextExportCursor(keys,rows[rows.length-1]);if(next===cursor)throw Error("PAGINATION_STALLED");
     for(const row of rows){if(source.key==="projects")projects.push(String(row.id));if(source.key==="manuscriptComments")commentIds.push(String(row.id));yield `${section.rows?",":""}${JSON.stringify(row)}`;section.rows++;}
     cursor=next; // Continue after short pages: server caps may be below pageSize.
    }
   }
  }catch(error){
   if(signal.aborted)throw error;section.status=section.rows?"partial":"unavailable";
   section.code=error instanceof Error&&["MODULE_UNAVAILABLE","PARENT_LIST_INCOMPLETE","TIME_LIMIT","INVALID_CURSOR","PAGINATION_STALLED"].includes(error.message)?error.message:"READ_FAILED";
  }
  if(source.key==="projects")projectsComplete=section.status==="complete";if(source.key==="manuscriptComments")commentsComplete=section.status==="complete";
  sections.push(section);yield "]";
 }
 const complete=sections.every(section=>section.status==="complete");
 yield `},"warnings":${JSON.stringify(sections.filter(s=>s.status!=="complete").map(s=>({section:s.key,label:s.label,code:s.code})))},"manifest":${JSON.stringify({status:complete?"complete":"partial",startedAt,completedAt:new Date().toISOString(),consistency:"live-read-not-transactional-snapshot",sections,notes:["Somente registros salvos e permitidos para esta conta. Rascunhos locais e arquivos externos não entram.","Não é backup restaurável nem fotografia transacional: evite editar durante a exportação.","Comentários e reuniões podem aparecer no contexto do projeto próprio e entre os registros que você escreveu."]})}}`;
}
export function accountExportStream(db:SupabaseClient,user:ExportUser,signal:AbortSignal){
 const cancellation=new AbortController(),encoder=new TextEncoder(),chunks=accountExportChunks(db,user,AbortSignal.any([signal,cancellation.signal]));
 return new ReadableStream<Uint8Array>({async pull(controller){try{const next=await chunks.next();if(next.done)controller.close();else controller.enqueue(encoder.encode(next.value));}catch{controller.error(Error("A exportação foi interrompida. Tente novamente."));}},async cancel(){cancellation.abort();await chunks.return(undefined);}});
}
