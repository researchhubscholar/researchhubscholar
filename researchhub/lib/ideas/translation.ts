import type { OutputLanguage } from "../ai/language";
import type { Idea } from "./generate";

const textFields = [
  "title", "question", "objective", "studyType", "population", "outcome",
  "resources", "difficulty", "feasibility", "steps", "methods", "analysis",
  "variables", "justification", "contextSummary", "startingQuestion",
  "hypothesis", "eligibility", "ethics", "limitations", "noveltyCheck",
] as const;
const listFields = ["unresolved", "plan", "refinements"] as const;

export type IdeaTranslation = Partial<Pick<Idea, typeof textFields[number] | typeof listFields[number]>>;
export type IdeaTranslations = Partial<Record<OutputLanguage, IdeaTranslation>>;

export function ideaTranslationSource(idea: unknown): IdeaTranslation {
  if (!idea || typeof idea !== "object") throw new Error("Proposta inválida.");
  const input = idea as Record<string, unknown>;
  const source: IdeaTranslation = {};
  for (const key of textFields) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) source[key] = value;
  }
  for (const key of listFields) {
    const value = input[key];
    if (Array.isArray(value) && value.length && value.every(item => typeof item === "string")) source[key] = value;
  }
  if (!source.title || !source.question) throw new Error("Inclua o título e a pergunta da proposta.");
  return source;
}

export function validateIdeaTranslation(source: IdeaTranslation, result: unknown): IdeaTranslation {
  const translated = ideaTranslationSource(result);
  if (JSON.stringify(Object.keys(translated)) !== JSON.stringify(Object.keys(source))) {
    throw new Error("A tradução não incluiu todos os campos da proposta.");
  }
  for (const key of listFields) {
    if (source[key]?.length !== translated[key]?.length) throw new Error("A tradução alterou a estrutura da proposta.");
  }
  return translated;
}
