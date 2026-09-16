import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import EditForm from "./EditForm";

export const dynamic = "force-dynamic";

export default async function EditarProfessorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/login");

  const supabase = await supabaseServer();
  const { data: professor } = await supabase
    .from("professors")
    .select("*")
    .eq("id", id)
    .single();

  if (!professor) notFound();

  // Só o dono do perfil pode editar.
  if (professor.user_id !== appUser.id) redirect(`/professores/${id}`);

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-2xl text-ink">Editar perfil</h1>
      <p className="text-ink-soft mt-2">Essas informações aparecem no seu perfil público.</p>
      <EditForm professor={professor} />
    </div>
  );
}
