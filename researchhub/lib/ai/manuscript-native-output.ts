import type { JSONSchema7 } from "ai";
import type { AssistantOutput } from "./assist";

const text: JSONSchema7 = { type: "string" };
const choice = (...values: string[]): JSONSchema7 => ({ type: "string", enum: values });
const list = (items: JSONSchema7): JSONSchema7 => ({ type: "array", items });
const object = (properties: Record<string, JSONSchema7>): JSONSchema7 => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const evidenceKind = choice("abstract", "fullTextExcerpt");
const citationManifest = object({
  anchors: list(object({ id: text, kind: evidenceKind, quote: text })),
});
const evidenceBatch = list(object({
  label: text,
  relevance: { type: "integer", enum: [0, 1, 2, 3] },
  finding: text,
  kind: choice("none", "abstract", "fullTextExcerpt"),
  quote: text,
}));
const coherenceReport = object({
  overview: text,
  findings: list(object({
    level: choice("critical", "review", "improve"),
    category: choice("scope", "method", "results", "conclusion", "consistency", "reporting"),
    title: text,
    explanation: text,
    recommendation: text,
    evidence: list(object({ origin: choice("project", "section"), field: text, quote: text })),
  })),
});

export function usesManuscriptNativeOutput(task?: string) {
  return task !== undefined && ["draft_compose", "evidence_batch", "section_draft", "coherence_review"].includes(task);
}

function nativeField(task?: string) {
  switch (task) {
    case "draft_compose": return { field: "source", schema: citationManifest } as const;
    case "evidence_batch": return { field: "content", schema: evidenceBatch } as const;
    case "coherence_review": return { field: "content", schema: coherenceReport } as const;
    default: return null;
  }
}

export function manuscriptNativeOutputSchema(base: JSONSchema7, task?: string): JSONSchema7 {
  const replacement = nativeField(task);
  if (!replacement) return base;
  const recommendations = base.properties?.recommendations as JSONSchema7;
  const item = recommendations.items as JSONSchema7;
  return {
    ...base,
    properties: {
      ...base.properties,
      recommendations: {
        ...recommendations,
        items: {
          ...item,
          properties: { ...item.properties, [replacement.field]: replacement.schema },
        },
      },
    },
  };
}

// Preserve the persisted artifact format and reuse the literal-evidence validators.
export function normalizeManuscriptNativeOutput(value: unknown, task?: string): AssistantOutput {
  const output = value as AssistantOutput;
  const replacement = nativeField(task);
  if (!replacement) return output;
  return {
    ...output,
    recommendations: output.recommendations.map(item => ({
      ...item,
      [replacement.field]: JSON.stringify(item[replacement.field]),
    })),
  };
}
