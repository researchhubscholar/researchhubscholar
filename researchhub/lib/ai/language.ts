export type OutputLanguage = "pt-BR" | "en";

export function outputLanguage(value: unknown): OutputLanguage {
  return value === "en" ? "en" : "pt-BR";
}

export function languageInstruction(language: OutputLanguage) {
  return language === "en"
    ? "MANDATORY OUTPUT LANGUAGE: write every user-facing field in English. Keep established MeSH terms and proper names in their canonical form."
    : "IDIOMA OBRIGATÓRIO DA SAÍDA: escreva todos os campos destinados ao usuário em português do Brasil. Mantenha apenas termos MeSH e nomes próprios em sua forma canônica.";
}
