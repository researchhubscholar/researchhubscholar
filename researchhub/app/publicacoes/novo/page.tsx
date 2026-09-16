import { getCurrentProfessor } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NovaPublicacaoForm from "./NovaPublicacaoForm";

export const dynamic = "force-dynamic";

export default async function NovaPublicacaoPage() {
  const professor = await getCurrentProfessor();
  if (!professor) redirect("/login");

  const supabase = await supabaseServer();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title")
    .eq("lead_professor_id", professor.id)
    .order("title");

  return (
    <div className="max-w-lg">
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Nova Publicação</p>
      <h1 className="font-display text-2xl text-ink mt-1">Cadastrar publicação</h1>
      <p className="text-ink-soft mt-2">
        Guardamos apenas os metadados — não armazenamos o PDF.
      </p>

      <NovaPublicacaoForm professorId={professor.id} projects={projects ?? []} />
    </div>
  );
}
