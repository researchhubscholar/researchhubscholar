import Link from "next/link";
import { studyFormat } from "@/lib/research/study-format";
import type { ResearchProject } from "@/lib/literature/library-store";

export default function ProjectLiteraturePath({ project, count, locale }: { project: ResearchProject; count: number; locale: string }) {
  const es = locale === "es";
  const id = encodeURIComponent(project.id);
  const showScreening = count > 0 && studyFormat(project.study_type ?? "") === "systematic";
  return <section aria-label={es ? "Proyecto actual" : "Projeto atual"} className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-teal-soft p-4 text-sm">
    <p>{es ? "Proyecto:" : "Projeto:"} <strong>{project.title || project.theme || (es ? "Sin título" : "Sem título")}</strong>
      {showScreening && <span className="block mt-1">{count} {es ? "artículos vinculados. Puedes seguir buscando o pasar a la selección." : "artigos vinculados. Você pode continuar buscando ou seguir para a triagem."}</span>}
    </p>
    <div className="flex flex-wrap items-center gap-3">
      <Link className="text-teal underline" href={`/meu-trabalho?id=${id}`}>{es ? "Volver al proyecto" : "Voltar ao projeto"}</Link>
      {showScreening && <Link className="rounded-card bg-teal px-4 py-2 text-white" href={`/resultados?projeto=${id}#triagem`}>{es ? "Continuar a la selección" : "Continuar para a triagem"}</Link>}
    </div>
  </section>;
}
