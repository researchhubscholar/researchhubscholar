import type { ResultsWorkspace } from "./data";
import { analyze } from "./inference";
import { comparisonData } from "../clinical/comparison";
import { pairedData, pairedTest } from "../clinical/paired";
import { repeatedData, repeatedTest } from "../clinical/repeated";
import { adjustedData, adjustedTest } from "../clinical/adjusted";
import { generalReading, pairedReading, repeatedReading, adjustedReading, type Reading } from "./reading";
export function workspaceReadings(w: ResultsWorkspace) {
 const results: { title:string; reading?:Reading; pending?:string }[]=[];
 const add=(title:string,run:()=>Reading)=>{try{results.push({title,reading:run()});}catch(e){results.push({title,pending:e instanceof Error?e.message:"Revise esta análise na etapa Responder à pergunta."});}};
 if(w.analysis)add("Análise geral da base",()=>generalReading(analyze(w.dataset,w.analysis!),w.analysis!.kind));
 if(w.collection){const c=w.collection;
  if(w.comparison?.analysis)add("Comparação entre grupos",()=>generalReading(analyze(comparisonData(c,w.comparison!).dataset,w.comparison!.analysis!),w.comparison!.analysis!.kind));
  if(w.followup&&w.paired)add("Antes e depois",()=>{const d=pairedData(c,w.followup!,w.paired!);return pairedReading(d,pairedTest(d,w.paired!));});
  if(w.followup&&w.repeated)add("Vários momentos",()=>{const d=repeatedData(c,w.followup!,w.repeated!);return repeatedReading(d,repeatedTest(d,w.repeated!));});
  if(w.adjusted)add("Considerando outras características",()=>{const d=adjustedData(c,w.adjusted!);return adjustedReading(d,adjustedTest(d,w.adjusted!));});
 }
 return results;
}
