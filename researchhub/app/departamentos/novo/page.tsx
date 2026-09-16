import { getCurrentAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import NovoDepartamentoForm from "./NovoDepartamentoForm";

export const dynamic = "force-dynamic";

export default async function NovoDepartamentoPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  return (
    <div className="max-w-lg">
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Novo Departamento</p>
      <h1 className="font-display text-2xl text-ink mt-1">Cadastrar departamento</h1>
      <p className="text-ink-soft mt-2">em {admin.universityName}</p>

      <NovoDepartamentoForm universityId={admin.universityId} />
    </div>
  );
}
