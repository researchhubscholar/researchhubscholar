import { getCurrentProfessor } from "@/lib/auth";
import { redirect } from "next/navigation";
import NovaLinhaForm from "./NovaLinhaForm";

export const dynamic = "force-dynamic";

export default async function NovaLinhaPage() {
  const professor = await getCurrentProfessor();
  if (!professor) redirect("/login");

  return (
    <div className="max-w-lg">
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Nova Linha de Pesquisa</p>
      <h1 className="font-display text-2xl text-ink mt-1">Cadastrar linha de pesquisa</h1>
      <p className="text-ink-soft mt-2">
        Você será vinculado automaticamente a essa linha assim que criá-la.
      </p>

      <NovaLinhaForm professorId={professor.id} departmentId={professor.department_id} />
    </div>
  );
}
