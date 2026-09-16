import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import CreateProfileForm from "./CreateProfileForm";

export const dynamic = "force-dynamic";

export default async function CriarPerfilPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/login");
  if (appUser.role !== "professor") redirect("/");

  const supabase = await supabaseServer();

  // Já tem perfil? manda direto pra lá.
  const { data: alreadyLinked } = await supabase
    .from("professors")
    .select("id")
    .eq("user_id", appUser.id)
    .maybeSingle();

  if (alreadyLinked) redirect(`/professores/${alreadyLinked.id}`);

  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .order("name");

  return (
    <div className="max-w-lg">
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Criar perfil</p>
      <h1 className="font-display text-2xl text-ink mt-1">Complete seu perfil de professor</h1>
      <p className="text-ink-soft mt-2">
        Escolha seu departamento e preencha as informações que vão aparecer
        no seu perfil público.
      </p>

      <CreateProfileForm
        userId={appUser.id}
        defaultName={appUser.name}
        defaultEmail={appUser.email}
        departments={departments ?? []}
      />

      {(!departments || departments.length === 0) && (
        <p className="text-sm text-ink-soft mt-6">
          Nenhum departamento cadastrado ainda. Fale com a administração da
          sua universidade para que o departamento seja criado primeiro.
        </p>
      )}
    </div>
  );
}
