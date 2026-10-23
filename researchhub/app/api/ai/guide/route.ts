import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { validGuideArea,guideScope } from "@/lib/ai/areas";
import { guideProject, guideHistory } from "@/lib/ai/guide-server";
export async function GET(request:NextRequest) {
 const db=await supabaseServer();const{data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:"Entre na sua conta."},{status:401});
 const project=request.nextUrl.searchParams.get("project");if(project&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(project))return NextResponse.json({error:"Projeto inválido."},{status:400});
 const area=request.nextUrl.searchParams.get("area");if(!project&&(!validGuideArea(area)||guideScope(area)==="project"))return NextResponse.json({error:"Escolha uma área válida para conversar sem projeto."},{status:400});
 try{if(project)await guideProject(db,user.id,project);return NextResponse.json({turns:await guideHistory(db,user.id,project,validGuideArea(area)?area:undefined)},{headers:{"Cache-Control":"private, no-store"}});}catch(e){const message=e instanceof Error?e.message:"Conversa indisponível.";return NextResponse.json({error:message},{status:message==="Projeto indisponível."?404:503});}
}
