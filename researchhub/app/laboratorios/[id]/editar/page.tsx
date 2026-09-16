import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentProfessor } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import EditLaboratorioForm from "./EditLaboratorioForm";

export const dynamic = "force-dynamic";

export default async function EditarLaboratorioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const professor = await getCurrentProfessor();
  if (!professor) redirect("/login");

  const supabase = await supabaseServer();

  const { data: lab } = await supabase
    .from("laboratories")
    .select("*")
    .eq("id", id)
    .single();

  if (!lab) notFound();

  const { data: link } = await supabase
    .from("professor_laboratories")
    .select("professor_id")
    .eq("laboratory_id", id)
    .eq("professor_id", professor.id)
    .maybeSingle();

  if (!link) redirect(`/laboratorios/${id}`);

  return (
    <div className="max-w-lg">
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Editar Laboratório</p>
      <h1 className="font-display text-2xl text-ink mt-1">{lab.name}</h1>

      <EditLaboratorioForm lab={lab} />
    </div>
  );
}
