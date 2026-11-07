"use client";
import { intlLocale } from "@/lib/i18n/format";
import { useLanguage } from "@/components/i18n/language-provider";

import InterfaceText from "@/components/i18n/interface-text";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

type SearchHistoryItem = {
  id: string; query: string; pubmed_total: number | null; systematic_reviews: number | null;
  clinical_trials: number | null; searched_at: string;
};

export default function SearchHistory({ onApply }: { onApply: (query: string) => void }) {
 const {locale:formatLocale}=useLanguage();

  const [items, setItems] = useState<SearchHistoryItem[]>([]);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const db = supabaseBrowser();
      const { data: auth } = await db.auth.getUser();
      if (!auth.user) return;
      const result = await db.from("search_history").select("id,query,pubmed_total,systematic_reviews,clinical_trials,searched_at")
        .eq("owner_id", auth.user.id).order("searched_at", { ascending: false }).limit(8);
      if (!active || result.error) return;
      setItems(result.data || []); setAvailable(true);
    }
    void load();
    return () => { active = false; };
  }, []);

  if (!available || !items.length) return null;
  return <details className="mt-4 bg-white border border-line rounded-card p-4">
    <summary className="cursor-pointer text-sm font-medium text-teal"><InterfaceText message="screen.39efd1849853" /> {items.length} <InterfaceText message="screen.829180d52f26" /></summary>
    <div className="mt-4 divide-y divide-line">{items.map(item => <div key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0"><p className="text-sm font-medium line-clamp-2">{item.query}</p><p className="text-xs text-ink-soft mt-1">{new Date(item.searched_at).toLocaleDateString(intlLocale(formatLocale))} · {(item.pubmed_total || 0).toLocaleString(intlLocale(formatLocale))} resultados · {item.systematic_reviews || 0} <InterfaceText message="screen.9ecbd7af6eb2" /> {item.clinical_trials || 0} <InterfaceText message="screen.386dfde69f8a" /></p></div>
      <button type="button" onClick={() => onApply(item.query)} className="text-sm text-teal underline shrink-0 self-start sm:self-auto"><InterfaceText message="screen.c9c02c0f8218" /></button>
    </div>)}</div>
  </details>;
}
