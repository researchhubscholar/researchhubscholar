import {NextRequest,NextResponse} from "next/server";
import {supabaseServer} from "@/lib/supabase/server";
import {supabaseAdmin} from "@/lib/supabase/admin";
import {deletionError,deletionResultMessage} from "@/lib/account/deletion";
export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={"Cache-Control":"private, no-store"};
async function owner(){
 const db=await supabaseServer();const {data:{user},error}=await db.auth.getUser();
 if(error||!user)return {denied:NextResponse.json({error:"Entre na sua conta."},{status:401,headers})};
 const role=await db.from("scholar_platform_admins").select("role").eq("user_id",user.id).maybeSingle();
 if(role.error)return {denied:NextResponse.json({error:"Não foi possível conferir a permissão."},{status:503,headers})};
 if(role.data?.role!=="owner")return {denied:NextResponse.json({error:"Somente o responsável da plataforma pode processar exclusões."},{status:403,headers})};
 return {user};
}
export async function GET(){
 try{const auth=await owner();if(auth.denied)return auth.denied;
  const {data,error}=await supabaseAdmin().rpc("scholar_deletion_review",{p_actor:auth.user!.id});
  if(error)return NextResponse.json({error:deletionError(error)},{status:503,headers});
  let databaseHost="não informado";try{databaseHost=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||"").hostname;}catch{}
  return NextResponse.json({...data,environment:process.env.VERCEL_ENV||"local",databaseHost},{headers});
 }catch{return NextResponse.json({error:"A revisão de exclusões não está disponível."},{status:503,headers});}
}
export async function POST(request:NextRequest){
 try{
  const auth=await owner();if(auth.denied)return auth.denied;
  const origin=request.headers.get("origin");if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:"Origem não permitida."},{status:403,headers});
  const raw=await request.text();if(raw.length>2000)return NextResponse.json({error:"Solicitação extensa demais."},{status:413,headers});
  let body;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:"Solicitação inválida."},{status:400,headers});}
  if(!body||typeof body.requestId!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)||!["execute","verify"].includes(body.action)||body.action==="execute"&&(typeof body.confirmation!=="string"||!body.confirmation.trim()||body.confirmation.length>320))return NextResponse.json({error:"Confira a solicitação e a confirmação."},{status:400,headers});
  const admin=supabaseAdmin(),actor=auth.user!.id;
  if(body.action==="verify"){
   const {data,error}=await admin.rpc("scholar_deletion_finish",{p_actor:actor,p_request:body.requestId,p_result:"check"});
   if(error)return NextResponse.json({error:deletionError(error)},{status:503,headers});
   return NextResponse.json({...data,message:deletionResultMessage(data.state)},{headers});
  }
  const claim=await admin.rpc("scholar_deletion_claim",{p_actor:actor,p_request:body.requestId,p_confirmation:body.confirmation.trim()});
  if(claim.error)return NextResponse.json({error:deletionError(claim.error)},{status:409,headers});
  if(claim.data.state==="completed")return NextResponse.json({...claim.data,message:deletionResultMessage("completed")},{headers});
  // Only the SQL admission selects the target. Never trust a client-supplied user ID.
  let result="uncertain";
  try{const deleted=await admin.auth.admin.deleteUser(claim.data.userId,false);
   if(!deleted.error)result="check";
   else if(deleted.error.status&&deleted.error.status>=400&&deleted.error.status<500&&deleted.error.status!==408)result="rejected";
  }catch{/* Uncertain network outcome must not allow an automatic repeat or cancellation. */}
  const receipt=await admin.rpc("scholar_deletion_finish",{p_actor:actor,p_request:body.requestId,p_result:result});
  if(receipt.error)return NextResponse.json({state:"processing",requestId:body.requestId,message:deletionResultMessage("processing")},{status:202,headers});
  return NextResponse.json({...receipt.data,message:deletionResultMessage(receipt.data.state)},{status:receipt.data.state==="processing"?202:200,headers});
 }catch{return NextResponse.json({error:"O processamento não pôde ser confirmado. Use Verificar resultado antes de repetir."},{status:503,headers});}
}
