"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { readReviewIds, reviewLink, reviewReadEvent, reviewReadKey } from "@/lib/access/review-notifications";

type ReviewNotice = { id: string; project_id: string; body: string; research_projects: { title: string | null; theme: string | null } };

export default function ReviewBell({ userId }: { userId: string }) {
  const { locale } = useLanguage();
  const es = locale === "es";
  const [items, setItems] = useState<ReviewNotice[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const panel = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);

  useEffect(() => {
    let alive = true;
    let loading = false;
    const sync = () => setRead(readReviewIds(userId));
    const storage = (event: StorageEvent) => { if (event.key === reviewReadKey(userId)) sync(); };
    const marked = (event: Event) => {
      const detail = (event as CustomEvent<{userId: string; commentId: string}>).detail;
      if (detail?.userId === userId) setRead(previous => previous.includes(detail.commentId) ? previous : [...previous, detail.commentId]);
    };
    async function refresh() {
      if (loading || document.visibilityState === "hidden") return;
      loading = true;
      try {
        const { data, error } = await supabaseBrowser().from("scholar_manuscript_comments")
          .select("id,project_id,body,research_projects!inner(title,theme)")
          .eq("research_projects.owner_id", userId).neq("author_id", userId)
          .order("created_at", { ascending: false }).order("id").limit(30)
          .returns<ReviewNotice[]>();
        if (!alive) return;
        setFailed(Boolean(error));
        if (!error) setItems(data || []);
      } catch { if (alive) setFailed(true); }
      finally { loading = false; }
    }
    sync();
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", storage);
    window.addEventListener(reviewReadEvent, marked);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", storage);
      window.removeEventListener(reviewReadEvent, marked);
    };
  }, [userId]);

  const unread = items.filter(item => !read.includes(item.id)).length;
  const label = es ? "Notificaciones de revisión" : "Notificações de revisão";
  if (typeof document === "undefined") return null;
  return createPortal(<details ref={panel} className="review-bell" onKeyDown={event => {
    if (event.key === "Escape" && panel.current?.open) {
      panel.current.open = false;
      summary.current?.focus();
    }
  }}>
    <summary ref={summary} aria-label={unread ? `${label} · ${unread} ${es ? "sin leer" : "não lidos"}` : label} title={label}>
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
      {unread > 0 && <span className="review-bell-dot" aria-hidden="true"/>}
    </summary>
    <section className="review-bell-panel" aria-label={label}>
      <strong>{label}</strong>
      {failed && <p>{es ? "No se pudieron actualizar los avisos." : "Não foi possível atualizar os avisos."}</p>}
      {!failed && !items.length && <p>{es ? "Todavía no hay comentarios de revisión." : "Ainda não há comentários de revisão."}</p>}
      <ul>{items.map(item => <li key={item.id}><Link href={reviewLink(item.project_id, item.id)} scroll={false} onClick={() => { if (panel.current) panel.current.open = false; }}>
        <span className="review-notice-title">{!read.includes(item.id) && <span className="review-notice-unread" aria-label={es ? "Sin leer" : "Não lido"}/>}
        {item.research_projects.title || item.research_projects.theme || "Manuscrito"}</span>
        <span className="review-notice-preview">{item.body}</span>
      </Link></li>)}</ul>
    </section>
  </details>, document.body);
}
