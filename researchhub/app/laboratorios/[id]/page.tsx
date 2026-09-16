import { supabaseServer } from "@/lib/supabase/server";
import EntityCard from "@/components/EntityCard";
import SaveButton from "@/components/SaveButton";
import { STATUS_LABELS } from "@/lib/types";
import { getCurrentAppUser } from "@/lib/auth";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LaboratorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const appUser = await getCurrentAppUser();

  const { data: lab } = await supabase
    .from("laboratories")
    .select("*")
    .eq("id", id)
    .single();

  if (!lab) notFound();

  let alreadySaved = false;
  if (appUser) {
    const { data: existing } = await supabase
      .from("saved_items")
      .select("user_id")
      .eq("user_id", appUser.id)
      .eq("entity_type", "laboratory")
      .eq("entity_id", id)
      .maybeSingle();
    alreadySaved = !!existing;
  }

  const { data: profJoin } = await supabase
    .from("professor_laboratories")
    .select("role, professors(id, name, specialty, accepting_students)")
    .eq("laboratory_id", id);

  const { data: lineJoin } = await supabase
    .from("laboratory_research_lines")
    .select("research_lines(id, name, description)")
    .eq("laboratory_id", id);

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, summary, status, keywords")
    .eq("laboratory_id", id);

  const professors = (profJoin ?? []).map((j: any) => ({ ...j.professors, role: j.role })).filter(Boolean);
  const lines = (lineJoin ?? []).map((j: any) => j.research_lines).filter(Boolean);

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Laboratório</p>
      <h1 className="font-display text-3xl text-ink mt-1">{lab.name}</h1>
      {lab.description && <p className="text-ink-soft mt-4 max-w-2xl leading-relaxed">{lab.description}</p>}
      {lab.location && <p className="text-sm text-ink-soft/70 mt-2">{lab.location}</p>}

      <div className="mt-4">
        <SaveButton entityType="laboratory" entityId={id} userId={appUser?.id ?? null} initialSaved={alreadySaved} />
      </div>

      <div className="flex gap-6 mt-8 text-sm text-ink-soft border-y border-line py-3">
        <span>{professors.length} pesquisadores</span>
        <span>{lines.length} linhas de pesquisa</span>
        <span>{(projects ?? []).length} projetos</span>
      </div>

      {lines.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">Linhas de Pesquisa</h2>
          {lines.map((l: any) => (
            <EntityCard key={l.id} href={`/linhas/${l.id}`} eyebrow="Linha de Pesquisa" title={l.name} subtitle={l.description} />
          ))}
        </section>
      )}

      {professors.length > 0 && (
        <section className="mt-4">
          <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">Pesquisadores</h2>
          {professors.map((p: any) => (
            <EntityCard
              key={p.id}
              href={`/professores/${p.id}`}
              eyebrow={p.role ?? "Professor"}
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
    </div>
  );
}
