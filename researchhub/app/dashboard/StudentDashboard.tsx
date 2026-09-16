import EntityCard from "@/components/EntityCard";
import { STATUS_LABELS } from "@/lib/types";
import Link from "next/link";

type Project = { id: string; title: string; summary: string | null; status: string };
type Line = { id: string; name: string };
type Favorite = { eyebrow: string; title: string; subtitle?: string; href: string };

export default function StudentDashboard({
  projects,
  lines,
  favorites,
}: {
  projects: Project[];
  lines: Line[];
  favorites: Favorite[];
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Meu painel</p>
      <h1 className="font-display text-3xl text-ink mt-1">Seus projetos</h1>

      <section className="mt-8">
        {projects.length > 0 ? (
          projects.map((p) => (
            <EntityCard
              key={p.id}
              href={`/projetos/${p.id}`}
              eyebrow="Interesse manifestado"
              title={p.title}
              subtitle={p.summary}
              badge={{ label: STATUS_LABELS[p.status] ?? p.status, tone: p.status === "recruiting" ? "amber" : "teal" }}
            />
          ))
        ) : (
          <p className="text-sm text-ink-soft">
            Você ainda não manifestou interesse em nenhum projeto.{" "}
            <Link href="/buscar" className="text-teal hover:underline">
              Buscar projetos
            </Link>
          </p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">Favoritos</h2>
        {favorites.length > 0 ? (
          favorites.map((f, i) => (
            <EntityCard key={`${f.href}-${i}`} href={f.href} eyebrow={f.eyebrow} title={f.title} subtitle={f.subtitle} />
          ))
        ) : (
          <p className="text-sm text-ink-soft">
            Nada favoritado ainda. Clique no coração em qualquer professor,
            projeto, laboratório ou linha de pesquisa para salvar aqui.
          </p>
        )}
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium">Meus interesses</h2>
          <Link href="/onboarding" className="text-sm text-teal font-medium hover:underline">
            Ajustar
          </Link>
        </div>
        {lines.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {lines.map((l) => (
              <Link
                key={l.id}
                href={`/linhas/${l.id}`}
                className="text-sm px-3 py-1.5 rounded-full border border-line bg-white hover:border-teal hover:text-teal transition-colors text-ink-soft"
              >
                {l.name}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Nenhum interesse escolhido ainda.</p>
        )}
      </section>
    </div>
  );
}
