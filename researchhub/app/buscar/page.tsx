import SearchBar from "@/components/SearchBar";
import EntityCard from "@/components/EntityCard";
import { supabaseServer } from "@/lib/supabase/server";
import { STATUS_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const supabase = await supabaseServer();

  let professors: any[] = [];
  let projects: any[] = [];
  let lines: any[] = [];
  let labs: any[] = [];

  if (q.length > 0) {
    const like = `%${q}%`;

    const [profRes, projRes, lineRes, labRes] = await Promise.all([
      supabase.from("professors").select("id, name, specialty, accepting_students")
        .or(`name.ilike.${like},specialty.ilike.${like},bio.ilike.${like}`).limit(10),
      supabase.from("projects").select("id, title, summary, status, accepting_students, keywords")
        .or(`title.ilike.${like},summary.ilike.${like}`).limit(10),
      supabase.from("research_lines").select("id, name, description, keywords")
        .or(`name.ilike.${like},description.ilike.${like}`).limit(10),
      supabase.from("laboratories").select("id, name, description")
        .or(`name.ilike.${like},description.ilike.${like}`).limit(10),
    ]);

    professors = profRes.data ?? [];
    projects = projRes.data ?? [];
    lines = lineRes.data ?? [];
    labs = labRes.data ?? [];
  }

  const totalResults = professors.length + projects.length + lines.length + labs.length;

  return (
    <div>
      <SearchBar initialQuery={q} />

      {q.length === 0 && (
        <p className="text-ink-soft mt-8">Digite um termo para começar — ex: "cardiologia", "IA", "oncologia".</p>
      )}

      {q.length > 0 && (
        <div className="mt-10 space-y-12">
          <p className="text-sm text-ink-soft">
            {totalResults} {totalResults === 1 ? "resultado" : "resultados"} para <strong className="text-ink">"{q}"</strong>
          </p>

          {lines.length > 0 && (
            <div>
              <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">Linhas de Pesquisa</h2>
              {lines.map((l) => (
                <EntityCard key={l.id} href={`/linhas/${l.id}`} eyebrow="Linha de Pesquisa" title={l.name} subtitle={l.description} tags={l.keywords} />
              ))}
            </div>
          )}

          {professors.length > 0 && (
            <div>
              <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">Professores</h2>
              {professors.map((p) => (
                <EntityCard
                  key={p.id}
                  href={`/professores/${p.id}`}
                  eyebrow="Professor"
                  title={p.name}
                  subtitle={p.specialty}
                  badge={p.accepting_students ? { label: "Aceita orientandos", tone: "teal" } : undefined}
                />
              ))}
            </div>
          )}

          {projects.length > 0 && (
            <div>
              <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">Projetos</h2>
              {projects.map((p) => (
                <EntityCard
                  key={p.id}
                  href={`/projetos/${p.id}`}
                  eyebrow="Projeto"
                  title={p.title}
                  subtitle={p.summary}
                  tags={p.keywords}
                  badge={p.status === "recruiting" ? { label: STATUS_LABELS[p.status], tone: "amber" } : { label: STATUS_LABELS[p.status] ?? p.status, tone: "teal" }}
                />
              ))}
            </div>
          )}

          {labs.length > 0 && (
            <div>
              <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">Laboratórios</h2>
              {labs.map((l) => (
                <EntityCard key={l.id} href={`/laboratorios/${l.id}`} eyebrow="Laboratório" title={l.name} subtitle={l.description} />
              ))}
            </div>
          )}

          {totalResults === 0 && (
            <p className="text-ink-soft">Nenhum resultado encontrado. Tente outro termo.</p>
          )}
        </div>
      )}
    </div>
  );
}
