import type { Locale } from "../i18n/locale";
import { statCopy } from "../i18n/statistics-copy";
import type { ResultsWorkspace } from "./data";
import { analyze } from "./inference";
import { comparisonData } from "../clinical/comparison";
import { pairedData, pairedTest } from "../clinical/paired";
import { repeatedData, repeatedTest } from "../clinical/repeated";
import { adjustedData, adjustedTest } from "../clinical/adjusted";
import { generalReading, pairedReading, repeatedReading, adjustedReading, type Reading } from "./reading";
export function workspaceReadings(w: ResultsWorkspace, locale:Locale="pt-BR") {
const copy=(source:string)=>statCopy(locale,source);
 const results: { title:string; reading?:Reading; pending?:string }[]=[];
 const add=(title:string,run:()=>Reading)=>{try{results.push({title,reading:run()});}catch(e){results.push({title,pending:e instanceof Error?copy(e.message):copy("Revise esta análise na etapa Responder à pergunta.")});}};
 if(w.analysis)add(copy("Análise geral da base"),()=>generalReading(analyze(w.dataset,w.analysis!),w.analysis!.kind,locale));
 if(w.collection){const c=w.collection;
  if(w.comparison?.analysis)add(copy("Comparação entre grupos"),()=>generalReading(analyze(comparisonData(c,w.comparison!,locale).dataset,w.comparison!.analysis!),w.comparison!.analysis!.kind,locale));
  if(w.followup&&w.paired)add(copy("Antes e depois"),()=>{const d=pairedData(c,w.followup!,w.paired!,locale);return pairedReading(d,pairedTest(d,w.paired!),locale);});
  if(w.followup&&w.repeated)add(copy("Vários momentos"),()=>{const d=repeatedData(c,w.followup!,w.repeated!,locale);return repeatedReading(d,repeatedTest(d,w.repeated!),locale);});
  if(w.adjusted)add(copy("Considerando outras características"),()=>{const d=adjustedData(c,w.adjusted!,locale);return adjustedReading(d,adjustedTest(d,w.adjusted!),locale);});
 }
 return results;
}
