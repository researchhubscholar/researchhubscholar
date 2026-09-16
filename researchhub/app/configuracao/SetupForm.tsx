"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function SetupForm({ userId }: { userId: string }) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();

    const { error: insertError } = await supabase.from("universities").insert({
      name,
      short_name: shortName,
      city,
      state,
      owner_user_id: userId,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    const { error: roleError } = await supabase
      .from("users")
      .update({ role: "admin" })
      .eq("id", userId);

    if (roleError) {
      setError(roleError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <label className="text-sm text-ink-soft">Nome da universidade</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Universidade Federal de Exemplolândia"
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      <div>
        <label className="text-sm text-ink-soft">Sigla</label>
        <input
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          placeholder="Ex: UFE"
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-ink-soft">Cidade</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
          />
        </div>
        <div>
          <label className="text-sm text-ink-soft">Estado</label>
          <input
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="SP"
            className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-teal text-white font-medium py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Configurando..." : "Criar universidade e virar admin"}
      </button>
    </form>
  );
}
