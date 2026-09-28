"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Article, articleKey } from "./types";
import type { OpenAccessResult } from "./open-access";

export function useOpenAccess(autoArticles?: Article[]) {
  const [results, setResults] = useState<Record<string, OpenAccessResult>>({});
  const [loading, setLoading] = useState<Set<string>>(() => new Set());
  const requested = useRef(new Set<string>());

  const lookup = useCallback(async (input: Article[]) => {
    const unique = input.filter(article => {
      const key = articleKey(article);
      if (requested.current.has(key) || article.fullTextUrl || (!article.pmid && !article.doi)) return false;
      requested.current.add(key); return true;
    });
    if (!unique.length) return;
    const keys = unique.map(articleKey);
    setLoading(previous => new Set([...previous, ...keys]));
    try {
      for (let start = 0; start < unique.length; start += 20) {
        const batch = unique.slice(start, start + 20);
        const response = await fetch("/api/literature/open-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ articles: batch.map(article => ({ key: articleKey(article), pmid: article.pmid, doi: article.doi })) }) });
        if (!response.ok) throw new Error("Falha na verificação");
        const data = await response.json();
        setResults(previous => ({ ...previous, ...(data.results || {}) }));
      }
    } catch {
      const unknown: OpenAccessResult = { status: "unknown", url: null, source: null, license: null, version: null, isPdf: false };
      setResults(previous => ({ ...previous, ...Object.fromEntries(keys.map(key => [key, unknown])) }));
    } finally {
      setLoading(previous => { const next = new Set(previous); keys.forEach(key => next.delete(key)); return next; });
    }
  }, []);

  useEffect(() => { if (autoArticles) void lookup(autoArticles); }, [autoArticles, lookup]);
  const retry = useCallback((article: Article) => {
    const key = articleKey(article);
    requested.current.delete(key);
    setResults(previous => { const next = { ...previous }; delete next[key]; return next; });
    return lookup([article]);
  }, [lookup]);
  return { results, loading, lookup, retry };
}
