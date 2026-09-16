import { supabaseServer } from "@/lib/supabase/server";
import EntityCard from "@/components/EntityCard";
import { getCurrentAppUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  artigo: "Artigo",
  resumo: "Resumo de congresso",
  capitulo: "Capítulo de livro",
  dissertacao: "Dissertação",
  tese: "Tese",
};

export default async function PublicacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const appUser = await getCurrentAppUser();

  const { data: publication } = await supabase
    .from("publications")
    .select("*")
    .eq("id", id)
    .single();

  if (!publication) notFound();

  const { data: authorsJoin } = await supabase
    .from("publication_authors")
    .select("professor_id, professors(id, name)")
    .eq("publication_id", id);

  const { data: projectsJoin } = await supabase
    .from("publication_projects")
    .select("projects(id, title)")
    .eq("publication_id", id);

  const authors = (authorsJoin ?? []).map((j: any) => j.professors).filter(Boolean);
  const projects = (projectsJoin ?? []).map((j: any) => j.projects).filter(Boolean);

  // Checa autoria de verdade comparando com o professor logado.
  let isOwnerAuthor = false;
  if (appUser?.role === "professor") {
    const { data: myProfessor } = await supabase
      .from("professors")
      .select("id")
      .eq("user_id", appUser.id)
      .maybeSingle();
    if (myProfessor) {
      isOwnerAuthor = (authorsJoin ?? []).some((j: any) => j.professor_id === myProfessor.id);
    }
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-teal font-medium">
        {TYPE_LABELS[publication.publication_type] ?? "Publicação"}
      </p>
      <h1 className="font-display text-3xl text-ink mt-1">{publication.title}</h1>

      <p className="text-ink-soft mt-2">
        {authors.map((a: any) => a.name).join(", ")}
        {publication.year && ` · ${publication.year}`}
        {publication.journal && ` · ${publication.journal}`}
      </p>

      {isOwnerAuthor && (
        <Link
          href={`/publicacoes/${id}/editar`}
          className="inline-block mt-4 text-sm text-teal font-medium hover:underline"
        >
          Editar publicação
        </Link>
      )}

      {publication.abstract && (
        <p className="text-ink-soft mt-6 max-w-2xl leading-relaxed">{publication.abstract}</p>
      )}

      {publication.keywords && publication.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {publication.keywords.map((k: string) => (
            <span key={k} className="text-xs font-mono text-ink-soft bg-white border border-line px-2 py-0.5 rounded-full">
              {k}
            </span>
          ))}
        </div>
      )}

      {publication.doi && (
        <a
          href={`https://doi.org/${publication.doi}`}
          target="_blank"
          className="inline-block mt-4 text-sm text-teal hover:underline"
        >
          DOI: {publication.doi}
        </a>
      )}

      <section className="mt-12 space-y-4">
        <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">Conexões</h2>
        {authors.map((a: any) => (
          <EntityCard key={a.id} href={`/professores/${a.id}`} eyebrow="Autor" title={a.name} />
        ))}
        {projects.map((p: any) => (
          <EntityCard key={p.id} href={`/projetos/${p.id}`} eyebrow="Projeto" title={p.title} />
        ))}
      </section>
    </div>
  );
}
