"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import type {HealthMetrics,HealthAlert} from "@/lib/operations/health";
type Payload={asOf:string;partial:boolean;metrics:HealthMetrics;alerts:HealthAlert[];checks:Record<string,{state:string;label:string}>;providers:{decs:{attempts24h:number|null;failures24h:number|null};asaas:{events24h:number|null;attention24h:number|null}}};
const entries:{key:keyof HealthMetrics;label:string;subtitle:string}[]=[
 {key:"ai24h",label:"Solicitações de IA",subtitle:"Últimas 24 horas"},
 {key:"aiFailed24h",label:"Falhas da IA",subtitle:"Últimas 24 horas"},
 {key:"aiReserved24h",label:"IA em processamento",subtitle:"Reservas das últimas 24 horas"},
 {key:"ai7d",label:"Solicitações de IA",subtitle:"Últimos 7 dias"},
 {key:"aiFailed7d",label:"Falhas de IA",subtitle:"Últimos 7 dias"},
 {key:"paymentsPending24h",label:"Checkouts aguardando",subtitle:"Criados nas últimas 24 horas"},
 {key:"paymentsStale",label:"Checkouts antigos",subtitle:"Pendentes há mais de 1 hora"},
 {key:"paymentsActivated7d",label:"Compras ativadas",subtitle:"Últimos 7 dias"},
 {key:"appErrorsOpen",label:"Erros em aberto",subtitle:"Telemetria da aplicação"}
];
export default function OperationalHealthPage(){
 const [data,setData]=useState<Payload|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function refresh(signal?:AbortSignal){setLoading(true);setError("");
  try{const response=await fetch("/api/operations/health",{cache:"no-store",signal,credentials:"same-origin"});const body=await response.json();
    if(!response.ok)throw new Error(body.error||"Indicadores indisponíveis.");
    if(!signal?.aborted)setData(body);
  }catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:"Falha ao consultar indicadores.");}
  finally{if(!signal?.aborted)setLoading(false);}
 }
 useEffect(()=>{const controller=new AbortController();void refresh(controller.signal);return()=>controller.abort();},[]);
 return <main className="scholar-workspace secondary-page admin-page max-w-6xl mx-auto">
  <header className="mt-6"><Link href="/operacao" className="text-sm text-teal underline">Voltar à Operação</Link>
   <p className="text-xs uppercase tracking-widest text-teal mt-5">Gestão estratégica · Administração</p>
   <h1 className="font-display text-4xl mt-2">Saúde operacional</h1>
   <p className="text-ink-soft mt-3 max-w-3xl">Indicadores das operações de IA, cobranças e erros registrados. Consultas agregadas, sem exposição de dados científicos dos usuários.</p>
   <div className="flex flex-wrap gap-4 items-center mt-4"><button type="button" onClick={()=>void refresh()} disabled={loading} className="bg-teal text-white rounded-card px-5 py-2 disabled:opacity-50">{loading?"Consultando...":"Atualizar indicadores"}</button>
    {data&&<span className="text-xs text-ink-soft">Atualizado em {new Date(data.asOf).toLocaleString("pt-BR")}</span>}</div>
  </header>
  {error&&<p role="alert" className="mt-6 border border-red-300 bg-white text-red-700 rounded-card p-4">{error}</p>}
  {data&&<>{data.partial&&<p role="alert" className="mt-6 border border-amber-300 bg-white rounded-card p-4">Dados parciais: pelo menos uma consulta não foi concluída. O símbolo — não significa zero.</p>}
   <section aria-label="Indicadores operacionais" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-7">
    {entries.map(entry=><article key={entry.key} className="bg-white border border-line rounded-2xl p-5">
      <p className="text-xs text-ink-soft">{entry.subtitle}</p><p className="font-display text-3xl mt-2">{data.metrics[entry.key]===null?"—":data.metrics[entry.key]?.toLocaleString("pt-BR")}</p>
      <h2 className="text-sm mt-2">{entry.label}</h2></article>)}
   </section>
   <section className="bg-white border border-line rounded-2xl p-6 mt-6"><h2 className="font-display text-2xl">Alertas e atenção</h2>
    <div className="space-y-3 mt-4">{data.alerts.map(a=><div key={a.key} role={a.level==="critical"?"alert":"status"} className="border-b border-line pb-3">
      <div className="flex gap-2 items-center"><span aria-hidden="true" className={a.level==="critical"?"text-red-700":a.level==="warning"?"text-amber-700":"text-teal"}>●</span><strong className="text-sm">{a.label}</strong></div><p className="text-sm text-ink-soft mt-1">{a.detail}</p></div>)}</div>
   </section>
   <section className="bg-white border border-line rounded-2xl p-6 mt-6"><h2 className="font-display text-2xl">Serviços externos · últimas 24 horas</h2>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">{[
      ["DeCS · consultas",data.providers.decs.attempts24h],["DeCS · falhas técnicas",data.providers.decs.failures24h],
      ["Asaas · eventos recebidos",data.providers.asaas.events24h],["Asaas · eventos que exigem atenção",data.providers.asaas.attention24h]
    ].map(([label,value])=><article key={String(label)} className="bg-paper border border-line rounded-card p-4"><p className="font-display text-2xl">{value===null?"—":Number(value).toLocaleString("pt-BR")}</p><p className="text-xs text-ink-soft mt-2">{label}</p></article>)}</div>
    <p className="text-xs text-ink-soft mt-4">Contagens de registros recebidos, não testes de disponibilidade. Termos pesquisados e dados financeiros pessoais não são armazenados.</p>
   </section>
   <section className="bg-white border border-line rounded-2xl p-6 mt-6"><h2 className="font-display text-2xl">Cobertura do monitoramento</h2>
    <div className="space-y-2 mt-4">{Object.entries(data.checks).map(([key,value])=><p key={key} className="text-sm text-ink-soft">{value.label}</p>)}</div>
    <p className="text-xs text-ink-soft mt-4">Os indicadores usam registros do banco e podem não representar eventos ainda não recebidos. Nenhum pagamento ou reserva é alterado por este painel.</p>
   </section></>}
  {!data&&!error&&<p role="status" className="mt-6">Carregando indicadores...</p>}
 </main>;
}
