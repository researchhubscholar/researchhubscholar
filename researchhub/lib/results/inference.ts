import { jStat } from "../../vendor/jstat";
import { numeric, type Dataset } from "./data";
export type AnalysisConfig = { kind: "welch" | "pearson" | "chi2"; x: string; y: string; independent: boolean };
export type AnalysisResult = { method: string; columns: string[]; n: number; excluded: number; statistic: number; df: number; p: number; effect: string; estimate: number; ci: [number, number] | null; details: string[]; table?: (string | number)[][] };
const mean = (x: number[]) => x.reduce((a,b)=>a+b,0)/x.length;
const variance = (x: number[]) => { const m=mean(x); return x.reduce((a,b)=>a+(b-m)**2,0)/(x.length-1); };
const probability = (p: number) => Math.max(0,Math.min(1,p));
export function analyze(dataset: Dataset, config: AnalysisConfig): AnalysisResult {
  if (!config.independent) throw new Error("Confirme a independência das observações. Este bloco não analisa dados pareados ou medidas repetidas.");
  const xi=dataset.columns.indexOf(config.x), yi=dataset.columns.indexOf(config.y);
  if(xi<0||yi<0||xi===yi)throw new Error("Escolha duas variáveis diferentes.");
  const rows=dataset.rows.filter(row=>row[xi].trim()&&row[yi].trim());
  const base={columns:[config.x,config.y],n:rows.length,excluded:dataset.rows.length-rows.length};
  if(config.kind==='chi2'){
    const xs=[...new Set(rows.map(r=>r[xi].trim()))],ys=[...new Set(rows.map(r=>r[yi].trim()))];
    if(xs.length<2||ys.length<2||xs.length>12||ys.length>12)throw new Error("Use duas variáveis categóricas com 2 a 12 categorias cada.");
    const cells=xs.map(x=>ys.map(y=>rows.filter(r=>r[xi].trim()===x&&r[yi].trim()===y).length));
    const rt=cells.map(r=>r.reduce((a,b)=>a+b,0)),ct=ys.map((_,j)=>cells.reduce((a,r)=>a+r[j],0));
    let statistic=0;
    for(let i=0;i<xs.length;i++)for(let j=0;j<ys.length;j++){const expected=rt[i]*ct[j]/rows.length;if(expected<5)throw new Error("Há frequências esperadas menores que 5. O qui-quadrado foi bloqueado; considere um teste exato com apoio estatístico.");statistic+=(cells[i][j]-expected)**2/expected;}
    const df=(xs.length-1)*(ys.length-1);
    return {...base,method:"Qui-quadrado de Pearson · sem correção de Yates",statistic,df,p:probability(1-jStat.chisquare.cdf(statistic,df)),effect:"V de Cramér",estimate:Math.sqrt(statistic/(rows.length*Math.min(xs.length-1,ys.length-1))),ci:null,details:["Teste de associação; não demonstra causalidade.","Intervalo de confiança do V de Cramér não disponível nesta versão."],table:[[config.x+' / '+config.y,...ys],...xs.map((x,i)=>[x,...cells[i]])]};
  }
  const asNumber=(value:string)=>{const n=numeric(value);if(n===null)throw new Error("Há texto não numérico em uma variável quantitativa. Corrija a planilha; somente células vazias são excluídas.");return n;};
  const x=rows.map(r=>asNumber(r[xi]));
  if(config.kind==='welch'){
    const groups=[...new Set(rows.map(r=>r[yi].trim()))];
    if(groups.length!==2)throw new Error("A variável de grupo deve ter exatamente duas categorias.");
    const a=x.filter((_,i)=>rows[i][yi].trim()===groups[0]),b=x.filter((_,i)=>rows[i][yi].trim()===groups[1]);
    if(a.length<3||b.length<3)throw new Error("Inclua pelo menos três observações válidas em cada grupo.");
    const va=variance(a)/a.length,vb=variance(b)/b.length,se=Math.sqrt(va+vb),estimate=mean(a)-mean(b);
    if(!Number.isFinite(se)||se===0)throw new Error("Não há variabilidade suficiente para estimar a comparação.");
    const df=(va+vb)**2/(va**2/(a.length-1)+vb**2/(b.length-1)),statistic=estimate/se,critical=jStat.studentt.inv(.975,df);
    return {...base,method:"Teste t de Welch · bilateral",statistic,df,p:probability(2*jStat.studentt.cdf(-Math.abs(statistic),df)),effect:`Diferença de médias (${groups[0]} − ${groups[1]})`,estimate,ci:[estimate-critical*se,estimate+critical*se],details:[`${groups[0]}: n=${a.length}, média=${mean(a).toPrecision(6)}. ${groups[1]}: n=${b.length}, média=${mean(b).toPrecision(6)}.`,"Não exige variâncias iguais. Normalidade aproximada, assimetria e valores extremos devem ser avaliados, especialmente em amostras pequenas."],table:[["Grupo","N","Média","DP amostral"],[groups[0],a.length,mean(a),Math.sqrt(variance(a))],[groups[1],b.length,mean(b),Math.sqrt(variance(b))]]};
  }
  const y=rows.map(r=>asNumber(r[yi]));
  if(x.length<4)throw new Error("Inclua ao menos quatro pares completos para a correlação e seu intervalo.");
  const mx=mean(x),my=mean(y),sx=Math.sqrt(x.reduce((s,v)=>s+(v-mx)**2,0)),sy=Math.sqrt(y.reduce((s,v)=>s+(v-my)**2,0));
  if(!Number.isFinite(sx)||!Number.isFinite(sy)||sx===0||sy===0||sx<1e-13*Math.abs(mx)||sy<1e-13*Math.abs(my))throw new Error("Uma variável é constante ou quase constante; a correlação não é confiável.");
  const r=Math.max(-1,Math.min(1,x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0)/(sx*sy))),df=x.length-2;
  const perfect=Math.abs(r)===1,statistic=perfect?0:r*Math.sqrt(df/(1-r*r));
  const z=perfect?0:Math.atanh(r),margin=1.959963984540054/Math.sqrt(x.length-3);
  return {...base,method:"Correlação de Pearson · bilateral",statistic:r,df,p:perfect?0:probability(2*jStat.studentt.cdf(-Math.abs(statistic),df)),effect:"Coeficiente r de Pearson",estimate:r,ci:perfect?[r,r]:[Math.tanh(z-margin),Math.tanh(z+margin)],details:["IC de 95% pela transformação de Fisher (aproximado).","Pressupõe relação linear e observações independentes; a inferência pressupõe normalidade bivariada. Revise valores extremos. Correlação não demonstra causalidade."]};
}
export function analysisRows(result: AnalysisResult) {
  return [["Motor","Scholar inference v1 · jStat 1.9.6"],["Método",result.method],["Variável 1",result.columns[0]],["Variável 2",result.columns[1]],["N completo",result.n],["Linhas excluídas por dados ausentes",result.excluded],["Estatística",result.statistic],["Graus de liberdade",result.df],["p bilateral (associação no qui-quadrado)",result.p],[result.effect,result.estimate],["IC95% inferior",result.ci?.[0]??"Não disponível"],["IC95% superior",result.ci?.[1]??"Não disponível"],...result.details.map(d=>["Observação",d])];
}
