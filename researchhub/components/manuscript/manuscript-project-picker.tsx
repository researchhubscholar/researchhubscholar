"use client";

import { useState } from "react";
import InterfaceText from "@/components/i18n/interface-text";
import { useLanguage } from "@/components/i18n/language-provider";

export default function ManuscriptProjectPicker({ currentId, options }: {
  currentId: string;
  options: { id: string; label: string }[];
}) {
  const [selectedId, setSelectedId] = useState(currentId);
  const { locale } = useLanguage();
  const changingProject = selectedId !== currentId;

  return (
    <form action="/manuscrito" method="get" className="workspace-project-picker manuscript-project-picker"
      onSubmit={event => { if (!changingProject) event.preventDefault(); }}>
      <label>
        <InterfaceText message="screen.91aec26f5cfe" />
        <select name="projeto" value={selectedId} onChange={event => setSelectedId(event.target.value)}
          className="block w-full border border-line rounded-card p-2 mt-2 bg-paper">
          {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      {changingProject && <button type="submit" className="workspace-project-picker-action">
        {locale === "es" ? "Cambiar de manuscrito →" : "Trocar de manuscrito →"}
      </button>}
    </form>
  );
}
