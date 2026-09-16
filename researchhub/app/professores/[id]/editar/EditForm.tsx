"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Professor = {
  id: string;
  name: string;
  specialty: string | null;
  bio: string | null;
  email: string | null;
  lattes_url: string | null;
  office: string | null;
  phone: string | null;
  accepting_students: boolean;
};

export default function EditForm({ professor }: { professor: Professor }) {
  const [specialty, setSpecialty] = useState(professor.specialty ?? "");
  const [bio, setBio] = useState(professor.bio ?? "");
  const [email, setEmail] = useState(professor.email ?? "");
  const [lattesUrl, setLattesUrl] = useState(professor.lattes_url ?? "");
  const [office, setOffice] = useState(professor.office ?? "");
  const [phone, setPhone] = useState(professor.phone ?? "");
  const [acceptingStudents, setAcceptingStudents] = useState(professor.accepting_students);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = supabaseBrowser();
    const { error: updateError } = await supabase
      .from("professors")
      .update({
        specialty,
        bio,
        email,
        lattes_url: lattesUrl,
        office,
        phone,
        accepting_students: acceptingStudents,
      })
      .eq("id", professor.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push(`/professores/${professor.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <label className="text-sm text-ink-soft">Especialidade</label>
        <input
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      <div>
        <label className="text-sm text-ink-soft">Mini currículo</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
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

      <div>
        <label className="text-sm text-ink-soft">Lattes (URL)</label>
        <input
          value={lattesUrl}
          onChange={(e) => setLattesUrl(e.target.value)}
          className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-ink-soft">Sala</label>
          <input
            value={office}
            onChange={(e) => setOffice(e.target.value)}
            className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
          />
        </div>
        <div>
          <label className="text-sm text-ink-soft">Telefone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full mt-1 border border-line rounded-card px-3 py-2 outline-none focus:border-teal bg-white"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={acceptingStudents}
          onChange={(e) => setAcceptingStudents(e.target.checked)}
          className="accent-teal"
        />
        Aceito orientandos no momento
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

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
