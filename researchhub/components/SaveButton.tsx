"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

type EntityType = "professor" | "project" | "laboratory" | "research_line";

export default function SaveButton({
  entityType,
  entityId,
  userId,
  initialSaved,
}: {
  entityType: EntityType;
  entityId: string;
  userId: string | null;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (!userId) {
    return (
      <a
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-teal transition-colors"
      >
        <HeartIcon filled={false} />
        Entrar para favoritar
      </a>
    );
  }

  async function handleClick() {
    setLoading(true);
    const supabase = supabaseBrowser();

    if (saved) {
      await supabase
        .from("saved_items")
        .delete()
        .eq("user_id", userId)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId);
      setSaved(false);
    } else {
      await supabase
        .from("saved_items")
        .insert({ user_id: userId, entity_type: entityType, entity_id: entityId });
      setSaved(true);
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
        saved ? "text-teal" : "text-ink-soft hover:text-teal"
      }`}
    >
      <HeartIcon filled={saved} />
      {saved ? "Favoritado" : "Favoritar"}
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}>
      <path
        d="M20.8 4.6c-1.9-1.9-5-1.9-6.9 0L12 6.5l-1.9-1.9c-1.9-1.9-5-1.9-6.9 0-1.9 1.9-1.9 5 0 6.9L12 20.3l8.8-8.8c1.9-1.9 1.9-5 0-6.9z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
