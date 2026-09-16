"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  department_id: string | null;
};

type Department = { id: string; name: string };

const ROLE_LABELS: Record<string, string> = {
  student: "Aluno",
  professor: "Professor",
  coordinator: "Coordenador",
};

export default function UsersTable({
  users,
  departments,
}: {
  users: User[];
  departments: Department[];
}) {
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  async function updateUser(userId: string, changes: Partial<User>) {
    setSavingId(userId);
    setError(null);

    const supabase = supabaseBrowser();
    const { error: updateError } = await supabase
      .from("users")
      .update(changes)
      .eq("id", userId);

    if (updateError) {
      setError(updateError.message);
      setSavingId(null);
      return;
    }

    router.refresh();
    setSavingId(null);
  }

  return (
    <div className="mt-8">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome ou e-mail..."
        className="w-full max-w-sm border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white text-sm"
      />

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      <div className="mt-4 space-y-2">
        {filtered.map((u) => (
          <div key={u.id} className="border border-line rounded-card px-4 py-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-medium text-ink">{u.name}</p>
                <p className="text-sm text-ink-soft">{u.email}</p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.status === "active" ? "bg-teal-soft text-teal" : "bg-amber-soft text-amber"
                  }`}
                >
                  {u.status === "active" ? "Ativo" : u.status === "suspended" ? "Suspenso" : "Pendente"}
                </span>

                <select
                  value={u.role}
                  disabled={savingId === u.id}
                  onChange={(e) => {
                    const newRole = e.target.value;
                    const changes: Partial<User> =
                      newRole === "coordinator"
                        ? { role: newRole, department_id: u.department_id ?? departments[0]?.id ?? null }
                        : { role: newRole, department_id: null };
                    updateUser(u.id, changes);
                  }}
                  className="text-sm border border-line rounded-card px-2 py-1.5 outline-none focus:border-teal bg-white"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                {u.role === "coordinator" && (
                  <select
                    value={u.department_id ?? ""}
                    disabled={savingId === u.id}
                    onChange={(e) => updateUser(u.id, { department_id: e.target.value })}
                    className="text-sm border border-line rounded-card px-2 py-1.5 outline-none focus:border-teal bg-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={() =>
                    updateUser(u.id, { status: u.status === "active" ? "suspended" : "active" })
                  }
                  disabled={savingId === u.id}
                  className={`text-sm font-medium px-3 py-1.5 rounded-card transition-colors disabled:opacity-50 ${
                    u.status === "active"
                      ? "border border-line text-ink-soft hover:border-red-300 hover:text-red-600"
                      : "bg-teal text-white hover:bg-teal/90"
                  }`}
                >
                  {u.status === "active" ? "Suspender" : "Reativar"}
                </button>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-ink-soft">Nenhum usuário encontrado.</p>
        )}
      </div>
    </div>
  );
}
