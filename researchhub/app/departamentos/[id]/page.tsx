import { supabaseServer } from "@/lib/supabase/server";
import EntityCard from "@/components/EntityCard";
import { getCurrentAppUser, getCurrentAdmin, getCurrentCoordinator } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DepartamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const appUser = await getCurrentAppUser();

  const { data: department } = await supabase
    .from("departments")
    .select("*, universities(name)")
    .eq("id", id)
    .single();

  if (!department) notFound();

  let canImport = false;
  if (appUser?.role === "admin") {
    const admin = await getCurrentAdmin();
    canImport = admin?.universityId === department.university_id;
  } else if (appUser?.role === "coordinator") {
    const coordinator = await getCurrentCoordinator();
    canImport = coordinator?.departmentId === id;
  }

  const [{ data: professors }, { data: labs }, { data: lines }] = await Promise.all([
    supabase
      .from("professors")
      .select("id, name, specialty, accepting_students")
      .eq("department_id", id),
    supabase
      .from("laboratories")
      .select("id, name, description")
      .eq("department_id", id),
    supabase
      .from("research_lines")
      .select("id, name, description, keywords")
      .eq("department_id", id)
      .eq("active", true),
  ]);

  const university = (department as any).universities;

  return (
    <div>
      {university?.name && (
        <p className="text-xs uppercase tracking-wide text-teal font-medium">{university.name}</p>
      )}
      <h1 className="font-display text-3xl text-ink mt-1">{department.name}</h1>
      {department.description && (
        <p className="text-ink-soft mt-4 max-w-2xl leading-relaxed">{department.description}</p>
      )}

      {canImport && (
        <Link href={`/departamentos/${id}/importar`} className="inline-block mt-4 text-sm text-teal font-medium hover:underline">
          Importar professores em massa
        </Link>
      )}

      <div className="flex gap-6 mt-8 text-sm text-ink-soft border-y border-line py-3">
        <span>{professors?.length ?? 0} professores</span>
        <span>{labs?.length ?? 0} laboratórios</span>
        <span>{lines?.length ?? 0} linhas de pesquisa</span>
      </div>

      {lines && lines.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">Linhas de Pesquisa</h2>
          {lines.map((l) => (
            <EntityCard
              key={l.id}
              href={`/linhas/${l.id}`}
              eyebrow="Linha de Pesquisa"
              title={l.name}
              subtitle={l.description}
              tags={l.keywords}
            />
          ))}
        </section>
      )}

      {professors && professors.length > 0 && (
        <section className="mt-4">
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
        </section>
      )}

      {labs && labs.length > 0 && (
        <section className="mt-4">
          <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">Laboratórios</h2>
          {labs.map((l) => (
            <EntityCard key={l.id} href={`/laboratorios/${l.id}`} eyebrow="Laboratório" title={l.name} subtitle={l.description} />
          ))}
        </section>
      )}
    </div>
  );
}
