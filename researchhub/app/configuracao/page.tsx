import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function ConfiguracaoPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/login");

  const supabase = await supabaseServer();
  const { count } = await supabase
    .from("universities")
    .select("id", { count: "exact", head: true });

  // Já existe uma universidade nessa instância — o setup só roda uma vez.
  if (count && count > 0) redirect("/");

  return (
    <div className="max-w-lg">
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Configuração inicial</p>
      <h1 className="font-display text-2xl text-ink mt-1">Configure sua universidade</h1>
      <p className="text-ink-soft mt-2">
        Essa é a primeira configuração dessa instância do ResearchHub. Você
        se tornará o administrador da universidade.
      </p>

      <SetupForm userId={appUser.id} />
    </div>
  );
}
