import { NextRequest, NextResponse } from "next/server";
import { analyzeLiterature } from "@/lib/literature/analyze";
export async function POST(request: NextRequest) {
 try {
 const body=await request.json(); const topic=String(body?.topic??"").trim();
 const period=body.period??"5", studyType=body.studyType??"all";
 const language=["auto","pt","en"].includes(body.language)?body.language:"auto";
 if(topic.length<3||topic.length>500||!["all","3","5","10"].includes(period)||!["all","systematic","trial","observational","review","case"].includes(studyType))return NextResponse.json({error:"Confira o tema e os filtros."},{status:400});
 const operator=body.operator==="OR"?"OR":"AND";
 return NextResponse.json(await analyzeLiterature({topic,mesh:String(body.mesh??"").trim(),population:String(body.populationTerm??"").trim(),outcome:String(body.outcomeTerm??"").trim(),operator,language},period,studyType));
 }catch{return NextResponse.json({error:"Não foi possível consultar o PubMed agora. Tente novamente."},{status:502});}
}
