"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function signOutAction() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

// Retorna o usuário logado (da tabela `users`, já com o papel/role)
// ou null se ninguém estiver logado. Usado pelo header e por páginas
// que precisam checar dono/permissão.
//
// Também é "auto-curativo": se a pessoa está autenticada no Supabase Auth
// mas ainda não tem registro em `users` (isso acontece com "Confirm email"
// ligado — a sessão só existe depois de clicar no link, numa página
// diferente de onde o cadastro foi preenchido), cria o registro aqui,
// lendo nome/papel salvos nos metadados do usuário no momento do cadastro.
export async function getCurrentAppUser() {
  const supabase = await supabaseServer();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: existing } = await supabase
    .from("users")
    .select("id, name, email, role, department_id, status")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (existing) return existing;

  const metadata = (authUser.user_metadata ?? {}) as { name?: string; role?: string };
  const name = metadata.name?.trim() || authUser.email?.split("@")[0] || "Usuário";
  const role =
    metadata.role === "professor" || metadata.role === "coordinator" ? metadata.role : "student";

  const { data: created } = await supabase
    .from("users")
    .insert({ auth_user_id: authUser.id, name, email: authUser.email!, role })
    .select("id, name, email, role, department_id, status")
    .single();

  if (created && role === "student") {
    await supabase.from("students").insert({ user_id: created.id });
  }

  return created ?? null;
}

// Retorna o registro de `students` do usuário logado (ou null se não for
// aluno / não estiver logado). Usado no onboarding e na home personalizada.
export async function getCurrentStudent() {
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "student") return null;

  const supabase = await supabaseServer();
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", appUser.id)
    .single();

  return student ?? null;
}

// Retorna o registro de `professors` do usuário logado (ou null se não for
// professor / não estiver logado / ainda não vinculou o perfil).
export async function getCurrentProfessor() {
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "professor") return null;

  const supabase = await supabaseServer();
  const { data: professor } = await supabase
    .from("professors")
    .select("id, name, department_id")
    .eq("user_id", appUser.id)
    .maybeSingle();

  return professor ?? null;
}

// Retorna { departmentId, departmentName } se a pessoa logada for
// coordenador com departamento já definido, ou null caso contrário
// (não logado, não é coordenador, ou ainda não escolheu o departamento).
export async function getCurrentCoordinator() {
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "coordinator") return null;
  if (!appUser.department_id) return { departmentId: null, departmentName: null };

  const supabase = await supabaseServer();
  const { data: department } = await supabase
    .from("departments")
    .select("name")
    .eq("id", appUser.department_id)
    .maybeSingle();

  return { departmentId: appUser.department_id, departmentName: department?.name ?? null };
}

// Retorna { universityId, universityName } se a pessoa logada for
// admin e dona de uma universidade (fluxo de setup inicial), ou null.
export async function getCurrentAdmin() {
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") return null;

  const supabase = await supabaseServer();
  const { data: university } = await supabase
    .from("universities")
    .select("id, name")
    .eq("owner_user_id", appUser.id)
    .maybeSingle();

  if (!university) return null;
  return { universityId: university.id, universityName: university.name };
}
