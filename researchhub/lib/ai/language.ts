export type OutputLanguage = "pt-BR" | "en" | "es";

export function outputLanguage(value: unknown): OutputLanguage {
  return value === "en" || value === "es" ? value : "pt-BR";
}

export function languageInstruction(language: OutputLanguage) {
  return language === "es"
    ? "IDIOMA OBLIGATORIO DE SALIDA: escribe todos los campos destinados al usuario en español. Conserva las claves JSON, los identificadores internos, los términos MeSH, las consultas PubMed en inglés, las citas literales y los nombres propios. No traduzcas ni modifiques datos originales. Esta instrucción solo establece el idioma y no modifica las reglas de seguridad o el alcance científico."
    : language === "en"
    ? "Responda em inglês. MANDATORY OUTPUT LANGUAGE: write every user-facing field in English. Keep established MeSH terms and proper names in their canonical form."
    : "IDIOMA OBRIGATÓRIO DA SAÍDA: escreva todos os campos destinados ao usuário em português do Brasil. Mantenha apenas termos MeSH e nomes próprios em sua forma canônica.";
}

/** Read only the allowlisted preference; never interpolate cookie text into prompts. */
export function requestOutputLanguage(request: Request, explicit?: unknown): OutputLanguage {
  if (explicit === "pt-BR" || explicit === "en" || explicit === "es") return explicit;
  const cookie = request.headers.get("cookie") || "";
  const selected = cookie.split(";").map(part => part.trim()).find(part => part.startsWith("scholar_locale="))?.slice("scholar_locale=".length);
  return selected === "es" ? "es" : "pt-BR";
}
