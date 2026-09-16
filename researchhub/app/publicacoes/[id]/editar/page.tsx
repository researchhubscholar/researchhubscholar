import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentProfessor } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import EditPublicacaoForm from "./EditPublicacaoForm";

export const dynamic = "force-dynamic";

export default async function EditarPublicacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const professor = await getCurrentProfessor();
  if (!professor) redirect("/login");

  const supabase = await supabaseServer();

  const { data: publication } = await supabase
    .from("publications")
    .select("*")
    .eq("id", id)
    .single();

  if (!publication) notFound();

  const { data: authorLink } = await supabase
    .from("publication_authors")
    .select("professor_id")
    .eq("publication_id", id)
    .eq("professor_id", professor.id)
    .maybeSingle();

  if (!authorLink) redirect(`/publicacoes/${id}`);

  return (
    <div className="max-w-lg">
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Editar Publicação</p>
      <h1 className="font-display text-2xl text-ink mt-1">{publication.title}</h1>

      <EditPublicacaoForm publication={publication} />
    </div>
  );
}
