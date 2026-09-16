import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentAppUser, getCurrentStudent } from "@/lib/auth";
import { redirect } from "next/navigation";
import InterestsForm from "./InterestsForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/login");
  if (appUser.role !== "student") redirect("/");

  const student = await getCurrentStudent();
  if (!student) redirect("/");

  const supabase = await supabaseServer();

  const { data: lines } = await supabase
    .from("research_lines")
    .select("id, name, description")
    .eq("active", true);

  const { data: existingInterests } = await supabase
    .from("interests")
    .select("research_line_id")
    .eq("student_id", student.id);

  const selectedIds = (existingInterests ?? []).map((i) => i.research_line_id);

  return (
    <div className="max-w-lg">
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Bem-vindo(a)</p>
      <h1 className="font-display text-2xl text-ink mt-1">Sobre o que você gostaria de pesquisar?</h1>
      <p className="text-ink-soft mt-2">
        Escolha uma ou mais áreas. Vamos usar isso para destacar professores,
        laboratórios e projetos relevantes para você.
      </p>

      <InterestsForm
        studentId={student.id}
        lines={lines ?? []}
        initialSelectedIds={selectedIds}
      />
    </div>
  );
}
