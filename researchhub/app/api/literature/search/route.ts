import { NextRequest, NextResponse } from "next/server";
import { analyzeLiterature } from "@/lib/literature/analyze";
export async function POST(request: NextRequest) {
 try {
 const body=await request.json(); const topic=String(body?.topic??"").trim();
 const period=body.period??"5", studyType=body.studyType??"all";
 if(topic.length<3||topic.length>500||!["all","3","5","10"].includes(period)||!["all","systematic","trial","observational","review","case"].includes(studyType))return NextResponse.json({error:"Confira o tema e os filtros."},{status:400});
 return NextResponse.json(await analyzeLiterature(topic,period,studyType));
 }catch{return NextResponse.json({error:"Não foi possível consultar o PubMed agora. Tente novamente."},{status:502});}
}
