import { resolveLocale, type Locale } from "./locale";
const spanish: Record<string, string> = {
  "Título":"Título", "Autores":"Autores", "Ano":"Año", "Periódico":"Revista", "Status":"Estado", "Pasta":"Carpeta", "Desenho":"Diseño", "Tags":"Etiquetas", "Objetivo":"Objetivo", "População":"Población", "Método":"Método", "Amostra":"Muestra", "Intervenção":"Intervención", "Comparador":"Comparador", "Desfechos":"Desenlaces", "Achado":"Hallazgo", "Limitação":"Limitación", "Nível de evidência":"Nivel de evidencia", "Risco de viés":"Riesgo de sesgo", "Notas gerais":"Notas generales",
  "Manuscrito":"Manuscrito", "Palavras-chave:":"Palabras clave:", "Resultados":"Resultados", "Referências":"Referencias",
};
// Only product-owned export headings, never article titles or saved research text.
export function exportCopy(locale: Locale, source: string) {
  return resolveLocale(locale) === "es" && Object.hasOwn(spanish, source) ? spanish[source] : source;
}
