import type { JSONSchema7 } from "json-schema";
import { assistantJsonSchema, type AssistantOutput } from "./assist";
import type { BetaSection } from "./manuscript-section-rules";

/** Constrain the returned targetField at generation time rather than asking
 * a model to remember to copy an unconstrained string exactly. */
export function manuscriptSectionOutputSchema(section: BetaSection): JSONSchema7 {
  const base = assistantJsonSchema;
  const recommendations = base.properties?.recommendations as JSONSchema7;
  const item = recommendations.items as JSONSchema7;
  return {
    ...base,
    properties: {
      ...base.properties,
      recommendations: {
        ...recommendations,
        minItems: 1,
        maxItems: 1,
        items: {
          ...item,
          properties: {
            ...item.properties,
            targetField: { type: "string", enum: [section] }
          }
        }
      }
    }
  };
}

export function verifyManuscriptSectionOutput(output: unknown, section: BetaSection): asserts output is AssistantOutput {
  if (!output || typeof output !== "object") {
    throw new Error("A resposta da IA está incompleta. Nenhum texto foi aplicado.");
  }
  const item = output as Partial<AssistantOutput>;
  if (!Array.isArray(item.recommendations) || item.recommendations.length !== 1
    || item.recommendations[0]?.targetField !== section) {
    throw new Error("A IA não identificou corretamente a seção " + section
      + ". A resposta foi descartada e o manuscrito permanece inalterado.");
  }
}
