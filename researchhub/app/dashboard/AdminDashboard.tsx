import Link from "next/link";

type Department = {
  id: string;
  name: string;
  description: string | null;
  professorCount: number;
  projectCount: number;
};

type PendingProject = { id: string; title: string; professorName: string };
type RecentInterest = { id: string; studentName: string; projectTitle: string; createdAt: string };

export default function AdminDashboard({
  universityName,
  departments,
  professorCount,
  projectCount,
  studentCount,
  coordinatorCount,
  publicationCount,
  totalInterests,
  statusCounts,
  pendingProjects,
  recentInterests,
}: {
  universityName: string;
  departments: Department[];
  professorCount: number;
  projectCount: number;
  studentCount: number;
  coordinatorCount: number;
  publicationCount: number;
  totalInterests: number;
  statusCounts: Record<string, number>;
  pendingProjects: PendingProject[];
  recentInterests: RecentInterest[];
}) {
  const recruitingCount = (statusCounts.recruiting ?? 0) + (statusCounts.published ?? 0);

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Administrador</p>
      <div className="flex items-start justify-between gap-6">
        <h1 className="font-display text-3xl text-ink mt-1">{universityName}</h1>
        <div className="flex flex-col items-end gap-1 mt-2">
          <Link href="/admin/usuarios" className="text-sm text-teal font-medium hover:underline whitespace-nowrap">
            Gerenciar usuários
          </Link>
          <Link href="/universidade/editar" className="text-sm text-teal font-medium hover:underline whitespace-nowrap">
            Editar dados da universidade
          </Link>
        </div>
      </div>

      {/* Visão geral — números que importam pra quem gerencia a universidade */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
        <Stat label="Departamentos" value={departments.length} />
        <Stat label="Professores" value={professorCount} />
        <Stat label="Alunos" value={studentCount} />
        <Stat label="Coordenadores" value={coordinatorCount} />
        <Stat label="Projetos" value={projectCount} />
        <Stat label="Recrutando/Publicados" value={recruitingCount} />
        <Stat label="Publicações" value={publicationCount} />
        <Stat label="Interesses manifestados" value={totalInterests} />
      </div>

      {pendingProjects.length > 0 && (
        <section className="mt-10 border border-amber/30 bg-amber-soft rounded-card px-5 py-4">
          <p className="text-sm text-ink font-medium mb-2">
            {pendingProjects.length} {pendingProjects.length === 1 ? "projeto aguardando" : "projetos aguardando"} aprovação
          </p>
          <p className="text-sm text-ink-soft">
            Isso é revisado pelo coordenador de cada departamento. Se um
            departamento não tem coordenador ainda, os projetos ficam
            parados aqui até alguém assumir esse papel.
          </p>
          <ul className="mt-3 space-y-1">
            {pendingProjects.slice(0, 5).map((p) => (
              <li key={p.id} className="text-sm text-ink-soft">
                <span className="text-ink">{p.title}</span> — {p.professorName}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium">Departamentos</h2>
          <Link href="/departamentos/novo" className="text-sm text-teal font-medium hover:underline">
            + Novo departamento
          </Link>
        </div>

        {departments.length > 0 ? (
          <div className="space-y-2">
            {departments.map((d) => (
              <Link
                key={d.id}
                href={`/departamentos/${d.id}`}
                className="flex items-center justify-between border border-line rounded-card px-4 py-3 hover:border-teal/50 transition-colors"
              >
                <div>
                  <p className="font-medium text-ink">{d.name}</p>
                  {d.description && <p className="text-sm text-ink-soft mt-0.5">{d.description}</p>}
                </div>
                <span className="text-sm text-ink-soft whitespace-nowrap">
                  {d.professorCount} professores · {d.projectCount} projetos
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">
            Nenhum departamento cadastrado ainda. Crie o primeiro para os
            professores começarem a se cadastrar.
          </p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">
          Interesses recentes (toda a universidade)
        </h2>
        {recentInterests.length > 0 ? (
          <div className="space-y-2">
            {recentInterests.map((i) => (
              <div key={i.id} className="text-sm border border-line rounded-card px-4 py-2.5">
                <span className="text-ink font-medium">{i.studentName}</span>
                <span className="text-ink-soft"> se interessou em </span>
                <span className="text-ink">{i.projectTitle}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Nenhum interesse manifestado ainda.</p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-line rounded-card px-4 py-3">
      <p className="font-display text-2xl text-ink">{value}</p>
      <p className="text-xs text-ink-soft mt-0.5">{label}</p>
    </div>
  );
}
