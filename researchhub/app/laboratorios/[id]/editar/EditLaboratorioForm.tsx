"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Lab = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  website: string | null;
  email: string | null;
};

export default function EditLaboratorioForm({ lab }: { lab: Lab }) {
  const [name, setName] = useState(lab.name);
  const [description, setDescription] = useState(lab.description ?? "");
  const [location, setLocation] = useState(lab.location ?? "");
  const [website, setWebsite] = useState(lab.website ?? "");
  const [email, setEmail] = useState(lab.email ?? "");
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
      .from("laboratories")
      .update({ name, description, location, website, email })
      .eq("id", lab.id);

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
        <label className="text-sm text-ink-soft">Nome</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      <div>
        <label className="text-sm text-ink-soft">Descrição</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      <div>
        <label className="text-sm text-ink-soft">Localização</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
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
        <label className="text-sm text-ink-soft">E-mail de contato</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
