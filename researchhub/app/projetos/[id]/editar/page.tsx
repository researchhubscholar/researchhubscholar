import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentProfessor } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import EditProjetoForm from "./EditProjetoForm";

export const dynamic = "force-dynamic";

export default async function EditarProjetoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const professor = await getCurrentProfessor();
  if (!professor) redirect("/login");

  const supabase = await supabaseServer();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) notFound();
  if (project.lead_professor_id !== professor.id) redirect(`/projetos/${id}`);

  const { data: interested } = await supabase
    .from("project_members")
    .select("id, created_at, users(name, email)")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-lg">
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Editar Projeto</p>
      <h1 className="font-display text-2xl text-ink mt-1">{project.title}</h1>

      <EditProjetoForm project={project} />

      <section className="mt-12">
        <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">
          Interessados ({interested?.length ?? 0})
        </h2>
        {interested && interested.length > 0 ? (
          <div className="space-y-3">
            {interested.map((i: any) => (
              <div key={i.id} className="border border-line rounded-card px-4 py-3">
                <p className="font-medium text-ink">{i.users?.name}</p>
                <a href={`mailto:${i.users?.email}`} className="text-sm text-teal hover:underline">
                  {i.users?.email}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Ninguém manifestou interesse ainda.</p>
        )}
      </section>
    </div>
  );
}
