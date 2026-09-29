import { NextRequest, NextResponse } from "next/server";
import { analyzeLiterature } from "@/lib/literature/analyze";
import { buildSearchStrategy, sanitizeTranslations, type SearchInput } from "@/lib/literature/query-strategy";
export async function POST(request: NextRequest) {
 try {
 const body=await request.json(); const topic=String(body?.topic??"").trim();
 const period=body.period??"5", studyType=body.studyType??"all";
 const language=["auto","pt","en"].includes(body.language)?body.language:"auto";
 if(topic.length<3||topic.length>500||!["all","3","5","10"].includes(period)||!["all","systematic","trial","observational","review","case"].includes(studyType))return NextResponse.json({error:"Confira o tema e os filtros."},{status:400});
 const operator=body.operator==="OR"?"OR":"AND";
 const input: SearchInput={topic,mesh:String(body.mesh??"").trim(),population:String(body.populationTerm??"").trim(),outcome:String(body.outcomeTerm??"").trim(),operator,language,translations:sanitizeTranslations(body.translations)};
 const strategy=buildSearchStrategy(input);
 if(strategy.requiresReview)return NextResponse.json({error:"Confirme os conceitos que ainda não foram reconhecidos.",code:"TERMINOLOGY_REVIEW_REQUIRED",strategy},{status:422});
 return NextResponse.json(await analyzeLiterature(input,period,studyType));
 }catch{return NextResponse.json({error:"Não foi possível consultar o PubMed agora. Tente novamente."},{status:502});}
}
