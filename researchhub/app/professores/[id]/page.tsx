import { supabaseServer } from "@/lib/supabase/server";
import EntityCard from "@/components/EntityCard";
import SaveButton from "@/components/SaveButton";
import { STATUS_LABELS } from "@/lib/types";
import { getCurrentAppUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProfessorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const appUser = await getCurrentAppUser();

  const { data: professor } = await supabase
    .from("professors")
    .select("*")
    .eq("id", id)
    .single();

  if (!professor) notFound();

  const isOwner = appUser?.role === "professor" && professor.user_id === appUser.id;

  const { data: department } = await supabase
    .from("departments")
    .select("id, name")
    .eq("id", professor.department_id)
    .maybeSingle();

  let alreadySaved = false;
  if (appUser) {
    const { data: existing } = await supabase
      .from("saved_items")
      .select("user_id")
      .eq("user_id", appUser.id)
      .eq("entity_type", "professor")
      .eq("entity_id", id)
      .maybeSingle();
    alreadySaved = !!existing;
  }

  const { data: linesJoin } = await supabase
    .from("professor_research_lines")
    .select("research_lines(id, name, description, keywords)")
    .eq("professor_id", id);

  const { data: labsJoin } = await supabase
    .from("professor_laboratories")
    .select("role, laboratories(id, name, description)")
    .eq("professor_id", id);

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, summary, status, accepting_students, keywords")
    .eq("lead_professor_id", id);

  const { data: pubsJoin } = await supabase
    .from("publication_authors")
    .select("publications(id, title, year, journal)")
    .eq("professor_id", id);

  const lines = (linesJoin ?? []).map((j: any) => j.research_lines).filter(Boolean);
  const labs = (labsJoin ?? []).map((j: any) => ({ ...j.laboratories, role: j.role })).filter(Boolean);
  const publications = (pubsJoin ?? []).map((j: any) => j.publications).filter(Boolean);

  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-teal font-medium">Professor</p>
          <h1 className="font-display text-3xl text-ink mt-1">{professor.name}</h1>
          {professor.specialty && <p className="text-ink-soft mt-1">{professor.specialty}</p>}
          {department && (
            <Link href={`/departamentos/${department.id}`} className="text-sm text-teal hover:underline mt-1 inline-block">
              {department.name}
            </Link>
          )}
        </div>
        {professor.accepting_students && (
          <span className="text-xs px-3 py-1 rounded-full bg-teal-soft text-teal font-medium whitespace-nowrap">
            Aceita orientandos
          </span>
        )}
      </div>

      {isOwner && (
        <Link
          href={`/professores/${professor.id}/editar`}
          className="inline-block mt-4 text-sm text-teal font-medium hover:underline"
        >
          Editar meu perfil
        </Link>
      )}

      {professor.bio && <p className="text-ink-soft mt-6 max-w-2xl leading-relaxed">{professor.bio}</p>}

      <div className="mt-4">
        <SaveButton entityType="professor" entityId={id} userId={appUser?.id ?? null} initialSaved={alreadySaved} />
      </div>

      <div className="flex gap-4 mt-6 text-sm">
        {professor.email && (
          <a href={`mailto:${professor.email}`} className="text-teal font-medium hover:underline">
            Entrar em contato
          </a>
        )}
        {professor.lattes_url && (
          <a href={professor.lattes_url} target="_blank" className="text-ink-soft hover:text-teal">
            Currículo Lattes
          </a>
        )}
      </div>

      {(lines.length > 0 || isOwner) && (
        <section className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium">Linhas de Pesquisa</h2>
            {isOwner && (
              <Link href="/linhas/novo" className="text-sm text-teal font-medium hover:underline">
                + Nova linha
              </Link>
            )}
          </div>
          {lines.map((l: any) => (
            <EntityCard
              key={l.id}
              href={`/linhas/${l.id}`}
              eyebrow="Linha de Pesquisa"
              title={l.name}
              subtitle={l.description}
              tags={l.keywords}
              secondaryHref={isOwner ? `/linhas/${l.id}/editar` : undefined}
            />
          ))}
          {isOwner && lines.length === 0 && (
            <p className="text-sm text-ink-soft">Você ainda não está vinculado a nenhuma linha de pesquisa.</p>
          )}
        </section>
      )}

      {(labs.length > 0 || isOwner) && (
        <section className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium">Laboratórios</h2>
            {isOwner && (
              <Link href="/laboratorios/novo" className="text-sm text-teal font-medium hover:underline">
                + Novo laboratório
              </Link>
            )}
          </div>
          {labs.map((l: any) => (
            <EntityCard
              key={l.id}
              href={`/laboratorios/${l.id}`}
              eyebrow="Laboratório"
              title={l.name}
              subtitle={l.role}
              secondaryHref={isOwner ? `/laboratorios/${l.id}/editar` : undefined}
            />
          ))}
          {isOwner && labs.length === 0 && (
            <p className="text-sm text-ink-soft">Você ainda não está vinculado a nenhum laboratório.</p>
          )}
        </section>
      )}

      {(projects && projects.length > 0) || isOwner ? (
        <section className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium">Projetos</h2>
            {isOwner && (
              <Link href="/projetos/novo" className="text-sm text-teal font-medium hover:underline">
                + Novo projeto
              </Link>
            )}
          </div>
          {(projects ?? []).map((p: any) => (
            <EntityCard
              key={p.id}
              href={`/projetos/${p.id}`}
              eyebrow="Projeto"
              title={p.title}
              subtitle={p.summary}
              tags={p.keywords}
              badge={{ label: STATUS_LABELS[p.status] ?? p.status, tone: p.status === "recruiting" ? "amber" : "teal" }}
              secondaryHref={isOwner ? `/projetos/${p.id}/editar` : undefined}
            />
          ))}
          {isOwner && (!projects || projects.length === 0) && (
            <p className="text-sm text-ink-soft">Você ainda não cadastrou nenhum projeto.</p>
          )}
        </section>
      ) : null}

      {(publications.length > 0 || isOwner) && (
        <section className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium">Publicações</h2>
            {isOwner && (
              <Link href="/publicacoes/novo" className="text-sm text-teal font-medium hover:underline">
                + Nova publicação
              </Link>
            )}
          </div>
          {publications.map((p: any) => (
            <EntityCard
              key={p.id}
              href={`/publicacoes/${p.id}`}
              eyebrow="Publicação"
              title={p.title}
              subtitle={[p.journal, p.year].filter(Boolean).join(" · ")}
            />
          ))}
          {isOwner && publications.length === 0 && (
            <p className="text-sm text-ink-soft">Você ainda não cadastrou nenhuma publicação.</p>
          )}
        </section>
      )}
    </div>
  );
}
