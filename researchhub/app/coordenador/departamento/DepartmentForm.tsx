"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Department = { id: string; name: string };

export default function DepartmentForm({ departments }: { departments: Department[] }) {
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!departmentId) return;
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      setError("Sessão expirada. Faça login novamente.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ department_id: departmentId })
      .eq("auth_user_id", authUser.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <select
        required
        value={departmentId}
        onChange={(e) => setDepartmentId(e.target.value)}
        className="w-full border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
      >
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || departments.length === 0}
        className="w-full bg-teal text-white font-medium py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Salvando..." : "Confirmar"}
      </button>
    </form>
  );
}
