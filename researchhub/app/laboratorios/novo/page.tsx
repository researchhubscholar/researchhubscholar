import { getCurrentProfessor } from "@/lib/auth";
import { redirect } from "next/navigation";
import NovoLaboratorioForm from "./NovoLaboratorioForm";

export const dynamic = "force-dynamic";

export default async function NovoLaboratorioPage() {
  const professor = await getCurrentProfessor();
  if (!professor) redirect("/login");

  return (
    <div className="max-w-lg">
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Novo Laboratório</p>
      <h1 className="font-display text-2xl text-ink mt-1">Cadastrar laboratório</h1>
      <p className="text-ink-soft mt-2">
        Você será vinculado automaticamente a esse laboratório assim que criá-lo.
      </p>

      <NovoLaboratorioForm professorId={professor.id} departmentId={professor.department_id} />
    </div>
  );
}
