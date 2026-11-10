"use client";
import { dialogCopy } from "@/lib/i18n/interface-copy";

import { useLanguage } from "@/components/i18n/language-provider";
import InterfaceText from "@/components/i18n/interface-text";

import { useEffect, useState } from "react";
import { duplicateMatchReason, EvidenceNote, LibraryArticle } from "@/lib/literature/library-store";

type Props = {
  groups: LibraryArticle[][];
  notes: Record<string, EvidenceNote>;
  disabled: boolean;
  onMerge: (keepId: string, removeIds: string[]) => Promise<boolean>;
};

const reasonLabels = {
  doi: "Mesmo DOI",
  pmid: "Mesmo PMID",
  "title-year": "Mesmo título e ano",
};

function informationScore(article: LibraryArticle, note: EvidenceNote = {}) {
  return [article.pmid, article.doi, article.abstract, article.fullTextUrl, article.journal, article.authors.length, article.projectIds.length, article.tags.length, ...Object.values(note)].filter(Boolean).length;
}

export function DuplicateReview({ groups, notes, disabled, onMerge }: Props) {
  const { t: uiText } = useLanguage();
  const [primaryByGroup, setPrimaryByGroup] = useState<Record<string, string>>({});
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    setPrimaryByGroup(previous => {
      const next = { ...previous };
      for (const group of groups) {
        const key = group.map(article => article.id).sort().join(":");
        if (!group.some(article => article.id === next[key])) {
          next[key] = [...group].sort((a, b) => informationScore(b, notes[b.id]) - informationScore(a, notes[a.id]))[0].id;
        }
      }
      return next;
    });
  }, [groups, notes]);

  if (!groups.length) return null;

  async function merge(group: LibraryArticle[], key: string) {
    const keepId = primaryByGroup[key] || group[0].id;
    const removeIds = group.filter(article => article.id !== keepId).map(article => article.id);
    if (!window.confirm(dialogCopy(`Unir ${group.length} registros? O registro escolhido será mantido. Os demais serão removidos somente depois que notas, etiquetas e vínculos forem preservados.`))) return;
    await onMerge(keepId, removeIds);
  }

  return <section className="mt-5 bg-amber-soft border border-amber/20 rounded-2xl p-5" aria-labelledby="duplicate-title">
    <p className="text-xs uppercase tracking-widest text-amber-800 font-semibold"><InterfaceText message="screen.4c17a61a6fee" /></p>
    <h2 id="duplicate-title" className="font-display text-2xl mt-2">{groups.length} {groups.length === 1 ? "grupo precisa" : "grupos precisam"} <InterfaceText message="screen.736703e14809" /></h2>
    <p className="text-sm text-ink-soft mt-2 max-w-3xl"><InterfaceText message="screen.de8ecc313193" /></p>
    <div className="space-y-4 mt-4">
      {groups.map(group => {
        const key = group.map(article => article.id).sort().join(":");
        const primary = primaryByGroup[key] || group[0].id;
        const reason = duplicateMatchReason(group[0], group[1]);
        const expanded = openGroup === key;
        return <article key={key} className="bg-white border border-line rounded-card p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <span className="inline-flex text-xs bg-amber-soft text-amber-900 px-2 py-1 rounded-full">{reason ? reasonLabels[reason] : uiText("screen.3af06a260221")}</span>
              <p className="font-medium mt-2">{group[0].title}</p>
              <p className="text-xs text-ink-soft mt-1">{group.length} <InterfaceText message="screen.5587b8328719" /></p>
            </div>
            <button type="button" onClick={() => setOpenGroup(expanded ? null : key)} aria-expanded={expanded} className="text-sm text-teal border border-teal/30 px-3 py-2 rounded-card self-start">
              {expanded ? uiText("screen.938b40200ca4") : "Comparar registros"}
            </button>
          </div>
          {expanded && <div className="mt-4">
            <fieldset>
              <legend className="text-sm font-medium"><InterfaceText message="screen.0d94b5d64811" /></legend>
              <div className="grid md:grid-cols-2 gap-3 mt-3">
                {group.map(article => {
                  const noteCount = Object.values(notes[article.id] || {}).filter(value => value?.trim()).length;
                  return <label key={article.id} className={`block border rounded-card p-4 cursor-pointer ${primary === article.id ? "border-teal bg-teal-soft/40" : "border-line"}`}>
                    <span className="flex items-start gap-2">
                      <input type="radio" name={`primary-${key}`} value={article.id} checked={primary === article.id} onChange={() => setPrimaryByGroup(previous => ({ ...previous, [key]: article.id }))} className="mt-1" />
                      <span>
                        <span className="font-medium text-sm">{article.title}</span>
                        <span className="block text-xs text-ink-soft mt-2">{article.year || "Ano ausente"} · {article.journal || uiText("screen.f61f3ab4095a")}</span>
                        <span className="block text-xs text-ink-soft mt-1">{article.pmid ? `PMID ${article.pmid}` : "Sem PMID"} · {article.doi ? `DOI ${article.doi}` : "Sem DOI"}</span>
                        <span className="block text-xs text-ink-soft mt-1">{article.abstract ? "Com abstract" : "Sem abstract"} · {noteCount} campos anotados · {article.projectIds.length} vínculos · {article.tags.length} etiquetas</span>
                      </span>
                    </span>
                  </label>;
                })}
              </div>
            </fieldset>
            <div className="mt-4 bg-paper border border-line rounded-card p-3 text-xs text-ink-soft">
              <InterfaceText message="screen.deb1af8feb6a" />
            </div>
            <button type="button" disabled={disabled} onClick={() => merge(group, key)} className="mt-4 bg-ink text-white px-4 py-2 rounded-card text-sm disabled:opacity-50">
              {disabled ? "Aguarde..." : `Unir e manter o registro escolhido`}
            </button>
          </div>}
        </article>;
      })}
    </div>
  </section>;
}
