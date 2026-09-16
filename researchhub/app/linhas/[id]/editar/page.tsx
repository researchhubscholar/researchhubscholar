import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentProfessor } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import EditLinhaForm from "./EditLinhaForm";

export const dynamic = "force-dynamic";

export default async function EditarLinhaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const professor = await getCurrentProfessor();
  if (!professor) redirect("/login");

  const supabase = await supabaseServer();

  const { data: line } = await supabase
    .from("research_lines")
    .select("*")
    .eq("id", id)
    .single();

  if (!line) notFound();

  const { data: link } = await supabase
    .from("professor_research_lines")
    .select("professor_id")
    .eq("research_line_id", id)
    .eq("professor_id", professor.id)
    .maybeSingle();

  if (!link) redirect(`/linhas/${id}`);

  return (
    <div className="max-w-lg">
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Editar Linha de Pesquisa</p>
      <h1 className="font-display text-2xl text-ink mt-1">{line.name}</h1>

      <EditLinhaForm line={line} />
    </div>
  );
}
