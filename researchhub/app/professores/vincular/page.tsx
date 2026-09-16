import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import ClaimForm from "./ClaimForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function VincularPage() {
  const appUser = await getCurrentAppUser();

  if (!appUser) redirect("/login");
  if (appUser.role !== "professor") redirect("/");

  const supabase = await supabaseServer();

  // Já vinculado? manda direto pro perfil.
  const { data: alreadyLinked } = await supabase
    .from("professors")
    .select("id")
    .eq("user_id", appUser.id)
    .maybeSingle();

  if (alreadyLinked) redirect(`/professores/${alreadyLinked.id}`);

  const { data: unclaimedProfessors } = await supabase
    .from("professors")
    .select("id, name, specialty")
    .is("user_id", null);

  const hasUnclaimed = unclaimedProfessors && unclaimedProfessors.length > 0;

  return (
    <div className="max-w-lg">
      <h1 className="font-display text-2xl text-ink">Encontre seu perfil</h1>
      <p className="text-ink-soft mt-2">
        {hasUnclaimed
          ? "Se seu departamento já cadastrou você, selecione seu nome abaixo para vincular à sua conta."
          : "Nenhum perfil pré-cadastrado encontrado no seu departamento."}
      </p>

      {hasUnclaimed && <ClaimForm professors={unclaimedProfessors!} />}

      <div className={hasUnclaimed ? "mt-8 pt-6 border-t border-line" : "mt-6"}>
        <p className="text-sm text-ink-soft">
          {hasUnclaimed ? "Não encontrou seu nome?" : "Sem problema —"}{" "}
          <Link href="/professores/criar" className="text-teal font-medium hover:underline">
            Criar meu perfil do zero
          </Link>
        </p>
      </div>
    </div>
  );
}
