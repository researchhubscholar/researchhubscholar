import { NextRequest, NextResponse } from "next/server";
import { analyzeLiterature } from "@/lib/literature/analyze";
import { buildSearchStrategy, sanitizeTranslations, type SearchInput } from "@/lib/literature/query-strategy";
import { searchLimits } from "@/lib/literature/search-limits";
import { officialTerminologySuggestions } from "@/lib/literature/terminology";
import { resolveDecsTerms } from "@/lib/literature/decs";
import {recordProviderEvent} from "@/lib/operations/provider-events";
export const maxDuration = 180;
export async function POST(request: NextRequest) {
 try {
 const raw=await request.text();if(raw.length>80000)return NextResponse.json({error:"Solicitação de busca muito extensa."},{status:413});
 const body=JSON.parse(raw); const topic=String(body?.topic??"").trim();
 const period=body.period??"5", studyType=body.studyType??"all";
 const language=["auto","pt","en"].includes(body.language)?body.language:"auto";
 if(topic.length<3||topic.length>searchLimits.query)return NextResponse.json({error:`A consulta deve ter entre 3 e ${searchLimits.query} caracteres.`},{status:400});
 if(!["all","3","5","10"].includes(period)||!["all","systematic","trial","observational","review","case"].includes(studyType))return NextResponse.json({error:"Confira o tema e os filtros."},{status:400});
 const operator=body.operator==="OR"?"OR":"AND";
 const input: SearchInput={topic,mesh:String(body.mesh??"").trim(),population:String(body.populationTerm??"").trim(),outcome:String(body.outcomeTerm??"").trim(),operator,language,translations:sanitizeTranslations(body.translations)};
 if([input.mesh,input.population,input.outcome].some(value=>(value?.length||0)>searchLimits.field))return NextResponse.json({error:`Cada campo avançado aceita até ${searchLimits.field} caracteres.`},{status:400});
 const preliminary=buildSearchStrategy(input);
 // Opt-in only: untouched production behavior until preview/API tests succeed.
 let decsResolutions: Awaited<ReturnType<typeof resolveDecsTerms>>["resolutions"] = [];
 if (process.env.SCHOLAR_DECS_AUTO_REFINE === "true"
   && preliminary.mode === "interpreted" && preliminary.language === "pt"
   && preliminary.unresolvedTerms.length > 0) {
   const resolved = await resolveDecsTerms(
     preliminary.unresolvedTerms.filter(term => !Object.hasOwn(input.translations || {}, term)),
     {onAttempt:async event => recordProviderEvent({service:"decs",outcome:event.outcome,status_code:event.statusCode,duration_ms:event.durationMs})},
   );
   input.translations = { ...resolved.translations, ...input.translations };
   decsResolutions = resolved.resolutions.filter(item => input.translations?.[item.source] === item.english);
 }
 const strategy=decsResolutions.length ? buildSearchStrategy(input) : preliminary;
 const review = (suggestions: Record<string, string[]>, unresolvedTerms: string[]) =>
   NextResponse.json({error:"Confirme os conceitos que ainda não foram reconhecidos.",code:"TERMINOLOGY_REVIEW_REQUIRED",
     strategy:{...strategy,suggestions:{...suggestions,...strategy.suggestions},unresolvedTerms}},{status:422});
 const lookupTerms = () => officialTerminologySuggestions(strategy.unresolvedTerms.filter(term => !strategy.suggestions?.[term]), input.translations ?? {});
 if(strategy.requiresReview)return review(await lookupTerms(),strategy.unresolvedTerms);
 const result=await analyzeLiterature(input,period,studyType);
 if(strategy.mode==="interpreted" && result.sources?.pubmed.total===0 && strategy.unresolvedTerms.length){
   const suggestions=await lookupTerms();
   if(Object.keys(suggestions).length)return review(suggestions,Object.keys(suggestions));
 }
 return NextResponse.json({...result, terminology:{source:decsResolutions.length ? "DeCS" : "none", verified:decsResolutions, automatic:decsResolutions.length>0}});
 }catch{return NextResponse.json({error:"Não foi possível consultar o PubMed agora. Tente novamente."},{status:502});}
}
