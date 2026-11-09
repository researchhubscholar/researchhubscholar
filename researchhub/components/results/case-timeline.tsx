"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import type { CaseEvent } from "@/lib/results/data";

export default function CaseTimeline({ events, onChange, onSave, busy, dirty }: {
  events: CaseEvent[]; onChange: (events: CaseEvent[]) => void; onSave: () => void; busy: boolean; dirty: boolean;
}) {
  const { locale } = useLanguage();
  const t = (pt: string, es: string) => locale === "es" ? es : pt;
  const labels = { moment: t("Momento", "Momento"), event: t("Evento", "Evento"), finding: t("Achado", "Hallazgo"), evolution: t("Evolução", "Evolución") };
  return <section className="rounded-2xl border bg-white p-5 md:p-7">
    <h2 className="font-display text-2xl">{t("Linha do tempo do caso", "Cronología del caso")}</h2>
    <p className="mt-2 text-sm text-ink-soft">{t("Registre os eventos na ordem em que aconteceram. Use momentos relativos, como “Dia 1”, e não inclua dados que identifiquem o paciente.", "Registra los eventos en orden cronológico. Usa momentos relativos, como «Día 1», y omite los datos que identifiquen al paciente.")}</p>
    <fieldset disabled={busy} className="mt-5 space-y-4">
      {events.map((entry, index) => <fieldset key={entry.id} className="rounded-card border p-4">
        <legend className="px-2 text-sm font-medium">{labels.event} {index + 1}</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {(Object.keys(labels) as (keyof typeof labels)[]).map(field => <label key={field} className="text-sm">
            {labels[field]}
            <textarea rows={field === "moment" ? 1 : 2} maxLength={field === "moment" ? 100 : 1000} value={entry[field]} onChange={e => {
              const value = e.target.value;
              onChange(events.map(item => item.id === entry.id ? { ...item, [field]: value } : item));
            }} className="mt-1 block w-full rounded-card border p-2" />
          </label>)}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {[-1, 1].map(offset => <button key={offset} type="button" disabled={!events[index + offset]} onClick={() => {
            const next = [...events];
            [next[index], next[index + offset]] = [next[index + offset], next[index]];
            onChange(next);
          }} className="text-teal disabled:opacity-40">{offset < 0 ? t("Subir", "Subir") : t("Descer", "Bajar")}</button>)}
          <button type="button" onClick={() => onChange(events.filter(item => item.id !== entry.id))} className="text-teal">{t("Remover evento", "Eliminar evento")}</button>
        </div>
      </fieldset>)}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={events.length >= 100} onClick={() => onChange([...events, { id: crypto.randomUUID(), moment: "", event: "", finding: "", evolution: "" }])} className="rounded-card border px-4 py-2 text-teal">{t("Adicionar evento", "Añadir evento")}</button>
        <button type="button" disabled={!dirty} onClick={onSave} className="rounded-card bg-teal px-4 py-2 text-white disabled:opacity-50">{t("Salvar linha do tempo", "Guardar cronología")}</button>
      </div>
    </fieldset>
  </section>;
}
