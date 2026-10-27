import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { accountExportStream } from "@/lib/account/export";
export const dynamic="force-dynamic";
export const maxDuration=300;
export async function GET(request:Request){
 try{
  const db=await supabaseServer();const {data:auth,error}=await db.auth.getUser();
  if(error||!auth.user)return NextResponse.json({error:"Sessão expirada."},{status:401});
  return new Response(accountExportStream(db,auth.user,request.signal),{headers:{
   "Content-Type":"application/json; charset=utf-8",
   "Content-Disposition":`attachment; filename="researchhub-scholar-dados-${new Date().toISOString().slice(0,10)}.json"`,
   "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
  }});
 }catch{return NextResponse.json({error:"Não foi possível exportar os dados agora."},{status:500});}
}
