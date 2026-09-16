import { STATUS_LABELS } from "@/lib/types";
import Link from "next/link";

type Project = { id: string; title: string; status: string; accepting_students: boolean };
type Member = {
  id: string;
  created_at: string;
  project_id: string;
  users: { name: string; email: string } | null;
  projects: { title: string } | null;
};

export default function ProfessorDashboard({
  professorName,
  projects,
  countsByProject,
  recentMembers,
}: {
  professorName: string;
  projects: Project[];
  countsByProject: Record<string, number>;
  recentMembers: Member[];
}) {
  const totalInterested = Object.values(countsByProject).reduce((a, b) => a + b, 0);

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Meu painel</p>
      <h1 className="font-display text-3xl text-ink mt-1">Olá, {professorName.split(" ")[0]}</h1>

      <div className="flex gap-6 mt-6 text-sm text-ink-soft border-y border-line py-3">
        <span>{projects.length} projetos</span>
        <span>{totalInterested} pessoas interessadas no total</span>
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium">Seus projetos</h2>
          <Link href="/projetos/novo" className="text-sm text-teal font-medium hover:underline">
            + Novo projeto
          </Link>
        </div>

        {projects.length > 0 ? (
          <div className="space-y-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projetos/${p.id}/editar`}
                className="flex items-center justify-between border border-line rounded-card px-4 py-3 hover:border-teal/50 transition-colors"
              >
                <div>
                  <p className="font-medium text-ink">{p.title}</p>
                  <p className="text-xs text-ink-soft mt-0.5">{STATUS_LABELS[p.status] ?? p.status}</p>
                </div>
                <span className="text-sm text-teal font-medium whitespace-nowrap">
                  {countsByProject[p.id] ?? 0} interessados
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Você ainda não cadastrou nenhum projeto.</p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">
          Interesses recentes
        </h2>
        {recentMembers.length > 0 ? (
          <div className="space-y-3">
            {recentMembers.map((m) => (
              <div key={m.id} className="border border-line rounded-card px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-ink">{m.users?.name}</p>
                  <Link href={`/projetos/${m.project_id}/editar`} className="text-xs text-teal hover:underline">
                    {m.projects?.title}
                  </Link>
                </div>
                <a href={`mailto:${m.users?.email}`} className="text-sm text-ink-soft hover:text-teal">
                  {m.users?.email}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Ninguém manifestou interesse ainda.</p>
        )}
      </section>
    </div>
  );
}
