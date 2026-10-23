import { jStat } from "../../vendor/jstat";
import { numeric } from "../results/data";
import type { ClinicalCollection } from "./collection";
export type AdjustedConfig={outcome:string;predictors:{key:string;reference:string}[];confirmed:boolean};
export function validAdjusted(value:unknown,collection?:ClinicalCollection):value is AdjustedConfig{
 if(!value||typeof value!=="object"||!collection)return false;const c=value as AdjustedConfig;
 if(typeof c.confirmed!=="boolean"||!collection.fields.some(f=>f.key===c.outcome&&f.kind==="number")||!Array.isArray(c.predictors)||c.predictors.length<1||c.predictors.length>3||new Set(c.predictors.map(p=>p?.key)).size!==c.predictors.length)return false;
 let parameters=1;
 return c.predictors.every(p=>{if(!p||p.key===c.outcome||typeof p.reference!=="string")return false;const f=collection.fields.find(f=>f.key===p.key);if(f?.kind==="number"&&p.reference===""){parameters++;return parameters<=8;}if(f?.kind==="category"&&f.options.length>=2&&f.options.length<=4&&f.options.includes(p.reference)){parameters+=f.options.length-1;return parameters<=8;}return false;});
}
export function adjustedData(collection:ClinicalCollection,config:AdjustedConfig){
 if(!validAdjusted(config,collection))throw new Error("Escolha um desfecho numérico e de uma a três variáveis de ajuste compatíveis, com referências categóricas válidas.");
 const outcome=collection.fields.find(f=>f.key===config.outcome)!;
 const predictors=config.predictors.map(p=>({field:collection.fields.find(f=>f.key===p.key)!,reference:p.reference}));
 const terms=[{label:"Intercepto",key:"",level:""},...predictors.flatMap(p=>p.field.kind==="number"?[{label:`${p.field.label}${p.field.unit?` (${p.field.unit})`:""} · por 1 unidade`,key:p.field.key,level:""}]:p.field.options.filter(o=>o!==p.reference).map(o=>({label:`${p.field.label}: ${o} versus ${p.reference}`,key:p.field.key,level:o})))];
 const counts={included:0,complete:0,outcomeMissing:0,predictorsMissing:0};
 const missing=[outcome,...predictors.map(p=>p.field)].map(f=>({label:f.label,key:f.key,n:0}));
 const subjects:{code:string;y:number;x:number[]}[]=[];
 for(const r of collection.records.filter(r=>r.status==="included")){
  counts.included++;for(const m of missing)if(!(r.values[m.key]||"").trim())m.n++;
  const rawY=(r.values[outcome.key]||"").trim();if(!rawY){counts.outcomeMissing++;continue;}
  if(predictors.some(p=>!(r.values[p.field.key]||"").trim())){counts.predictorsMissing++;continue;}
  const y=numeric(rawY);if(y===null)throw new Error("Há texto ou valor inválido no desfecho numérico. Confira a ficha inicial.");
  const x=[1,...terms.slice(1).map(t=>{const p=predictors.find(p=>p.field.key===t.key)!;const raw=r.values[t.key].trim();if(p.field.kind==="number"){const n=numeric(raw);if(n===null)throw new Error(`Valor numérico inválido em ${p.field.label}.`);return n;}if(!p.field.options.includes(raw))throw new Error(`Categoria não prevista em ${p.field.label}.`);return raw===t.level?1:0;})];
  subjects.push({code:r.code,y,x});counts.complete++;
 }
 const selection:(string|number)[][]=[["Situação","Participantes"],["Incluídos na ficha inicial",counts.included],["Completos no desfecho e em todas as variáveis de ajuste",counts.complete],["Fora por desfecho vazio",counts.outcomeMissing],["Fora por ajuste vazio, entre os que têm desfecho",counts.predictorsMissing]];
 const dictionary:(string|number)[][]=[["Papel","Variável","Tipo","Unidade / referência"],["Desfecho",outcome.label,"Numérica",outcome.unit],...predictors.map(p=>["Ajuste",p.field.label,p.field.kind==="number"?"Numérica":"Categórica",p.field.kind==="number"?p.field.unit:`Referência: ${p.reference}`])];
 return{outcome,predictors,terms,subjects,counts,selection,dictionary,missingRows:[["Variável","Ausentes entre incluídos"],...missing.map(m=>[m.label,m.n])] as (string|number)[][]};
}
const mean=(v:number[])=>v.reduce((s,x)=>s+x/v.length,0);
const dot=(a:number[],b:number[])=>a.reduce((s,x,i)=>s+x*b[i],0);
export function fitAdjusted(data:ReturnType<typeof adjustedData>){
 const n=data.subjects.length,p=data.terms.length,minimum=Math.max(20,5*p);
 if(n<minimum)throw new Error(`Esta versão exige ao menos ${minimum} participantes completos para ${p} coeficientes, incluindo o intercepto. É um limite operacional, não uma análise de poder.`);
 for(const predictor of data.predictors)if(predictor.field.kind==="category")for(const option of predictor.field.options)if(!data.subjects.some(s=>{const terms=data.terms.map((t,i)=>({t,i})).filter(a=>a.t.key===predictor.field.key);return option===predictor.reference?terms.every(a=>s.x[a.i]===0):terms.some(a=>a.t.level===option&&s.x[a.i]===1);}))throw new Error(`${predictor.field.label}: a categoria ${option} não tem participantes completos. Revise a especificação; categorias não são removidas automaticamente.`);
 const columns=Array.from({length:p},(_,j)=>data.subjects.map(s=>s.x[j]));
 const centers=columns.map((c,j)=>j?mean(c):0),scales=columns.map((c,j)=>j?Math.sqrt(c.reduce((sum,v)=>sum+(v-centers[j])**2,0)/(n-1)):1);
 if(scales.some((s,j)=>!Number.isFinite(s)||s<=0||j>0&&s<1e-13*Math.abs(centers[j])))throw new Error("Há uma variável constante, quase constante ou fora da precisão numérica. Revise as variáveis de ajuste.");
 const y=data.subjects.map(s=>s.y),yMean=mean(y),yScale=Math.sqrt(y.reduce((sum,v)=>sum+(v-yMean)**2,0)/(n-1));
 if(!Number.isFinite(yMean)||!Number.isFinite(yScale)||yScale<=0||yScale<1e-13*Math.abs(yMean))throw new Error("O desfecho é constante, quase constante ou excede a precisão numérica.");
 const normalized=columns.map((c,j)=>c.map(v=>(v-centers[j])/scales[j]));
 const q:number[][]=[],r=Array.from({length:p},()=>Array(p).fill(0) as number[]);
 // Modified Gram-Schmidt with a second orthogonalization pass, on centered/scaled columns.
 for(let j=0;j<p;j++){const v=[...normalized[j]];for(let pass=0;pass<2;pass++)for(let i=0;i<j;i++){const projection=dot(q[i],v);r[i][j]+=projection;for(let row=0;row<n;row++)v[row]-=projection*q[i][row];}r[j][j]=Math.sqrt(dot(v,v));if(!Number.isFinite(r[j][j])||r[j][j]<1e-8*Math.sqrt(n))throw new Error("As variáveis são colineares ou quase redundantes. Remova ajustes duplicados ou relacionados por combinação linear.");q.push(v.map(x=>x/r[j][j]));}
 const solve=(b:number[])=>{const result=Array(p).fill(0) as number[];for(let i=p-1;i>=0;i--)result[i]=(b[i]-r[i].slice(i+1).reduce((s,v,j)=>s+v*result[i+j+1],0))/r[i][i];return result;};
 const inverse=Array.from({length:p},()=>Array(p).fill(0) as number[]);for(let j=0;j<p;j++){const b=Array(p).fill(0);b[j]=1;const solution=solve(b);for(let i=0;i<p;i++)inverse[i][j]=solution[i];}
 const norm=(m:number[][])=>Math.max(...Array.from({length:p},(_,j)=>m.reduce((s,row)=>s+Math.abs(row[j]),0)));
 const condition=norm(r)*norm(inverse);if(!Number.isFinite(condition)||condition>1e6)throw new Error("O modelo está numericamente mal condicionado. Revise escalas e variáveis redundantes antes de continuar.");
 const yn=y.map(v=>(v-yMean)/yScale),beta=solve(q.map(col=>dot(col,yn)));
 const fitted=Array.from({length:n},(_,i)=>normalized.reduce((sum,col,j)=>sum+col[i]*beta[j],0));
 const residual=yn.map((v,i)=>v-fitted[i]),sse=dot(residual,residual),sst=dot(yn,yn),df=n-p;
 if(!Number.isFinite(sse)||sse<=1e-14*sst)throw new Error("A variabilidade residual é nula ou pequena demais para calcular erros-padrão e intervalos confiáveis.");
 const covariance=Array.from({length:p},(_,i)=>Array.from({length:p},(_,j)=>dot(inverse[i],inverse[j])*(sse/df)));
 const transform=Array.from({length:p},(_,i)=>Array.from({length:p},(_,j)=>i===0?(j===0?1:-centers[j]/scales[j]):i===j?1/scales[i]:0));
 const estimates=beta.map((_,i)=>yScale*dot(transform[i],beta)+(i===0?yMean:0));
 const se=transform.map(row=>{const variance=row.reduce((sum,a,i)=>sum+a*covariance[i].reduce((s,b,j)=>s+b*row[j],0),0);return yScale*Math.sqrt(Math.max(0,variance));});
 const critical=jStat.studentt.inv(.975,df);
 const coefficients=estimates.map((estimate,i)=>{const statistic=estimate/se[i],probability=Math.max(0,Math.min(1,2*jStat.studentt.cdf(-Math.abs(statistic),df))),ci:[number,number]=[estimate-critical*se[i],estimate+critical*se[i]];if(se[i]<=0||![estimate,se[i],statistic,probability,...ci].every(Number.isFinite))throw new Error("Um coeficiente ou intervalo excedeu a precisão numérica. Revise a escala dos dados.");return{label:data.terms[i].label,estimate,se:se[i],statistic,p:probability,ci};});
 const diagnostics=data.subjects.map((s,i)=>{const leverage=q.reduce((sum,col)=>sum+col[i]**2,0),cooks=(residual[i]**2/(p*(sse/df)))*leverage/((1-leverage)**2);if(!Number.isFinite(leverage)||leverage>=1-1e-10||!Number.isFinite(cooks))throw new Error("Há observação com alavancagem extrema. O diagnóstico e a inferência foram bloqueados.");return{code:s.code,observed:s.y,fitted:yMean+yScale*fitted[i],residual:yScale*residual[i],leverage,cooks};});
 if(diagnostics.some(d=>![d.observed,d.fitted,d.residual,d.leverage,d.cooks].every(Number.isFinite)))throw new Error("Os diagnósticos excedem a precisão numérica disponível.");
 const r2=1-sse/sst,adjustedR2=1-(1-r2)*(n-1)/df,rmse=yScale*Math.sqrt(sse/df);
 if(![r2,adjustedR2,rmse].every(Number.isFinite))throw new Error("O resumo do ajuste excede a precisão numérica.");
 return{n,p,df,condition,r2,adjustedR2,rmse,coefficients,diagnostics,influential:diagnostics.filter(d=>d.cooks>4/n).length,highLeverage:diagnostics.filter(d=>d.leverage>2*p/n).length};
}
export function adjustedTest(data:ReturnType<typeof adjustedData>,config:AdjustedConfig){if(!config.confirmed)throw new Error("Confirme a especificação, a independência e a revisão dos pressupostos e resíduos antes de apresentar a inferência.");return fitAdjusted(data);}
export const adjustedNote="Regressão linear por mínimos quadrados, com intercepto, uma observação inicial por participante e casos completos em todas as variáveis escolhidas. Os coeficientes numéricos representam diferença no desfecho por 1 unidade do ajuste; os categóricos, diferença em relação à referência, mantendo os demais ajustes constantes. Erros-padrão clássicos, IC95% e p bilateral pela distribuição t: exigem revisão de linearidade, independência entre participantes, homoscedasticidade, normalidade aproximada dos resíduos para inferência e observações influentes. Os limiares de Cook (4/N) e alavancagem (2p/N) são sinais de conferência, não justificam exclusão automática. Não há seleção automática de confundidores, imputação, interações, inferência robusta, ajuste por multiplicidade, validação preditiva ou análise longitudinal nesta etapa. Associação ajustada não demonstra causalidade; viés por perdas e confundimento residual podem permanecer.";
export function adjustedCoefficientRows(result:ReturnType<typeof fitAdjusted>):(string|number)[][]{return[["Termo","Coeficiente ajustado","Erro-padrão clássico","IC95% inferior","IC95% superior","p bilateral"],...result.coefficients.map(c=>[c.label,c.estimate,c.se,c.ci[0],c.ci[1],c.p])];}
export function adjustedSummaryRows(r:ReturnType<typeof fitAdjusted>):(string|number)[][]{return[["Medida","Valor"],["Motor","Scholar adjusted v1 · QR · jStat 1.9.6"],["Método","Regressão linear · erros-padrão clássicos"],["Participantes completos",r.n],["Coeficientes incluindo intercepto",r.p],["GL residuais",r.df],["R²",r.r2],["R² ajustado",r.adjustedR2],["Erro residual · unidade do desfecho",r.rmse],["Estimativa de condicionamento · matriz padronizada",r.condition],["Sinais de influência · Cook > 4/N",r.influential],["Sinais de alavancagem · h > 2p/N",r.highLeverage]];}
export function adjustedNarrative(data:ReturnType<typeof adjustedData>,r:ReturnType<typeof fitAdjusted>){const fmt=(n:number)=>n.toLocaleString("pt-BR",{maximumSignificantDigits:4});return `Foi ajustada regressão linear para ${data.outcome.label}${data.outcome.unit?` (${data.outcome.unit})`:""}, incluindo ${data.predictors.map(p=>p.field.label+(p.field.kind==="category"?` (referência: ${p.reference})`:"")).join(", ")}. Foram analisados ${r.n} participantes completos; ${data.counts.included-r.n} incluídos ficaram fora por ausência no desfecho ou ajustes. R² ajustado = ${fmt(r.adjustedR2)}. Os coeficientes e IC95% são apresentados na tabela. Revise pressupostos, perdas, especificação e relevância clínica. As associações ajustadas não estabelecem causalidade nem validam previsões individuais.`;}
export function adjustedWorkbook(collection:ClinicalCollection,config:AdjustedConfig){const d=adjustedData(collection,config);const sheets=[{name:"Seleção modelo ajustado",rows:d.selection},{name:"Variáveis do modelo",rows:d.dictionary},{name:"Ausências modelo ajustado",rows:[...d.missingRows,["As ausências por variável podem se sobrepor; não somar para obter exclusões."]]}];try{const r=adjustedTest(d,config);sheets.push({name:"Regressão ajustada",rows:[...adjustedCoefficientRows(r),[adjustedNote]]},{name:"Resumo modelo ajustado",rows:[...adjustedSummaryRows(r),["Texto para revisão",adjustedNarrative(d,r)]]});}catch(e){sheets.push({name:"Regressão ajustada",rows:[["Inferência não calculada",e instanceof Error?e.message:"Revise o modelo."]]});}return sheets;}
