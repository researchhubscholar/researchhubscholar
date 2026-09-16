import { getCurrentAdmin } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import UsersTable from "./UsersTable";

export const dynamic = "force-dynamic";

export default async function AdminUsuariosPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");

  const supabase = await supabaseServer();

  const { data: users } = await supabase
    .from("users")
    .select("id, name, email, role, status, department_id")
    .neq("role", "admin")
    .order("name");

  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .eq("university_id", admin.universityId)
    .order("name");

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Administrador</p>
      <h1 className="font-display text-2xl text-ink mt-1">Usuários — {admin.universityName}</h1>
      <p className="text-ink-soft mt-2">
        Promova a coordenador, rebaixe, ou suspenda uma conta. Não é
        possível gerenciar outra conta de administrador por aqui.
      </p>

      <UsersTable users={users ?? []} departments={departments ?? []} />
    </div>
  );
}
