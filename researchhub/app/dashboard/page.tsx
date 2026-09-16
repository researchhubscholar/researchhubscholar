import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentAppUser, getCurrentStudent, getCurrentProfessor, getCurrentCoordinator, getCurrentAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import StudentDashboard from "./StudentDashboard";
import ProfessorDashboard from "./ProfessorDashboard";
import CoordinatorDashboard from "./CoordinatorDashboard";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const appUser = await getCurrentAppUser();
  if (!appUser) redirect("/login");

  const supabase = await supabaseServer();

  if (appUser.role === "student") {
    const student = await getCurrentStudent();
    if (!student) redirect("/");

    const { data: interestRows } = await supabase
      .from("project_members")
      .select("created_at, projects(id, title, summary, status)")
      .eq("user_id", appUser.id)
      .order("created_at", { ascending: false });

    const { data: interestLines } = await supabase
      .from("interests")
      .select("research_lines(id, name)")
      .eq("student_id", student.id);

    const projects = (interestRows ?? [])
      .map((r: any) => r.projects)
      .filter(Boolean);

    const lines = (interestLines ?? []).map((r: any) => r.research_lines).filter(Boolean);

    const { data: savedRows } = await supabase
      .from("saved_items")
      .select("entity_type, entity_id, created_at")
      .eq("user_id", appUser.id)
      .order("created_at", { ascending: false });

    const favorites = await resolveFavorites(supabase, savedRows ?? []);

    return <StudentDashboard projects={projects} lines={lines} favorites={favorites} />;
  }

  if (appUser.role === "professor") {
    const professor = await getCurrentProfessor();
    if (!professor) redirect("/professores/vincular");

    const { data: projects } = await supabase
      .from("projects")
      .select("id, title, status, accepting_students")
      .eq("lead_professor_id", professor.id)
      .order("created_at", { ascending: false });

    const projectIds = (projects ?? []).map((p) => p.id);

    let members: any[] = [];
    if (projectIds.length > 0) {
      const { data } = await supabase
        .from("project_members")
        .select("id, created_at, project_id, users(name, email), projects(title)")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false });
      members = data ?? [];
    }

    const countsByProject = new Map<string, number>();
    for (const m of members) {
      countsByProject.set(m.project_id, (countsByProject.get(m.project_id) ?? 0) + 1);
    }

    return (
      <ProfessorDashboard
        professorName={professor.name}
        projects={projects ?? []}
        countsByProject={Object.fromEntries(countsByProject)}
        recentMembers={members.slice(0, 10)}
      />
    );
  }

  if (appUser.role === "coordinator") {
    const coordinator = await getCurrentCoordinator();
    if (!coordinator || !coordinator.departmentId) redirect("/coordenador/departamento");

    // Projetos do departamento: para achar, primeiro pegamos os
    // professores do departamento, depois os projetos deles.
    const { data: departmentProfessors } = await supabase
      .from("professors")
      .select("id")
      .eq("department_id", coordinator.departmentId);

    const professorIds = (departmentProfessors ?? []).map((p) => p.id);
    const professorCount = professorIds.length;

    let allProjects: any[] = [];
    let pendingProjects: any[] = [];
    let statusCounts: Record<string, number> = {};
    let publicationCount = 0;
    let totalInterests = 0;
    let recentInterests: any[] = [];

    if (professorIds.length > 0) {
      const { data: projects } = await supabase
        .from("projects")
        .select("id, title, summary, status, professors!projects_lead_professor_id_fkey(name)")
        .in("lead_professor_id", professorIds)
        .order("created_at", { ascending: false });

      allProjects = projects ?? [];
      pendingProjects = allProjects.filter((p) => p.status === "in_review");

      for (const p of allProjects) {
        statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
      }

      const { count: pubCount } = await supabase
        .from("publication_authors")
        .select("publication_id", { count: "exact", head: true })
        .in("professor_id", professorIds);
      publicationCount = pubCount ?? 0;

      const projectIds = allProjects.map((p) => p.id);
      if (projectIds.length > 0) {
        const { count } = await supabase
          .from("project_members")
          .select("id", { count: "exact", head: true })
          .in("project_id", projectIds);
        totalInterests = count ?? 0;

        const { data: recent } = await supabase
          .from("project_members")
          .select("id, created_at, users(name), projects(title)")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false })
          .limit(10);
        recentInterests = recent ?? [];
      }
    }

    const publishedCount = allProjects.filter((p) =>
      ["published", "recruiting", "ongoing", "completed"].includes(p.status)
    ).length;

    return (
      <CoordinatorDashboard
        departmentName={coordinator.departmentName ?? ""}
        pendingProjects={pendingProjects}
        publishedCount={publishedCount}
        professorCount={professorCount}
        projectCount={allProjects.length}
        publicationCount={publicationCount}
        totalInterests={totalInterests}
        recentInterests={recentInterests.map((r: any) => ({
          id: r.id,
          studentName: r.users?.name ?? "",
          projectTitle: r.projects?.title ?? "",
        }))}
      />
    );
  }

  if (appUser.role === "admin") {
    const admin = await getCurrentAdmin();
    if (!admin) redirect("/configuracao");

    const { data: departments } = await supabase
      .from("departments")
      .select("id, name, description")
      .eq("university_id", admin.universityId)
      .order("name");

    const departmentIds = (departments ?? []).map((d) => d.id);

    const { data: professors } = departmentIds.length
      ? await supabase.from("professors").select("id, department_id").in("department_id", departmentIds)
      : { data: [] as { id: string; department_id: string }[] };

    const professorIds = (professors ?? []).map((p) => p.id);
    const professorToDept = new Map((professors ?? []).map((p) => [p.id, p.department_id]));

    const { data: projects } = professorIds.length
      ? await supabase
          .from("projects")
          .select("id, title, status, lead_professor_id, professors!projects_lead_professor_id_fkey(name)")
          .in("lead_professor_id", professorIds)
      : { data: [] as any[] };

    // Contagens por departamento (professores e projetos).
    const deptStats = new Map<string, { professors: number; projects: number }>();
    for (const d of departments ?? []) deptStats.set(d.id, { professors: 0, projects: 0 });
    for (const p of professors ?? []) {
      const stat = deptStats.get(p.department_id);
      if (stat) stat.professors += 1;
    }
    for (const proj of projects ?? []) {
      const deptId = professorToDept.get(proj.lead_professor_id);
      const stat = deptId ? deptStats.get(deptId) : undefined;
      if (stat) stat.projects += 1;
    }

    const departmentsWithStats = (departments ?? []).map((d) => ({
      ...d,
      professorCount: deptStats.get(d.id)?.professors ?? 0,
      projectCount: deptStats.get(d.id)?.projects ?? 0,
    }));

    // Quebra de status (quantos rascunho, em revisão, recrutando etc).
    const statusCounts: Record<string, number> = {};
    for (const proj of projects ?? []) {
      statusCounts[proj.status] = (statusCounts[proj.status] ?? 0) + 1;
    }

    const pendingProjects = (projects ?? [])
      .filter((p: any) => p.status === "in_review")
      .map((p: any) => ({ id: p.id, title: p.title, professorName: p.professors?.name ?? "" }));

    const [{ count: studentCount }, { count: coordinatorCount }, { count: publicationCount }] =
      await Promise.all([
        supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "coordinator"),
        supabase.from("publications").select("id", { count: "exact", head: true }),
      ]);

    const projectIds = (projects ?? []).map((p) => p.id);

    let totalInterests = 0;
    let recentInterests: any[] = [];
    if (projectIds.length > 0) {
      const { count } = await supabase
        .from("project_members")
        .select("id", { count: "exact", head: true })
        .in("project_id", projectIds);
      totalInterests = count ?? 0;

      const { data: recent } = await supabase
        .from("project_members")
        .select("id, created_at, users(name), projects(title)")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
        .limit(10);
      recentInterests = recent ?? [];
    }

    return (
      <AdminDashboard
        universityName={admin.universityName}
        departments={departmentsWithStats}
        professorCount={(professors ?? []).length}
        projectCount={(projects ?? []).length}
        studentCount={studentCount ?? 0}
        coordinatorCount={coordinatorCount ?? 0}
        publicationCount={publicationCount ?? 0}
        totalInterests={totalInterests}
        statusCounts={statusCounts}
        pendingProjects={pendingProjects}
        recentInterests={recentInterests.map((r: any) => ({
          id: r.id,
          studentName: r.users?.name ?? "",
          projectTitle: r.projects?.title ?? "",
          createdAt: r.created_at,
        }))}
      />
    );
  }

  redirect("/");
}

// Favoritos são guardados de forma genérica (entity_type + entity_id,
// sem FK) para caber qualquer tipo de entidade numa tabela só. Isso
// significa que resolver os detalhes (nome, link) exige uma consulta
// separada por tipo, depois remontamos tudo numa lista única ordenada
// pela data em que foi salvo.
async function resolveFavorites(
  supabase: Awaited<ReturnType<typeof supabaseServer>>,
  savedRows: { entity_type: string; entity_id: string; created_at: string }[]
) {
  const idsByType: Record<string, string[]> = {
    professor: [],
    project: [],
    laboratory: [],
    research_line: [],
  };
  for (const row of savedRows) {
    idsByType[row.entity_type]?.push(row.entity_id);
  }

  const [professors, projects, laboratories, researchLines] = await Promise.all([
    supabase.from("professors").select("id, name, specialty").in("id", idsByType.professor),
    supabase.from("projects").select("id, title, status").in("id", idsByType.project),
    supabase.from("laboratories").select("id, name").in("id", idsByType.laboratory),
    supabase.from("research_lines").select("id, name").in("id", idsByType.research_line),
  ]);

  const lookup = new Map<string, { eyebrow: string; title: string; subtitle?: string; href: string }>();
  for (const p of professors.data ?? []) {
    lookup.set(`professor:${p.id}`, { eyebrow: "Professor", title: p.name, subtitle: p.specialty ?? undefined, href: `/professores/${p.id}` });
  }
  for (const p of projects.data ?? []) {
    lookup.set(`project:${p.id}`, { eyebrow: "Projeto", title: p.title, href: `/projetos/${p.id}` });
  }
  for (const l of laboratories.data ?? []) {
    lookup.set(`laboratory:${l.id}`, { eyebrow: "Laboratório", title: l.name, href: `/laboratorios/${l.id}` });
  }
  for (const l of researchLines.data ?? []) {
    lookup.set(`research_line:${l.id}`, { eyebrow: "Linha de Pesquisa", title: l.name, href: `/linhas/${l.id}` });
  }

  return savedRows
    .map((row) => lookup.get(`${row.entity_type}:${row.entity_id}`))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}
