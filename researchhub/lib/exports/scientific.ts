import type { LibraryArticle, EvidenceNote } from "@/lib/literature/library-store";

const clean = (value: unknown) => String(value ?? "").replace(/\r?\n/g, " ").trim();
const csv = (value: unknown) => `"${clean(value).replaceAll('"', '""')}"`;
const esc = (value: unknown) => clean(value).replace(/[&<>]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]!));

export function buildCsv(articles: LibraryArticle[], notes: Record<string, EvidenceNote>) {
  const headings = ["Título","Autores","Ano","Periódico","PMID","DOI","Status","Pasta","Desenho","Tags","Objetivo","População","Método","Amostra","Intervenção","Comparador","Desfechos","Achado","Limitação","Nível de evidência","Risco de viés","Notas gerais"];
  const rows = articles.map(a => { const n=notes[a.id]||{}; return [a.title,a.authors.join("; "),a.year,a.journal,a.pmid,a.doi,a.readingStatus,a.folder,a.studyDesign,a.tags.join("; "),n.objective,n.population,n.method,n.sampleSize,n.intervention,n.comparator,n.outcomes,n.finding,n.limitation,n.evidenceLevel,n.riskOfBias,n.generalNotes].map(csv).join(","); });
  return `\uFEFF${headings.map(csv).join(",")}\n${rows.join("\n")}`;
}
export function buildRis(articles: LibraryArticle[]) { return articles.map(a => ["TY  - JOUR",`TI  - ${clean(a.title)}`,...a.authors.map(x=>`AU  - ${clean(x)}`),a.journal&&`JO  - ${clean(a.journal)}`,a.year&&`PY  - ${a.year}`,a.doi&&`DO  - ${clean(a.doi)}`,a.pmid&&`AN  - PMID:${clean(a.pmid)}`,a.abstract&&`AB  - ${clean(a.abstract)}`,"ER  - "].filter(Boolean).join("\n")).join("\n\n"); }
export function buildBibtex(articles: LibraryArticle[]) { return articles.map((a,i)=>{const key=`scholar${a.year||"nd"}_${i+1}`;return `@article{${key},\n  title = {${clean(a.title)}},\n  author = {${a.authors.map(clean).join(" and ")}},\n  journal = {${clean(a.journal)}},\n  year = {${a.year||""}},\n  doi = {${clean(a.doi)}},\n  pmid = {${clean(a.pmid)}}\n}`;}).join("\n\n"); }
export function buildProtocolDoc(title:string, sections:{title:string;fields:{label:string;value:string}[]}[]) { return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;line-height:1.55;margin:48px;color:#14213d}h1,h2{font-family:Georgia,serif}h2{border-bottom:1px solid #ccc;padding-bottom:8px;margin-top:28px}.field{margin:14px 0}.label{font-weight:bold;font-size:12px;text-transform:uppercase;color:#0f6e66}</style></head><body><h1>${esc(title||"Projeto sem título")}</h1><p>Rascunho de protocolo · ResearchHub Scholar</p>${sections.map(s=>`<h2>${esc(s.title)}</h2>${s.fields.map(f=>`<div class="field"><div class="label">${esc(f.label)}</div><div>${esc(f.value||"A definir")}</div></div>`).join("")}`).join("")}<p><small>Estrutura em desenvolvimento. Revise conteúdo, método e questões éticas com seu orientador.</small></p></body></html>`; }
export function download(content:string,type:string,filename:string){const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement("a");link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),0);}

export type DocumentProject = {
  id:string; title:string; theme:string; question:string; objective:string; hypothesis:string;
  studyType:string; population:string; inclusion:string; exclusion:string; outcome:string;
  variables:string; methods:string; analysis:string; ethics:string; manuscript:string;
  status:string; progress:number; updatedAt:string;
};
export type DocumentProfile = { name:string; institution:string; specialty:string; trainingStage:string };
export type DocumentMilestone = { key:string; label:string; status:string; note:string; dueDate:string };
export type ProjectDocumentData = {
  project:DocumentProject; profile:DocumentProfile; articles:LibraryArticle[];
  notes:Record<string,EvidenceNote>; milestones:DocumentMilestone[]; generatedAt:string;
};

const projectFields: { label:string; key:keyof DocumentProject }[] = [
  {label:"Tema",key:"theme"},{label:"Pergunta de pesquisa",key:"question"},{label:"Objetivo geral",key:"objective"},
  {label:"Hipótese ou pressuposto",key:"hypothesis"},{label:"Desenho do estudo",key:"studyType"},{label:"População",key:"population"},
  {label:"Critérios de inclusão",key:"inclusion"},{label:"Critérios de exclusão",key:"exclusion"},{label:"Desfecho principal",key:"outcome"},
  {label:"Variáveis e mensuração",key:"variables"},{label:"Procedimentos e coleta",key:"methods"},{label:"Plano de análise",key:"analysis"},
  {label:"Considerações éticas",key:"ethics"},{label:"Planejamento do manuscrito",key:"manuscript"},
];
const statusLabel = (value:string) => ({draft:"Rascunho",planning:"Planejamento",literature:"Revisão da literatura",methods:"Métodos",writing:"Escrita",completed:"Concluído",pending:"Pendente",current:"Em andamento",done:"Concluída",blocked:"Bloqueada"} as Record<string,string>)[value] || value || "Não informado";
const datePt = (value:string) => value ? new Date(`${value}${value.length===10?"T12:00:00Z":""}`).toLocaleDateString("pt-BR",{timeZone:"UTC"}) : "Sem prazo";
const field = (label:string,value:unknown) => `<div class="field"><div class="label">${esc(label)}</div><div>${esc(value||"A definir")}</div></div>`;
const section = (title:string,content:string) => `<h2>${esc(title)}</h2>${content}`;
function shell(title:string,subtitle:string,body:string,data:ProjectDocumentData) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:2.2cm}body{font-family:Arial,sans-serif;line-height:1.5;color:#14213d;font-size:11pt}h1,h2,h3{font-family:Georgia,serif}h1{font-size:25pt;margin:0 0 8px}h2{font-size:16pt;border-bottom:1px solid #cfd8d6;padding-bottom:7px;margin-top:27px}h3{font-size:12pt;margin-bottom:5px}.cover{padding:32px 0 42px;border-bottom:3px solid #0f6e66}.eyebrow,.label{font-weight:bold;font-size:8.5pt;text-transform:uppercase;letter-spacing:.06em;color:#0f6e66}.meta{color:#51606d}.field{margin:12px 0}.box{background:#eef8f6;border-left:4px solid #0f6e66;padding:12px 16px;margin:14px 0}.warning{background:#fff8e8;border-left-color:#b7791f}.grid{display:table;width:100%}.row{display:table-row}.cell{display:table-cell;width:50%;padding:5px 12px 5px 0;vertical-align:top}table{width:100%;border-collapse:collapse;font-size:9pt}th,td{border:1px solid #d6dfdd;text-align:left;vertical-align:top;padding:7px}th{background:#eef8f6}ol,ul{padding-left:22px}.footer{margin-top:35px;padding-top:12px;border-top:1px solid #d6dfdd;font-size:8.5pt;color:#64727d}.page-break{page-break-before:always}</style></head><body><div class="cover"><div class="eyebrow">ResearchHub Scholar · documento de apoio</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p><p class="meta">${esc(data.profile.name||"Autor não informado")}${data.profile.institution?` · ${esc(data.profile.institution)}`:""}<br>Gerado em ${esc(data.generatedAt)}</p></div>${body}<div class="footer">Documento gerado a partir dos registros do usuário. Revise conteúdo, referências, método e exigências institucionais com o orientador antes de utilizar ou submeter.</div></body></html>`;
}
function references(data:ProjectDocumentData) {
  if(!data.articles.length) return `<p>Nenhuma referência vinculada ao projeto.</p>`;
  return `<ol>${data.articles.map(article=>`<li>${esc(article.authors.slice(0,3).join("; ")||"Autoria não informada")}. <strong>${esc(article.title)}</strong>. ${esc(article.journal||"")} ${esc(article.year||"s.d.")}.${article.doi?` DOI: ${esc(article.doi)}.`:""}${article.pmid?` PMID: ${esc(article.pmid)}.`:""}</li>`).join("")}</ol>`;
}
export function buildStructuredProtocol(data:ProjectDocumentData) {
  const p=data.project;
  const blocks = [
    ["Identificação",[["Título",p.title||p.theme],["Autor",data.profile.name],["Instituição",data.profile.institution],["Área",data.profile.specialty],["Desenho",p.studyType]]],
    ["Fundamentação e pergunta",[["Tema e recorte",p.theme],["Pergunta de pesquisa",p.question],["Hipótese ou pressuposto",p.hypothesis]]],
    ["Objetivos e desfechos",[["Objetivo geral",p.objective],["Desfecho principal",p.outcome],["Variáveis e mensuração",p.variables]]],
    ["Métodos",[["População",p.population],["Critérios de inclusão",p.inclusion],["Critérios de exclusão",p.exclusion],["Procedimentos e coleta",p.methods],["Plano de análise",p.analysis]]],
    ["Ética e planejamento",[["Considerações éticas",p.ethics],["Planejamento do manuscrito",p.manuscript]]],
  ] as [string,[string,string][]][];
  const body=blocks.map(([title,fields])=>section(title,fields.map(([label,value])=>field(label,value)).join(""))).join("")+section("Referências vinculadas",references(data));
  return shell(p.title||p.theme||"Protocolo de pesquisa","Protocolo estruturado para revisão",body,data);
}

export function buildProjectSummary(data:ProjectDocumentData) {
  const p=data.project; const reviewed=data.articles.filter(a=>a.readingStatus==="reviewed").length;
  const missing=projectFields.filter(item=>!String(p[item.key]??"").trim()).map(item=>item.label);
  const body=`<div class="grid"><div class="row"><div class="cell">${field("Situação",statusLabel(p.status))}</div><div class="cell">${field("Estrutura preenchida",`${p.progress}%`)}</div></div><div class="row"><div class="cell">${field("Referências vinculadas",data.articles.length)}</div><div class="cell">${field("Artigos avaliados",reviewed)}</div></div></div>${section("Síntese do projeto",field("Pergunta",p.question)+field("Objetivo",p.objective)+field("Desenho",p.studyType)+field("População",p.population)+field("Desfecho principal",p.outcome)+field("Método previsto",p.methods))}${section("Estado de preparação",missing.length?`<div class="box warning"><strong>Campos ainda a definir:</strong> ${esc(missing.join(", "))}.</div>`:`<div class="box"><strong>Estrutura principal preenchida.</strong> Isso não substitui a revisão científica e metodológica.</div>`)}${section("Próximas etapas",data.milestones.length?`<ul>${data.milestones.filter(m=>m.status!=="done").map(m=>`<li><strong>${esc(m.label)}</strong> — ${esc(statusLabel(m.status))}; ${esc(m.note||"próxima ação não registrada")}; ${esc(datePt(m.dueDate))}</li>`).join("")}</ul>`:"<p>Nenhuma etapa registrada.</p>")}`;
  return shell(p.title||p.theme||"Resumo do projeto","Resumo executivo do projeto científico",body,data);
}

export function buildAdvisorReport(data:ProjectDocumentData) {
  const p=data.project; const pending=data.milestones.filter(m=>m.status!=="done");
  const notesFilled=data.articles.filter(a=>Object.values(data.notes[a.id]||{}).some(value=>String(value||"").trim())).length;
  const questions=[
    ...projectFields.filter(item=>!String(p[item.key]??"").trim()).map(item=>`Definir ou validar: ${item.label.toLowerCase()}.`),
    ...pending.filter(m=>m.status==="blocked").map(m=>`${m.label}: ${m.note||"registrar o motivo do bloqueio"}.`),
  ];
  const body=`${section("Panorama para a reunião",`<div class="grid"><div class="row"><div class="cell">${field("Progresso da estrutura",`${p.progress}%`)}</div><div class="cell">${field("Atualizado em",datePt(p.updatedAt.slice(0,10)))}</div></div><div class="row"><div class="cell">${field("Referências",data.articles.length)}</div><div class="cell">${field("Leituras com matriz",notesFilled)}</div></div></div>`)}${section("Decisões centrais",field("Pergunta",p.question)+field("Objetivo",p.objective)+field("Desenho",p.studyType)+field("População",p.population)+field("Desfecho",p.outcome))}${section("Pendências e próximos passos",pending.length?`<table><thead><tr><th>Etapa</th><th>Status</th><th>Próxima ação</th><th>Prazo</th></tr></thead><tbody>${pending.map(m=>`<tr><td>${esc(m.label)}</td><td>${esc(statusLabel(m.status))}</td><td>${esc(m.note||"A definir")}</td><td>${esc(datePt(m.dueDate))}</td></tr>`).join("")}</tbody></table>`:"<p>Não há pendências registradas na jornada.</p>")}${section("Pontos para validar com o orientador",questions.length?`<ol>${questions.map(q=>`<li>${esc(q)}</li>`).join("")}</ol>`:`<div class="box">Os campos principais estão preenchidos. Use a reunião para validar coerência, viabilidade, ética e plano de análise.</div>`)}${section("Referências em discussão",references({...data,articles:data.articles.filter(a=>a.favorite||a.readingStatus==="reviewed").slice(0,12)}))}`;
  return shell(p.title||p.theme||"Reunião de orientação","Relatório de preparação para reunião com o orientador",body,data);
}

export function buildProjectMatrixCsv(data:ProjectDocumentData) {
  const headings=["Projeto","Título","Autores","Ano","Periódico","PMID","DOI","Fonte","Status de leitura","Pasta","Desenho","Tags","Objetivo","População","Método","Amostra","Intervenção","Comparador","Desfechos","Resultado principal","Limitações","Nível de evidência","Risco de viés","Notas gerais","Motivo de exclusão","Link para texto completo"];
  const rows=data.articles.map(article=>{const note=data.notes[article.id]||{};return [data.project.title||data.project.theme,article.title,article.authors.join("; "),article.year,article.journal,article.pmid,article.doi,article.source,article.readingStatus,article.folder,article.studyDesign,article.tags.join("; "),note.objective,note.population,note.method,note.sampleSize,note.intervention,note.comparator,note.outcomes,note.finding,note.limitation,note.evidenceLevel,note.riskOfBias,note.generalNotes,article.exclusionReason,article.fullTextUrl].map(csv).join(",")});
  return `\uFEFF${headings.map(csv).join(",")}\n${rows.join("\n")}`;
}
