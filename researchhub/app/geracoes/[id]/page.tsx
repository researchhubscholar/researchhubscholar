import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { generationStatus } from "@/lib/access/plans";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function GenerationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const client = await supabaseServer();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(`/geracoes/${id}`)}`);
  const [{ data: usage }, { data: artifact }] = await Promise.all([
    client.from("scholar_usage").select("id,feature,model,mode,status,reserved_tokens,input_tokens,output_tokens,cost_usd,created_at,finished_at").eq("id", id).eq("user_id", user.id).maybeSingle(),
    client.from("scholar_generation_artifacts").select("usage_id,prompt_version,output_snapshot,error_code,created_at,updated_at").eq("usage_id", id).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!usage || !artifact) notFound();
  const output = artifact.output_snapshot as { caution?: string; summary?:string; recommendations?:Array<{label?:string;content?:string;rationale?:string;confidence?:string;source?:string}>; ideas?: Array<{ title?: string; question?: string; studyType?: string }>; proposals?: Array<{ title?: string; question?: string; studyType?: string }> } | null;
  const ideas = output?.ideas || output?.proposals || [];
  return <main className="scholar-workspace max-w-4xl mx-auto">
    <Link href="/ideias" className="text-sm text-teal">← Voltar para Ideias</Link>
    <p className="text-xs uppercase tracking-widest text-teal font-semibold mt-8">Rastreabilidade da assistência</p>
    <h1 className="font-display text-4xl mt-3">Detalhes da geração</h1>
    <p className="text-ink-soft mt-3">Cada solicitação possui um identificador próprio, consumo registrado e versão do prompt usada.</p>
    <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-7" aria-label="Resumo da operação">
      <Metric label="Status" value={generationStatus(usage.status)} />
      <Metric label="Modo" value={usage.mode === "simulation" ? "Simulação sem custo" : "IA ativa"} />
      <Metric label="Tokens consumidos" value={String((usage.input_tokens || 0) + (usage.output_tokens || 0))} />
      <Metric label="Custo registrado" value={`US$ ${Number(usage.cost_usd || 0).toFixed(4)}`} />
    </section>
    <section className="bg-white border border-line rounded-2xl p-5 mt-6 text-sm">
      <dl className="grid md:grid-cols-2 gap-4"><Item label="Operação" value={usage.id} /><Item label="Versão do prompt" value={artifact.prompt_version} /><Item label="Modelo" value={usage.model} /><Item label="Criada em" value={new Date(usage.created_at).toLocaleString("pt-BR")} /></dl>
      {artifact.error_code && <p className="mt-5 text-red-700">Falha registrada: {artifact.error_code}</p>}
      {output?.caution && <p className="mt-5 bg-teal-soft rounded-card p-4">{output.caution}</p>}
    </section>
    {ideas.length > 0 && <section className="mt-7"><h2 className="font-display text-2xl">Propostas registradas</h2><div className="space-y-3 mt-4">{ideas.map((idea, index) => <article key={`${index}-${idea.title}`} className="bg-white border border-line rounded-card p-4"><p className="text-xs text-teal">CAMINHO {index + 1}{idea.studyType ? ` · ${idea.studyType}` : ""}</p><h3 className="font-display text-xl mt-2">{idea.title || "Proposta"}</h3>{idea.question && <p className="text-sm text-ink-soft mt-2">{idea.question}</p>}</article>)}</div></section>}
    {!!output?.recommendations?.length&&<section className="mt-7"><h2 className="font-display text-2xl">Sugestões registradas</h2>{output.summary&&<p className="text-sm text-ink-soft mt-2">{output.summary}</p>}<div className="grid md:grid-cols-2 gap-3 mt-4">{output.recommendations.map((item,index)=><article key={`${index}-${item.label}`} className="bg-white border border-line rounded-card p-4"><div className="flex justify-between gap-2"><h3 className="font-medium">{item.label||"Sugestão"}</h3>{item.confidence&&<span className="text-xs text-ink-soft">Confiança {item.confidence}</span>}</div>{item.content&&<p className="text-sm whitespace-pre-wrap mt-2">{item.content}</p>}{item.rationale&&<p className="text-xs text-ink-soft mt-3">{item.rationale}</p>}{item.source&&<details className="text-xs text-ink-soft mt-3"><summary>Fonte usada</summary><p className="mt-2 whitespace-pre-wrap">{item.source}</p></details>}</article>)}</div></section>}
    <p className="text-xs text-ink-soft mt-7">A assistência não substitui avaliação do orientador, revisão da literatura, análise ética ou validação metodológica.</p>
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-teal-soft rounded-card p-4"><span className="text-xs text-ink-soft">{label}</span><strong className="block mt-1">{value}</strong></div>; }
function Item({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-ink-soft">{label}</dt><dd className="mt-1 break-all">{value}</dd></div>; }
