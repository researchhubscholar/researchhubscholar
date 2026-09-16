"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type University = {
  id: string;
  name: string;
  short_name: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  logo_url: string | null;
};

export default function EditUniversidadeForm({ university }: { university: University }) {
  const [name, setName] = useState(university.name);
  const [shortName, setShortName] = useState(university.short_name ?? "");
  const [city, setCity] = useState(university.city ?? "");
  const [state, setState] = useState(university.state ?? "");
  const [website, setWebsite] = useState(university.website ?? "");
  const [logoUrl, setLogoUrl] = useState(university.logo_url ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    const supabase = supabaseBrowser();
    const { error: updateError } = await supabase
      .from("universities")
      .update({
        name,
        short_name: shortName,
        city,
        state,
        website,
        logo_url: logoUrl,
      })
      .eq("id", university.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSaved(true);
    setLoading(false);
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
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      <div>
        <label className="text-sm text-ink-soft">Sigla</label>
        <input
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
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
            className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-ink-soft">Site</label>
        <input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      <div>
        <label className="text-sm text-ink-soft">URL do logo</label>
        <input
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-teal">Salvo com sucesso.</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-teal text-white font-medium py-2.5 rounded-card hover:bg-teal/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Salvando..." : "Salvar alterações"}
      </button>
    </form>
  );
}
