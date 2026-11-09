"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";

const routes = { protocol: "/meu-trabalho", manuscript: "/manuscrito", results: "/resultados", documents: "/documentos" } as const;
type Stage = keyof typeof routes;
type Visit = { projectId: string; stage: Stage; anchor: string };
const key = (owner: string) => `researchhub:resume:${owner}`;
const validAnchor = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9-]{0,70}$/.test(value);
const href = ({ projectId, stage, anchor }: Visit) => `${routes[stage]}?${stage === "protocol" ? "id" : "projeto"}=${encodeURIComponent(projectId)}${anchor ? "#" + anchor : ""}`;

export function RememberProjectStage({ ownerId, projectId, stage }: { ownerId: string; projectId: string; stage: Stage }) {
  useEffect(() => {
    const anchor = () => window.location.hash.slice(1);
    const save = (id = anchor()) => {
      try { localStorage.setItem(key(ownerId), JSON.stringify({ projectId, stage, anchor: validAnchor(id) ? id : "" })); } catch { /* Optional convenience. */ }
    };
    save();
    if (validAnchor(anchor())) document.getElementById(anchor())?.scrollIntoView({ block: "start" });
    const hashChange = () => save();
    const focus = (event: FocusEvent) => {
      if (stage !== "protocol" && stage !== "manuscript") return;
      if (!(event.target instanceof HTMLElement)) return;
      const id = event.target.closest("section[id]")?.id;
      if (id && (stage === "manuscript" ? id.startsWith("section-") : Boolean(event.target.closest(".project-stage-card")))) save(id);
    };
    window.addEventListener("hashchange", hashChange);
    document.addEventListener("focusin", focus);
    return () => {
      window.removeEventListener("hashchange", hashChange);
      document.removeEventListener("focusin", focus);
    };
  }, [ownerId, projectId, stage]);
  return null;
}

export function ResumeProject({ ownerId, projects }: { ownerId: string; projects: { id: string; title: string }[] }) {
  const { locale } = useLanguage();
  const [visit, setVisit] = useState<Visit | null>(null);
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(key(ownerId)) || "null");
      setVisit(value && Object.hasOwn(routes, value.stage) && typeof value.projectId === "string"
        ? { ...value, anchor: validAnchor(value.anchor) ? value.anchor : "" } : null);
    } catch { setVisit(null); }
  }, [ownerId]);
  const previous = visit && projects.find(project => project.id === visit.projectId);
  const project = previous || projects[0];
  if (!project) return null;
  const destination: Visit = previous && visit ? visit : { projectId: project.id, stage: "protocol", anchor: "" };
  const spanish = locale === "es";
  const stages = { protocol: "Protocolo", manuscript: "Manuscrito", results: "Resultados", documents: "Documentos" };
  return <div className="min-w-0">
    <Link href={href(destination)} className="workspace-primary-action inline-block bg-white text-ink rounded-card px-5 py-3 font-medium">
      {previous ? (spanish ? "Continuar donde lo dejé" : "Continuar de onde parei") : (spanish ? "Abrir proyecto reciente" : "Abrir projeto recente")}
    </Link>
    <p className="mt-2 text-sm text-white/70 break-words">{project.title} · {stages[destination.stage]}</p>
  </div>;
}
