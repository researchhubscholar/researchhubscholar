import { intlLocale } from "@/lib/i18n/format";
import AuthoredText from "@/components/i18n/authored-text";
import InterfaceText from "@/components/i18n/interface-text";
import { getRequestLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n/locale";
import type { MessageKey } from "@/lib/i18n/catalog";
import EvaluationForm from "@/components/ai/evaluation-form";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { operationDurationSeconds } from "@/lib/ai/evaluation/rubric";
import { isIdeaRefinement } from "@/lib/ai/refine-idea";
import { generationStatus } from "@/lib/access/plans";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GenerationPage({ params }: { params: Promise<{ id: string }> }) {
 const formatLocale=await getRequestLocale();

  const requestLocale = await getRequestLocale();
  const uiText = (key: MessageKey) => translate(requestLocale, key);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const client = await supabaseServer();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/geracoes/${id}`)}`);
  const [{ data: usage }, { data: artifact }] = await Promise.all([
    client.from("scholar_usage").select("id,feature,model,mode,status,reserved_tokens,input_tokens,output_tokens,cost_usd,created_at,finished_at").eq("id", id).eq("user_id", user.id).maybeSingle(),
    client.from("scholar_generation_artifacts").select("usage_id,prompt_version,output_snapshot,error_code,created_at,updated_at").eq("usage_id", id).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!usage) notFound();
  const output = artifact?.output_snapshot as { caution?: string; summary?:string; recommendations?:Array<{label?:string;content?:string;rationale?:string;confidence?:string;source?:string}>; ideas?: Array<{ title?: string; question?: string; studyType?: string }>; proposals?: Array<{ title?: string; question?: string; studyType?: string }> } | null;
  const refinement = isIdeaRefinement(artifact?.output_snapshot) ? artifact?.output_snapshot : null;
  const ideas = output?.ideas || output?.proposals || (refinement ? [refinement.refinedProposal] : []);
  const duration = operationDurationSeconds(usage.created_at, usage.finished_at);
  return <main className="scholar-workspace max-w-4xl mx-auto">
    <Link href="/ideias" className="text-sm text-teal"><InterfaceText message="screen.da8900fbf469" /></Link>
    <p className="text-xs uppercase tracking-widest text-teal font-semibold mt-8"><InterfaceText message="screen.cca2a689ae9d" /></p>
    <h1 className="font-display text-4xl mt-3"><InterfaceText message="screen.d82750dcf09d" /></h1>
    <p className="text-ink-soft mt-3"><InterfaceText message="screen.3b37034c579b" /></p>
    <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-7" aria-label={uiText("screen.075028846be9")}>
      <Metric label={uiText("screen.920e413c7d41")} value={generationStatus(usage.status)} />
      <Metric label="Modo" value={usage.mode === "simulation" ? "Simulação sem custo" : "IA ativa"} />
      <Metric label={uiText("screen.6eb28a77b0b8")} value={String(usage.status === "completed" ? (usage.input_tokens || 0) + (usage.output_tokens || 0) : 0)} />
      <Metric label={uiText("screen.728f2d70f3c7")} value={`US$ ${Number(usage.cost_usd || 0).toFixed(4)}`} />
      <Metric label={uiText("screen.8d5cfd42d8a4")} value={duration === null ? usage.status === "reserved" ? "Em andamento" : "Indisponível" : `${duration.toLocaleString(intlLocale(formatLocale), { maximumFractionDigits: 1 })} s`} />
    </section>
    <section className="bg-white border border-line rounded-2xl p-5 mt-6 text-sm">
      <dl className="grid md:grid-cols-2 gap-4"><Item label={uiText("screen.40e49271ddad")} value={usage.id} /><Item label={uiText("screen.8f1e11c5bb0f")} value={artifact?.prompt_version || "Indisponível"} /><Item label="Modelo" value={usage.model} /><Item label="Tokens de entrada" value={String(usage.input_tokens || 0)} /><Item label={uiText("screen.5e30402cfec0")} value={String(usage.output_tokens || 0)} /><Item label={uiText("screen.7d051f286fa4")} value={new Date(usage.created_at).toLocaleString(intlLocale(formatLocale), { timeZone: "America/Sao_Paulo" })} /></dl>
      {artifact?.error_code && <p className="mt-5 text-red-700"><InterfaceText message="screen.3d82771b2b27" /> {artifact?.error_code}</p>}
      {!artifact && <p className="mt-5 text-ink-soft"><InterfaceText message="screen.d45cc0748f83" /></p>}
      {output?.caution && <p className="mt-5 bg-teal-soft rounded-card p-4">{output.caution}</p>}
    </section>
    {ideas.length > 0 && <section className="mt-7"><h2 className="font-display text-2xl"><InterfaceText message="screen.3ca6d5f5c4df" /></h2><div className="space-y-3 mt-4">{ideas.map((idea, index) => <article key={`${index}-${idea.title}`} className="bg-white border border-line rounded-card p-4"><p className="text-xs text-teal"><InterfaceText message="screen.4096a599d6cb" /> {index + 1}{idea.studyType ? ` · ${idea.studyType}` : ""}</p><h3 className="font-display text-xl mt-2">{idea.title || "Proposta"}</h3>{idea.question && <p className="text-sm text-ink-soft mt-2">{idea.question}</p>}</article>)}</div></section>}
    {refinement && <section className="mt-7 bg-white border border-line rounded-card p-5"><h2 className="font-display text-2xl"><InterfaceText message="screen.ef529ed303a3" /></h2><dl className="space-y-4 mt-4"><Item label={uiText("screen.a5294d1d3972")} value={refinement.framework} /><Item label={uiText("screen.a2639a12cdf3")} value={refinement.refinementRationale} /><Item label={uiText("screen.abe94eede8f2")} value={refinement.gapAssessment} /><Item label={uiText("screen.ceac72f34707")} value={refinement.similarityRisk} /></dl><h3 className="font-medium mt-6"><InterfaceText message="screen.ef47d45b5ca6" /></h3><ul className="mt-3 space-y-3">{refinement.sources.map((source, index) => <li key={`${source.pmid}-${index}`} className="text-sm"><Link href={`https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(source.pmid)}/`} target="_blank" rel="noreferrer" className="text-teal underline">{source.title}</Link><p className="text-ink-soft mt-1">{source.contribution}</p></li>)}</ul></section>}
    {!!output?.recommendations?.length&&<section className="mt-7"><h2 className="font-display text-2xl"><InterfaceText message="screen.e2265dd08900" /></h2>{output.summary&&<p className="text-sm text-ink-soft mt-2">{output.summary}</p>}<div className="grid md:grid-cols-2 gap-3 mt-4">{output.recommendations.map((item,index)=><article key={`${index}-${item.label}`} className="bg-white border border-line rounded-card p-4"><div className="flex justify-between gap-2"><h3 className="font-medium">{item.label||uiText("screen.9daee0ad509e")}</h3>{item.confidence&&<span className="text-xs text-ink-soft"><InterfaceText message="screen.d7871d7a7737" /> {item.confidence}</span>}</div>{item.content&&<p className="text-sm whitespace-pre-wrap mt-2">{item.content}</p>}{item.rationale&&<p className="text-xs text-ink-soft mt-3">{item.rationale}</p>}{item.source&&<details className="text-xs text-ink-soft mt-3"><summary><InterfaceText message="screen.948674beec2c" /></summary><p className="mt-2 whitespace-pre-wrap">{item.source}</p></details>}</article>)}</div></section>}
    {usage.status==="completed"&&<EvaluationForm usageId={usage.id}/>}
    <p className="text-xs text-ink-soft mt-7"><InterfaceText message="screen.6f0f58e0ad8a" /></p>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-teal-soft rounded-card p-4"><span className="text-xs text-ink-soft"><AuthoredText text={label} /></span><strong className="block mt-1">{value}</strong></div>; }
function Item({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-ink-soft"><AuthoredText text={label} /></dt><dd className="mt-1 break-all">{value}</dd></div>; }
