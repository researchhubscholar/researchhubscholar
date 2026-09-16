import { supabaseServer } from "@/lib/supabase/server";
import EntityCard from "@/components/EntityCard";
import SaveButton from "@/components/SaveButton";
import { STATUS_LABELS } from "@/lib/types";
import { getCurrentAppUser } from "@/lib/auth";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LinhaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const appUser = await getCurrentAppUser();

  const { data: line } = await supabase
    .from("research_lines")
    .select("*")
    .eq("id", id)
    .single();

  if (!line) notFound();

  let alreadySaved = false;
  if (appUser) {
    const { data: existing } = await supabase
      .from("saved_items")
      .select("user_id")
      .eq("user_id", appUser.id)
      .eq("entity_type", "research_line")
      .eq("entity_id", id)
      .maybeSingle();
    alreadySaved = !!existing;
  }

  const { data: profJoin } = await supabase
    .from("professor_research_lines")
    .select("professors(id, name, specialty, accepting_students)")
    .eq("research_line_id", id);

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, summary, status, keywords")
    .eq("research_line_id", id);

  const { data: labJoin } = await supabase
    .from("laboratory_research_lines")
    .select("laboratories(id, name, description)")
    .eq("research_line_id", id);

  const professors = (profJoin ?? []).map((j: any) => j.professors).filter(Boolean);
  const labs = (labJoin ?? []).map((j: any) => j.laboratories).filter(Boolean);

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Linha de Pesquisa</p>
      <h1 className="font-display text-3xl text-ink mt-1">{line.name}</h1>
      {line.description && <p className="text-ink-soft mt-4 max-w-2xl leading-relaxed">{line.description}</p>}

      {line.keywords && line.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {line.keywords.map((k: string) => (
            <span key={k} className="text-xs font-mono text-ink-soft bg-white border border-line px-2 py-0.5 rounded-full">
              {k}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4">
        <SaveButton entityType="research_line" entityId={id} userId={appUser?.id ?? null} initialSaved={alreadySaved} />
      </div>

      <div className="flex gap-6 mt-8 text-sm text-ink-soft border-y border-line py-3">
        <span>{professors.length} professores</span>
        <span>{labs.length} laboratórios</span>
        <span>{(projects ?? []).length} projetos</span>
      </div>

      {professors.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">Professores</h2>
          {professors.map((p: any) => (
            <EntityCard
              key={p.id}
              href={`/professores/${p.id}`}
              eyebrow="Professor"
              title={p.name}
              subtitle={p.specialty}
              badge={p.accepting_students ? { label: "Aceita orientandos", tone: "teal" } : undefined}
            />
          ))}
        </section>
      )}

      {projects && projects.length > 0 && (
        <section className="mt-4">
          <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">Projetos</h2>
          {projects.map((p: any) => (
            <EntityCard
              key={p.id}
              href={`/projetos/${p.id}`}
              eyebrow="Projeto"
              title={p.title}
              subtitle={p.summary}
              tags={p.keywords}
              badge={{ label: STATUS_LABELS[p.status] ?? p.status, tone: p.status === "recruiting" ? "amber" : "teal" }}
            />
          ))}
        </section>
      )}

      {labs.length > 0 && (
        <section className="mt-4">
          <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">Laboratórios</h2>
          {labs.map((l: any) => (
            <EntityCard key={l.id} href={`/laboratorios/${l.id}`} eyebrow="Laboratório" title={l.name} subtitle={l.description} />
          ))}
        </section>
      )}
    </div>
  );
}
