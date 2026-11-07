"use client";

import { useState } from "react";
import InterfaceText from "@/components/i18n/interface-text";
import { useLanguage } from "@/components/i18n/language-provider";

export default function ActiveProjectPicker({ currentId, options, area }: {
  currentId: string;
  area: "manuscrito" | "documentos";
  options: { id: string; label: string }[];
}) {
  const [selectedId, setSelectedId] = useState(currentId);
  const { locale } = useLanguage();
  const isManuscript = area === "manuscrito";
  const actionLabel = isManuscript
    ? (locale === "es" ? "Cambiar de manuscrito" : "Trocar de manuscrito")
    : (locale === "es" ? "Ver documentos del otro proyecto" : "Ver documentos do outro projeto");
  const changingProject = selectedId !== currentId;

  return (
    <form action={`/${area}`} method="get" className={`workspace-project-picker ${isManuscript ? "manuscript" : "documents"}-project-picker`}
      onSubmit={event => { if (!changingProject) event.preventDefault(); }}>
      <label>
        <InterfaceText message="screen.91aec26f5cfe" />
        <select name="projeto" value={selectedId} onChange={event => setSelectedId(event.target.value)}
          className="block w-full border border-line rounded-card p-2 mt-2 bg-paper">
          {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      {changingProject && <button type="submit" className="workspace-project-picker-action">
        {actionLabel} →
      </button>}
    </form>
  );
}
