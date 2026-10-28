import type { ResultsWorkspace } from "../results/data";
import { recordIssues, schemaIssues } from "../clinical/collection";
import { workspaceReadings } from "../results/review";
export function workflowHelp(w:ResultsWorkspace){
 const c=w.collection,records=c?.records||[],included=records.filter(r=>r.status==='included');
 const invalid=c?records.filter(r=>r.status!=='excluded'&&recordIssues(c,r).length>0).length:0;
 const checks=[{label:"Participantes aguardando conferência",count:records.filter(r=>r.status==='pending').length},{label:"Registros ativos com campos ou valores a conferir",count:invalid},{label:"Visitas em rascunho",count:w.followup?.visits.filter(v=>v.status==='draft').length||0}];
 const missing=c?c.fields.map(f=>({label:f.label,count:included.filter(r=>!r.values[f.key]?.trim()).length})).filter(f=>f.count):[];
 const fields=c?.fields||[],numbers=fields.filter(f=>f.kind==='number').length,categories=fields.filter(f=>f.kind==='category').length,moments=w.followup?.moments.length||0;
 const paths=[{id:"profile",label:"Descrever o perfil",reason:"Resumir as características dos participantes ou das observações.",available:w.dataset.rows.length>0},
 {id:"groups",label:"Comparar grupos",reason:"Uma medida numérica e uma variável de grupos; confira grupos independentes e tamanhos.",available:Boolean(c&&numbers&&categories)},
 {id:"paired",label:"Comparar antes e depois",reason:"Uma medida numérica nas mesmas pessoas em dois momentos.",available:Boolean(c&&numbers&&moments>=2)},
 {id:"repeated",label:"Comparar vários momentos",reason:"Uma medida numérica nas mesmas pessoas em três ou mais momentos.",available:Boolean(c&&numbers&&moments>=3)},
 {id:"adjusted",label:"Considerar outras características",reason:"Um desfecho numérico e outras características previstas no protocolo.",available:Boolean(c&&numbers&&fields.length>=2)},
 {id:"general",label:"Outra diferença ou associação",reason:"Abra a configuração para conferir colunas, desenho e condições do teste.",available:w.dataset.rows.length>0}];
 const readings=workspaceReadings(w),confirmed=readings.filter(r=>r.reading);
 const draft=confirmed.map(r=>{const x=r.reading!;return [r.title,x.summary,...x.facts.map(f=>`${f.label}: ${f.value}.`),...(x.coefficients||[]).map(f=>`${f.label}: ${f.value}.`)].join('\n');}).join('\n\n');
 return {checks,missing,schema:c?schemaIssues(c):[],paths,draft,pendingAnalyses:readings.filter(r=>!r.reading).length,cautions:confirmed.map(r=>r.reading!.caution)};
}
