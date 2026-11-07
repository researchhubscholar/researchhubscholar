import { aiSpanishCopy } from "../i18n/ai-copy";
function copySpanish(text:string){return Object.hasOwn(aiSpanishCopy,text)?aiSpanishCopy[text as keyof typeof aiSpanishCopy]:text;}
import type { AssistantOutput } from "./assist";
import { requestOutputLanguage, type OutputLanguage } from "./language";

// Only call on deterministic product-authored outputs, never generated or user text.
export function localizeAuthoredOutput(output: AssistantOutput, language: OutputLanguage): AssistantOutput {
  const copy = (text: string) => language === "es" ? copySpanish(text) : text;
  return { ...output, title: copy(output.title), summary: copy(output.summary),
    recommendations: output.recommendations.map(item => ({ ...item, label: copy(item.label), content: copy(item.content), rationale: copy(item.rationale), source: copy(item.source) })),
    warnings: output.warnings.map(copy), caution: copy(output.caution) };
}

export function localizeAIError(request: Request, message: string): string {
  const locale = requestOutputLanguage(request) === "es" ? "es" : "pt-BR";
  const copy = (text: string) => locale === "es" ? copySpanish(text) : text;
  // Reservation notices can be appended to a known UI error or an external diagnostic.
  // Translate each authored part; preserve unrecognized provider details literally.
  const notices = [
    "A reserva de tokens foi liberada; esta tentativa não consumiu sua franquia.",
    "A operação já foi concluída e o consumo está registrado. Consulte o registro antes de enviar outra solicitação.",
    "Não foi possível confirmar a liberação da reserva de tokens. Consulte o registro e Minha licença antes de tentar novamente. Reservas interrompidas são verificadas na próxima tentativa após dez minutos.",
  ];
  for (const notice of notices) if (message.endsWith(" " + notice)) return copy(message.slice(0, -notice.length - 1)) + " " + copy(notice);
  return copy(message);
}
