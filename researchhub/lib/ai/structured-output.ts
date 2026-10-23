import type { JSONSchema7 } from "ai";

type Validator<T> = (value: unknown) => value is T;

function firstJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const source = fenced ? fenced[1].trim() : trimmed;

  try {
    JSON.parse(source);
    return source;
  } catch {
    // Some models add a short introduction even when instructed to return JSON.
  }

  let start = -1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) return source.slice(start, index + 1);
    }
  }
  throw new Error("O modelo não retornou um objeto JSON completo.");
}

export function promptForJson(prompt: string, schema: JSONSchema7) {
  return `${prompt}

FORMATO OBRIGATÓRIO DA RESPOSTA
- Retorne somente um objeto JSON válido, sem Markdown, comentários ou texto antes/depois.
- Respeite todos os campos, tipos e limites deste JSON Schema:
${JSON.stringify(schema)}`;
}

export function outputBudget(prompt: string, schema: JSONSchema7, preferredOutputTokens: number, reservedTokens: number, minimumOutputTokens: number) {
  // Conservative approximation for Portuguese/English prose and JSON. The real
  // provider usage is still checked after generation before settling the ledger.
  const estimatedInputTokens = Math.ceil((prompt.length + JSON.stringify(schema).length) / 3);
  const availableOutputTokens = reservedTokens - estimatedInputTokens;
  if (availableOutputTokens < minimumOutputTokens) {
    throw new Error("O contexto está grande demais para esta operação. Reduza o conteúdo e tente novamente.");
  }
  return Math.min(preferredOutputTokens, availableOutputTokens);
}

export function parseValidatedJson<T>(text: string, validate: Validator<T>): T {
  let value: unknown;
  try {
    value = JSON.parse(firstJsonObject(text));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("O modelo")) throw error;
    throw new Error("O modelo retornou JSON inválido. Tente novamente.");
  }
  if (!validate(value)) throw new Error("A resposta do modelo não corresponde ao formato científico esperado. Tente novamente.");
  return value;
}
