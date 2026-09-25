import { NextRequest,NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const modules=["dashboard","radar","ideas","library","project","advising","documents","license","residency","account","operation","other"];

export async function POST(request:NextRequest) {
  const started=Date.now();const requestId=request.headers.get("x-vercel-id");
  try {
    const raw=await request.text();
    if(raw.length>2000)return NextResponse.json({error:"Evento muito grande."},{status:413});
    const body=JSON.parse(raw);
    const db=await supabaseServer();const {data:auth}=await db.auth.getUser();
    if(!auth.user)return new NextResponse(null,{status:204});
    const module=String(body.module||"");const route=String(body.route||"");
    if(!modules.includes(module)||route.length<1||route.length>160||!/^\/[a-z0-9_/-]*$/.test(route))
      return NextResponse.json({error:"Evento inválido."},{status:400});
    const result=body.kind==="error"
      ? await db.rpc("scholar_record_error_event",{p_module:module,p_route:route,p_error_code:String(body.errorCode||"CLIENT_ERROR").slice(0,80),p_message:String(body.message||"Erro no cliente").slice(0,500)})
      : await db.rpc("scholar_record_product_event",{p_event_name:body.eventName==="action"?"action":"page_view",p_module:module,p_route:route});
    if(result.error)throw result.error;
    console.log(JSON.stringify({level:"info",msg:"telemetry_recorded",route:"/api/telemetry",kind:body.kind==="error"?"error":"event",module,requestId,ms:Date.now()-started}));
    return NextResponse.json({ok:true});
  } catch(error) {
    console.error(JSON.stringify({level:"error",msg:"telemetry_failed",route:"/api/telemetry",error:error instanceof Error?error.message:"unknown",requestId,ms:Date.now()-started}));
    return NextResponse.json({error:"Não foi possível registrar o evento."},{status:400});
  }
}
