import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentAppUser, getCurrentAdmin, getCurrentCoordinator } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import ImportarForm from "./ImportarForm";

export const dynamic = "force-dynamic";

export default async function ImportarProfessoresPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/login");

  const supabase = await supabaseServer();
  const { data: department } = await supabase
    .from("departments")
    .select("id, name, university_id")
    .eq("id", id)
    .single();

  if (!department) notFound();

  let allowed = false;

  if (appUser.role === "admin") {
    const admin = await getCurrentAdmin();
    allowed = admin?.universityId === department.university_id;
  } else if (appUser.role === "coordinator") {
    const coordinator = await getCurrentCoordinator();
    allowed = coordinator?.departmentId === id;
  }

  if (!allowed) redirect(`/departamentos/${id}`);

  return (
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Importação em massa</p>
      <h1 className="font-display text-2xl text-ink mt-1">Importar professores</h1>
      <p className="text-ink-soft mt-2">em {department.name}</p>

      <ImportarForm departmentId={id} />
    </div>
  );
}
