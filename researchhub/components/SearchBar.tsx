"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBar({ initialQuery = "" }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length === 0) return;
    router.push(`/buscar?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex items-center gap-3 border border-line rounded-card bg-white px-4 py-3 focus-within:border-teal transition-colors">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-ink-soft shrink-0">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sobre o que você gostaria de pesquisar? Ex: cardiologia, IA, oncologia..."
          className="flex-1 outline-none text-ink placeholder:text-ink-soft/60 bg-transparent"
        />
        <button
          type="submit"
          className="text-sm font-medium text-white bg-teal hover:bg-teal/90 px-4 py-1.5 rounded-card transition-colors"
        >
          Buscar
        </button>
      </div>
    </form>
  );
}
