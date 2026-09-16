import { getCurrentProfessor } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NovoProjetoForm from "./NovoProjetoForm";

export const dynamic = "force-dynamic";

export default async function NovoProjetoPage() {
  const professor = await getCurrentProfessor();
  if (!professor) redirect("/login");

  const supabase = await supabaseServer();

  const { data: lines } = await supabase
    .from("professor_research_lines")
    .select("research_lines(id, name)")
    .eq("professor_id", professor.id);

  const { data: labs } = await supabase
    .from("professor_laboratories")
    .select("laboratories(id, name)")
    .eq("professor_id", professor.id);

  return (
    <div className="max-w-lg">
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Novo Projeto</p>
      <h1 className="font-display text-2xl text-ink mt-1">Cadastrar projeto</h1>

      <NovoProjetoForm
        professorId={professor.id}
        lines={(lines ?? []).map((j: any) => j.research_lines).filter(Boolean)}
        labs={(labs ?? []).map((j: any) => j.laboratories).filter(Boolean)}
      />
    </div>
  );
}
