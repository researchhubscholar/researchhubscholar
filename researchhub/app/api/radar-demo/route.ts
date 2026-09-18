import {NextRequest,NextResponse} from "next/server";
import {unstable_cache} from "next/cache";
import {analyzeLiterature} from "@/lib/literature/analyze";
import {publicClient,visitorHash,validTopic} from "@/lib/public/client";
export const runtime="nodejs";
export const maxDuration=60;
const cached=unstable_cache(async(topic:string)=>analyzeLiterature(topic,"5","all",10),["scholar-radar-demo-v1"],{revalidate:3600});
export async function POST(request:NextRequest){
 try{
  const raw=await request.text();if(raw.length>2000)return NextResponse.json({error:"Solicitação muito grande."},{status:413});
  let body;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:"Solicitação inválida."},{status:400});}
  if(!validTopic(body?.topic))return NextResponse.json({error:"Informe um tema entre 3 e 300 caracteres."},{status:400});
  const client=publicClient();const {data,error}=await client.rpc("scholar_public_quota",{p_key:visitorHash(request.headers),p_kind:"radar"});
  if(error)return NextResponse.json({error:"O Radar demonstrativo está sendo preparado. Tente novamente em breve."},{status:503});
  if(data<0)return NextResponse.json({error:"Você atingiu o limite de três buscas públicas de hoje. Crie uma conta para continuar no seu espaço.",limit:true},{status:429});
  const result=await cached(body.topic.trim().replace(/\s+/g," ").toLowerCase());
  return NextResponse.json({...result,remaining:data,demo:true});
 }catch{
  return NextResponse.json({error:"Não foi possível consultar a base agora. Tente novamente mais tarde."},{status:502});
 }
}
