import type { ReviewAlert } from "@/lib/research/method-review";

export default function MethodReview({ alerts, locale }: { alerts: ReviewAlert[]; locale: string }) {
  if (!alerts.length) return null;
  const es = locale === "es";
  return <details className="my-4 rounded-card border border-line bg-paper/60 p-4">
    <summary className="cursor-pointer text-sm font-medium text-teal">
      {es ? "Puntos para revisar con tu orientador" : "Pontos para revisar com o orientador"} ({alerts.length})
    </summary>
    <p className="mt-3 text-sm text-ink-soft">{es ? "Son señales para revisar; no constituyen una evaluación formal del sesgo." : "São sinais para revisão; não constituem uma avaliação formal de viés."}</p>
    <ul className="mt-3 space-y-3">{alerts.map(({ title, excerpt, reason, question }, index) => <li key={index} className="border-t border-line pt-3 text-sm">
      <strong>{title}</strong>
      {excerpt && <blockquote className="my-1 break-words border-l-2 border-line pl-3">“{excerpt}”</blockquote>}
      <p>{reason}</p><p className="mt-1 font-medium">{question}</p>
    </li>)}</ul>
  </details>;
}
