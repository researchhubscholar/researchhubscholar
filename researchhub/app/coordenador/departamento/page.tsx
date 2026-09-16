import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import DepartmentForm from "./DepartmentForm";

export const dynamic = "force-dynamic";

export default async function CoordenadorDepartamentoPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/login");
  if (appUser.role !== "coordinator") redirect("/");

  if (appUser.department_id) redirect("/dashboard");

  const supabase = await supabaseServer();
  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .order("name");

  return (
    <div className="max-w-lg">
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Coordenador</p>
      <h1 className="font-display text-2xl text-ink mt-1">Qual departamento você coordena?</h1>
      <p className="text-ink-soft mt-2">
        Você vai aprovar ou rejeitar projetos enviados pelos professores
        desse departamento.
      </p>

      <DepartmentForm departments={departments ?? []} />

      {(!departments || departments.length === 0) && (
        <p className="text-sm text-ink-soft mt-6">
          Nenhum departamento cadastrado ainda. Fale com a administração da
          sua universidade.
        </p>
      )}
    </div>
  );
}
