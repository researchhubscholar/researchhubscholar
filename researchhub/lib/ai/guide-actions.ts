import type { GuideSnapshot } from "./guide";
export type GuideActionId="prepare"|"participants"|"import"|"visits"|"analysis"|"review";
export type GuideAction={id:GuideActionId;label:string;reason:string;stage:number;source?:"clinical"|"csv";visits:boolean};
export function guideActions(s:GuideSnapshot):GuideAction[]{
 const actions:GuideAction[]=[{id:"prepare",label:"Preparar ficha com apoio da IA",reason:"Abra a revisão da ficha, descreva o estudo e escolha as sugestões que deseja adicionar.",stage:0,source:"clinical",visits:false}];
 if(s.collection){actions.push({id:"participants",label:s.pending?"Conferir participantes pendentes":"Adicionar e conferir participantes",reason:s.pending?`Há ${s.pending} registros pendentes. Confira os dados e a elegibilidade antes de incluir.`:"Abra os dados iniciais dos participantes.",stage:1,visits:false});if(s.included>0)actions.push({id:"visits",label:"Conferir visitas e medidas",reason:"Revise o acompanhamento dos participantes incluídos.",stage:1,visits:true});}
 else actions.push({id:"import",label:"Importar ou conferir planilha",reason:"Abra a importação e confira os dados do CSV.",stage:1,source:"csv",visits:false});
 if(s.rows>0)actions.push({id:"analysis",label:"Escolher a pergunta de análise",reason:"Escolha o caminho conforme sua pergunta e seu protocolo.",stage:2,visits:false},{id:"review",label:"Revisar tabelas e resultados",reason:"Confira as estimativas, tabelas e gráficos antes de usar no trabalho.",stage:3,visits:false});
 return actions;
}
export function nextGuideAction(s:GuideSnapshot,source:"clinical"|"csv"):GuideAction{
 const actions=guideActions(s);
 const id:GuideActionId=!s.collection&&!s.rows?(source==="csv"?"import":"prepare"):s.collection&&!s.fields.length?"prepare":s.collection&&(s.pending>0||s.included===0)?"participants":s.collection&&s.included>0&&s.visits.pending>0?"visits":s.rows>0?(s.analyses.some(a=>a.status==="ready")&&!s.analyses.some(a=>a.status==="pending")?"review":"analysis"):s.collection?"participants":"import";
 return actions.find(a=>a.id===id)||actions[0];
}
