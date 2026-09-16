"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type PendingProject = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  professors: { name: string } | null;
};

type RecentInterest = { id: string; studentName: string; projectTitle: string };

export default function CoordinatorDashboard({
  departmentName,
  pendingProjects,
  publishedCount,
  professorCount,
  projectCount,
  publicationCount,
  totalInterests,
  recentInterests,
}: {
  departmentName: string;
  pendingProjects: PendingProject[];
  publishedCount: number;
  professorCount: number;
  projectCount: number;
  publicationCount: number;
  totalInterests: number;
  recentInterests: RecentInterest[];
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDecision(projectId: string, approve: boolean) {
    setLoadingId(projectId);
    setError(null);

    const supabase = supabaseBrowser();
    const { error: updateError } = await supabase
      .from("projects")
      .update({ status: approve ? "published" : "draft" })
      .eq("id", projectId);

    if (updateError) {
      setError(updateError.message);
      setLoadingId(null);
      return;
    }

    router.refresh();
    setLoadingId(null);
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-teal font-medium">Coordenador</p>
      <h1 className="font-display text-3xl text-ink mt-1">{departmentName}</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
        <Stat label="Professores" value={professorCount} />
        <Stat label="Projetos" value={projectCount} />
        <Stat label="Publicados/Recrutando" value={publishedCount} />
        <Stat label="Aguardando aprovação" value={pendingProjects.length} />
        <Stat label="Publicações" value={publicationCount} />
        <Stat label="Interesses manifestados" value={totalInterests} />
      </div>

      <section className="mt-10">
        <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">
          Aguardando aprovação
        </h2>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {pendingProjects.length > 0 ? (
          <div className="space-y-3">
            {pendingProjects.map((p) => (
              <div key={p.id} className="border border-line rounded-card px-4 py-4">
                <p className="font-medium text-ink">{p.title}</p>
                <p className="text-sm text-ink-soft mt-0.5">
                  {p.professors?.name ?? "Professor não identificado"}
                </p>
                {p.summary && <p className="text-sm text-ink-soft mt-2">{p.summary}</p>}

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => handleDecision(p.id, true)}
                    disabled={loadingId === p.id}
                    className="text-sm bg-teal text-white font-medium px-4 py-1.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
                  >
                    {loadingId === p.id ? "..." : "Aprovar"}
                  </button>
                  <button
                    onClick={() => handleDecision(p.id, false)}
                    disabled={loadingId === p.id}
                    className="text-sm border border-line text-ink-soft font-medium px-4 py-1.5 rounded-card hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50"
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Nenhum projeto aguardando aprovação no momento.</p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-sm uppercase tracking-wide text-ink-soft font-medium mb-4">
          Interesses recentes no departamento
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
