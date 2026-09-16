import { supabaseServer } from "@/lib/supabase/server";
import EntityCard from "@/components/EntityCard";
import SaveButton from "@/components/SaveButton";
import { STATUS_LABELS } from "@/lib/types";
import { getCurrentAppUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import ManifestInterestButton from "./ManifestInterestButton";

export const dynamic = "force-dynamic";

export default async function ProjetoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const appUser = await getCurrentAppUser();

  const { data: project } = await supabase
    .from("projects")
    .select("*, research_lines(id, name), laboratories(id, name), professors!projects_lead_professor_id_fkey(id, name, email, accepting_students, user_id)")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const line = (project as any).research_lines;
  const lab = (project as any).laboratories;
  const professor = (project as any).professors;

  const isOwner = appUser?.role === "professor" && professor?.user_id === appUser.id;
  const isStudent = appUser?.role === "student";

  let alreadyInterested = false;
  if (isStudent && appUser) {
    const { data: existing } = await supabase
      .from("project_members")
      .select("id")
      .eq("project_id", id)
      .eq("user_id", appUser.id)
      .maybeSingle();
    alreadyInterested = !!existing;
  }

  let alreadySaved = false;
  if (appUser) {
    const { data: existing } = await supabase
      .from("saved_items")
      .select("user_id")
      .eq("user_id", appUser.id)
      .eq("entity_type", "project")
      .eq("entity_id", id)
      .maybeSingle();
    alreadySaved = !!existing;
  }

  const { data: pubsJoin } = await supabase
    .from("publication_projects")
    .select("publications(id, title, year, journal)")
    .eq("project_id", id);

  const publications = (pubsJoin ?? []).map((j: any) => j.publications).filter(Boolean);

  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-teal font-medium">Projeto</p>
          <h1 className="font-display text-3xl text-ink mt-1">{project.title}</h1>
        </div>
        <span
          className={`text-xs px-3 py-1 rounded-full font-medium whitespace-nowrap ${
            project.status === "recruiting" ? "bg-amber-soft text-amber" : "bg-teal-soft text-teal"
          }`}
        >
          {STATUS_LABELS[project.status] ?? project.status}
        </span>
      </div>

      {isOwner && (
        <Link
          href={`/projetos/${project.id}/editar`}
          className="inline-block mt-4 text-sm text-teal font-medium hover:underline"
        >
          Editar projeto e ver interessados
        </Link>
      )}

      {project.summary && <p className="text-ink-soft mt-6 max-w-2xl leading-relaxed">{project.summary}</p>}

      {project.keywords && project.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {project.keywords.map((k: string) => (
            <span key={k} className="text-xs font-mono text-ink-soft bg-white border border-line px-2 py-0.5 rounded-full">
              {k}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4">
        <SaveButton entityType="project" entityId={id} userId={appUser?.id ?? null} initialSaved={alreadySaved} />
      </div>

      <div className="flex gap-6 mt-4 text-sm text-ink-soft">
        {project.accepting_students && <span>✓ Aceita alunos</span>}
        {project.scholarship_available && <span>✓ Bolsa disponível</span>}
      </div>

      {/* Manifestar interesse: só para quem NÃO é o dono do projeto */}
      {project.accepting_students && !isOwner && (
        <>
          {isStudent && appUser ? (
            <ManifestInterestButton
              projectId={project.id}
              appUserId={appUser.id}
              alreadyInterested={alreadyInterested}
            />
          ) : !appUser ? (
            <Link
              href="/login"
              className="inline-block mt-6 bg-teal text-white text-sm font-medium px-5 py-2.5 rounded-card hover:bg-teal/90 transition-colors"
            >
              Entrar para manifestar interesse
            </Link>
          ) : null}
        </>
      )}

      <section className="mt-12 space-y-4">
        <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">Conexões</h2>
        {professor && (
          <EntityCard href={`/professores/${professor.id}`} eyebrow="Professor Responsável" title={professor.name} />
        )}
        {line && (
          <EntityCard href={`/linhas/${line.id}`} eyebrow="Linha de Pesquisa" title={line.name} />
        )}
        {lab && (
          <EntityCard href={`/laboratorios/${lab.id}`} eyebrow="Laboratório" title={lab.name} />
        )}
        {publications.map((p: any) => (
          <EntityCard key={p.id} href={`/publicacoes/${p.id}`} eyebrow="Publicação" title={p.title} subtitle={[p.journal, p.year].filter(Boolean).join(" · ")} />
        ))}
      </section>
    </div>
  );
}
