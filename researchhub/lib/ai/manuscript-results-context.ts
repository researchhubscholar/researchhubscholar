import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, validWorkspace, type ResultsWorkspace } from "../results/data";
import { identifierHeader } from "../clinical/collection";

/** Aggregate records before using AI; never send patient-level dataset rows. */
export type ResearchResultsContext = {
  status: "none" | "available";
  category: "review" | "case" | "original";
  source: string;
  datasetRows: number;
  screening: {pending:number;included:number;excluded:number} | null;
  reportedFlow: {label:string;count:number}[];
  summaries: {column:string;n:number;missing:number;mean:number|null;median:number|null;sd:number|null;min:number|null;max:number|null}[];
  includedStudies: {articleId:string;title:string;pmid:string|null;doi:string|null;year:number|null;sampleSize:string;finding:string;limitations:string}[];
  warnings: string[];
};

export function resultStudyCategory(value: unknown): ResearchResultsContext["category"] {
  const study = String(value||"").toLowerCase();
  if (/revis|review|metaan|meta-an|escopo|scoping|evidenc|bibliogra/.test(study)) return "review";
  if (/relato|case report|case study/.test(study)) return "case";
  return "original";
}

export function summarizeResearchResults(
  workspace: ResultsWorkspace | null, studyType: unknown
): ResearchResultsContext {
  const category = resultStudyCategory(studyType);
  const out: ResearchResultsContext = {
    status: "none", category, source:"Dados agregados do módulo Resultados (não são observações individuais)",
    datasetRows:0,screening:null,reportedFlow:[],summaries:[],includedStudies:[],warnings:[]
  };
  if (!workspace || !validWorkspace(workspace)) return out;
  if (workspace.dataset.rows.length) {
    out.datasetRows=workspace.dataset.rows.length;
    out.summaries=describe(workspace.dataset)
      .filter(row=>row.type==="Numérica"&&!identifierHeader(row.column)&&row.n>=3)
      .slice(0,16)
      .map(row=>({column:row.column.slice(0,85),n:row.n,missing:row.missing,
        mean:row.mean===null?null:Number(row.mean.toFixed(4)),
        median:row.median===null?null:Number(row.median.toFixed(4)),
        sd:row.sd===null?null:Number(row.sd.toFixed(4)),
        min:row.min,max:row.max}));
  }
  if (workspace.reviewScreening?.length) {
    out.screening={
      pending:workspace.reviewScreening.filter(row=>row.status==="pending").length,
      included:workspace.reviewScreening.filter(row=>row.status==="included").length,
      excluded:workspace.reviewScreening.filter(row=>row.status==="excluded").length
    };
  }
  out.reportedFlow=workspace.flow.filter(f=>f.count>0).slice(0,12)
    .map(f=>({label:f.label.slice(0,85),count:f.count}));
  out.status=(out.datasetRows>0||Boolean(out.screening)||out.reportedFlow.length>0)?"available":"none";
  if(category==="review" && out.reportedFlow.length && !out.screening) {
    out.warnings.push("Os números do fluxograma são declarados pelo pesquisador e precisam ser conferidos com a triagem.");
  }
  if(out.datasetRows>0) {
    out.warnings.push("Os indicadores são descrições agregadas. Não inferir significância, causalidade ou comparações não calculadas.");
  }
  return out;
}

export async function loadScientificResultsContext(
  db: SupabaseClient, ownerId: string, projectId: string, studyType: unknown
): Promise<ResearchResultsContext> {
  const {data,error}=await db.from("scholar_project_results")
    .select("workspace").eq("project_id",projectId).eq("owner_id",ownerId).maybeSingle();
  if(error) {
    const unavailable=summarizeResearchResults(null,studyType);
    unavailable.warnings.push("O módulo Resultados não pôde ser consultado. O texto do manuscrito, quando disponível, continua sendo a única base para a redação.");
    return unavailable;
  }
  const workspace=data?.workspace;
  const context=summarizeResearchResults(validWorkspace(workspace)?workspace:null,studyType);
  if(context.category==="review" && validWorkspace(workspace)) {
    const included=(workspace.reviewScreening||[]).filter(row=>row.status==="included").map(row=>row.articleId);
    if(included.length) {
      // Do not treat all library articles as eligible; use only explicitly
      // included decisions recorded by the researcher.
      const ids=included.slice(0,25);
      const [articles,matrices]=await Promise.all([
        db.from("library_articles").select("id,title,pmid,doi,publication_year")
          .eq("owner_id",ownerId).in("id",ids),
        db.from("evidence_matrix").select("article_id,main_finding,limitation,sample_size")
          .eq("owner_id",ownerId).in("article_id",ids)
      ]);
      if(articles.error||matrices.error) {
        context.warnings.push("Não foi possível consultar a matriz dos estudos incluídos. Não será gerada síntese desses artigos.");
        return context;
      }
      const byId=new Map((articles.data||[]).map(a=>[a.id,a]));
      const matrix=new Map((matrices.data||[]).map(a=>[a.article_id,a]));
      context.includedStudies=ids.flatMap(id=>{
        const article=byId.get(id);if(!article)return [];
        const evidence=matrix.get(id);
        return [{
          articleId:id,title:String(article.title||"").slice(0,180),
          pmid:article.pmid,doi:article.doi,year:article.publication_year,
          sampleSize:String(evidence?.sample_size||"").slice(0,85),
          finding:String(evidence?.main_finding||"").slice(0,380),
          limitations:String(evidence?.limitation||"").slice(0,180)
        }];
      });
      context.status="available";
      context.warnings.push(
        "Os achados da matriz foram extraídos pelo pesquisador; ainda exigem confirmação nas publicações originais."
      );
      if(included.length>ids.length)context.warnings.push(
        "Há mais estudos incluídos do que o subconjunto resumido. Não declarar síntese exaustiva."
      );
    }
  }
  if(context.category==="review"&&!context.includedStudies.length) {
    context.warnings.push("Nenhum estudo com extração de evidências e inclusão explícita foi confirmado. Não inventar estudos elegíveis.");
  }
  return context;
}

export function resultsContextFacts(value: ResearchResultsContext | null): string {
  if(!value) return "";
  return JSON.stringify({
    datasetRows:value.datasetRows,screening:value.screening,reportedFlow:value.reportedFlow,
    summaries:value.summaries,includedStudies:value.includedStudies.map(s=>({
      year:s.year,sampleSize:s.sampleSize,finding:s.finding
    }))
  });
}

export function resultsContextHasEvidence(value: ResearchResultsContext | null): boolean {
  return value?.status==="available";
}
