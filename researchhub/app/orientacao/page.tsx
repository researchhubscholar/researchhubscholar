import AuthoredText from "@/components/i18n/authored-text";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/locale";
import type { MessageKey } from "@/lib/i18n/catalog";
import InterfaceText from "@/components/i18n/interface-text";
import ProjectChoice from "@/components/projects/project-choice";
import { selectedProject } from "@/lib/projects/selection";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdvisingWorkspace,{type Advisor,type AdvisorInvite,type AdvisingComment,type AdvisingMeeting,type AdvisingProject,type AdvisingVersion} from "@/components/advising/advising-workspace";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic="force-dynamic";
export default async function AdvisingPage({searchParams}:{searchParams:Promise<{projeto?:string}>}){
  const requestLocale = await getRequestLocale();
  const uiText = (key: MessageKey) => translate(requestLocale, key);
 const params=await searchParams;const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();if(!user)redirect("/login");
 const [ownResult,linksResult]=await Promise.all([db.from("research_projects").select("id,owner_id,title,theme,progress,status").eq("owner_id",user.id).order("updated_at",{ascending:false}),db.from("scholar_project_collaborators").select("project_id").eq("user_id",user.id).eq("active",true)]);
 const ids=Array.from(new Set([...(ownResult.data||[]).map(item=>item.id),...(linksResult.data||[]).map(item=>item.project_id)]));
 let projects=(ownResult.data||[]) as AdvisingProject[];
 if(ids.length){const result=await db.from("research_projects").select("id,owner_id,title,theme,progress,status").in("id",ids);if(!result.error)projects=(result.data||[]) as AdvisingProject[];}
 if(ownResult.error) return <p role="alert"><InterfaceText message="screen.bd0e6b32780c" /></p>;
 const project=selectedProject(projects, params.projeto);
 if(!project) return <ProjectChoice projects={projects} requested={params.projeto} path="/orientacao" label={uiText("screen.3126f23d71e8")}/>;
 let comments:AdvisingComment[]=[];let meetings:AdvisingMeeting[]=[];let versions:AdvisingVersion[]=[];let advisors:Advisor[]=[];let invites:AdvisorInvite[]=[];let moduleError=linksResult.error;
 if(project){const isOwner=project.owner_id===user.id;const results=await Promise.all([db.from("scholar_project_comments").select("id,author_id,section_key,body,status,created_at").eq("project_id",project.id).order("created_at",{ascending:false}),db.from("scholar_advisor_meetings").select("id,created_by,occurred_on,title,notes,next_steps,created_at").eq("project_id",project.id).order("occurred_on",{ascending:false}),db.from("scholar_project_versions").select("id,label,snapshot,created_at").eq("project_id",project.id).order("created_at",{ascending:false}),db.rpc("scholar_project_advisors",{p_project:project.id}),isOwner?db.from("scholar_advisor_invites").select("id,email,expires_at,revoked,redeemed_at").eq("project_id",project.id).order("created_at",{ascending:false}).limit(20):Promise.resolve({data:[],error:null})]);moduleError=results.find(result=>Boolean(result.error))?.error || moduleError;comments=(results[0].data||[]) as AdvisingComment[];meetings=(results[1].data||[]) as AdvisingMeeting[];versions=(results[2].data||[]) as AdvisingVersion[];advisors=(results[3].data||[]) as Advisor[];invites=(results[4].data||[]) as AdvisorInvite[];}
 return <div className="scholar-workspace secondary-page advising-page max-w-5xl mx-auto"><Link href="/dashboard" className="text-sm text-teal"><InterfaceText message="screen.66078a571c89" /></Link><header className="advising-hero flex flex-wrap justify-between gap-5 items-end mt-5"><div><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.04fd015b1554" /></p><h1 className="font-display text-4xl md:text-5xl mt-3"><InterfaceText message="screen.9b31834e2469" /></h1><p className="text-ink-soft mt-4 max-w-2xl"><InterfaceText message="screen.b3dccb502c1d" /></p></div>{projects.length?<form method="get" className="workspace-project-picker advising-project-picker"><label><InterfaceText message="screen.91aec26f5cfe" /><select name="projeto" defaultValue={project?.id} className="block min-w-64 border rounded-card p-2 mt-1">{projects.map(item=><option key={item.id} value={item.id}>{item.title||item.theme||uiText("screen.53d02a124b87")}</option>)}</select></label><button className="workspace-project-picker-action"><InterfaceText message="screen.4f8625a310af" /></button></form>:null}</header>{moduleError?<div role="alert" className="mt-6 bg-amber-50 border border-amber-200 rounded-card p-4 text-sm"><p>{["42P01","42883","PGRST202","PGRST205"].includes(moduleError.code || "") ? uiText("screen.033378b80419") : uiText("screen.ead9e59fc8eb")}</p><p className="text-xs mt-2">Código: {moduleError.code || uiText("screen.4ac612f84023")} · <AuthoredText text={moduleError.message} /></p><Link href="/orientacao" className="inline-block mt-3 text-teal underline"><InterfaceText message="screen.b9e10688be01" /></Link></div>:<AdvisingWorkspace userId={user.id} project={project} comments={comments} meetings={meetings} versions={versions} advisors={advisors} invites={invites} isOwner={project?.owner_id===user.id}/>}</div>;
}
