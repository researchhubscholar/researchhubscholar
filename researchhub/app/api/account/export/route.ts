import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

type ExportSource = { key:string; table:string; ownerColumn:string };

export async function GET() {
  try {
    const db=await supabaseServer();
    const {data:auth}=await db.auth.getUser();
    const user=auth.user;
    if(!user)return NextResponse.json({error:"Sessão expirada."},{status:401});

    const sources:ExportSource[]=[
      {key:"profile",table:"profiles",ownerColumn:"id"},
      {key:"projects",table:"research_projects",ownerColumn:"owner_id"},
      {key:"library",table:"library_articles",ownerColumn:"owner_id"},
      {key:"articleProjects",table:"library_article_projects",ownerColumn:"owner_id"},
      {key:"evidenceMatrix",table:"evidence_matrix",ownerColumn:"owner_id"},
      {key:"searchHistory",table:"search_history",ownerColumn:"owner_id"},
      {key:"ideaVersions",table:"idea_versions",ownerColumn:"owner_id"},
      {key:"savedSearches",table:"scholar_saved_searches",ownerColumn:"owner_id"},
      {key:"searchAlerts",table:"scholar_search_alerts",ownerColumn:"owner_id"},
      {key:"milestones",table:"scholar_project_milestones",ownerColumn:"owner_id"},
      {key:"memberships",table:"scholar_memberships",ownerColumn:"user_id"},
      {key:"wallets",table:"scholar_wallets",ownerColumn:"user_id"},
      {key:"usage",table:"scholar_usage",ownerColumn:"user_id"},
      {key:"generationReviews",table:"scholar_generation_reviews",ownerColumn:"user_id"},
      {key:"generationArtifacts",table:"scholar_generation_artifacts",ownerColumn:"user_id"},
      {key:"supportRequests",table:"scholar_support_requests",ownerColumn:"owner_id"},
      {key:"supportMessages",table:"scholar_support_messages",ownerColumn:"owner_id"},
      {key:"accountRequests",table:"scholar_account_requests",ownerColumn:"owner_id"},
      {key:"productEvents",table:"scholar_product_events",ownerColumn:"owner_user_id"},
      {key:"errorEvents",table:"scholar_error_events",ownerColumn:"owner_user_id"},
      {key:"commentsAuthored",table:"scholar_project_comments",ownerColumn:"author_id"},
    ];
    const results=await Promise.all(sources.map(async source=>{
      const result=await db.from(source.table).select("*").eq(source.ownerColumn,user.id);
      return {key:source.key,data:result.data||[],error:result.error?.message||null};
    }));
    const warnings=results.filter(item=>item.error).map(item=>({section:item.key,error:item.error}));
    const data=Object.fromEntries(results.map(item=>[item.key,item.data]));
    const payload={
      format:"researchhub-scholar-export-v1",generatedAt:new Date().toISOString(),
      account:{id:user.id,email:user.email,createdAt:user.created_at,lastSignInAt:user.last_sign_in_at,userMetadata:user.user_metadata},
      data,warnings,
    };
    return new NextResponse(JSON.stringify(payload,null,2),{status:200,headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Content-Disposition":`attachment; filename="researchhub-scholar-dados-${new Date().toISOString().slice(0,10)}.json"`,
      "Cache-Control":"private, no-store",
    }});
  } catch(error) {
    console.error("Account export failed",error);
    return NextResponse.json({error:"Não foi possível exportar os dados agora."},{status:500});
  }
}
