import { workspaceReadings } from "../../lib/results/review";
import type { ResultsWorkspace } from "../../lib/results/data";
import { ResultReading } from "./result-reading";
export default function SavedReadings({workspace}:{workspace:ResultsWorkspace}) {
 const results=workspaceReadings(workspace);
 return <section className="rounded-2xl border bg-white p-5 space-y-4"><h3 className="text-lg font-medium">Revise as análises preparadas</h3><p className="text-sm text-ink-soft">Estes resumos usam os dados atuais desta página. Confira cada análise e salve os resultados antes de abrir o manuscrito ou o centro de documentos.</p>{!results.length&&<p className="text-sm">Você já pode usar o perfil e os gráficos abaixo. Para preparar uma comparação, volte a Responder à pergunta.</p>}{results.map(r=><div key={r.title} className="border rounded-card p-4 space-y-3"><h4 className="font-medium">{r.title}</h4>{r.reading?<ResultReading reading={r.reading}/>:<p role="status" className="text-sm">Análise pendente de revisão: {r.pending} Volte a Responder à pergunta para conferir.</p>}</div>)}</section>;
}
