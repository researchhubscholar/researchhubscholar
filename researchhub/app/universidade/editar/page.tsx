import { getCurrentAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import EditUniversidadeForm from "./EditUniversidadeForm";

export const dynamic = "force-dynamic";

export default async function EditarUniversidadePage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  const supabase = await supabaseServer();
  const { data: university } = await supabase
    .from("universities")
    .select("*")
    .eq("id", admin.universityId)
    .single();

  if (!university) redirect("/dashboard");

  return (
    <div className="max-w-lg">
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Administrador</p>
      <h1 className="font-display text-2xl text-ink mt-1">Dados da universidade</h1>

      <EditUniversidadeForm university={university} />
    </div>
  );
}
