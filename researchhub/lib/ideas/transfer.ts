const fields = ["theme", "question", "objective", "studyType", "population", "outcome", "hypothesis", "inclusion", "exclusion", "variables", "methods", "analysis", "ethics", "manuscript"] as const;
export type TransferDraft = Partial<Record<typeof fields[number], string>>;
export type TransferOrigin = {
  sourceType: "idea";
  sourceKey: string;
  ideaVersionId?: string;
  seriesId?: string;
  generationId?: string;
  language?: "pt-BR" | "en";
  radarQuery?: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function transferKey(ownerId: string | null, token: string) {
  if (!uuid.test(token)) throw new Error("Identificador de proposta inválido. Volte ao Ideias para preparar a proposta novamente.");
  return `researchhub-scholar-idea:${ownerId || "guest"}:${token}`;
}
export function readIdeaTransfer(storage: Pick<Storage, "getItem">, ownerId: string | null, token: string) {
  const raw = storage.getItem(transferKey(ownerId, token));
  if (!raw || raw.length > 250000) throw new Error("Proposta não encontrada nesta conta ou neste navegador. Volte ao Ideias para prepará-la novamente.");
  const data = JSON.parse(raw);
  if (data.ownerId !== ownerId || !data.draft || typeof data.draft !== "object") throw new Error("Esta proposta não pertence à conta atual.");
  const draft: TransferDraft = {};
  for (const field of fields) {
    if (typeof data.draft[field] === "string") {
      if (data.draft[field].length > (field === "manuscript" ? 100000 : 30000)) throw new Error("A proposta está muito extensa. Reduza os textos no Ideias antes de transferir.");
      draft[field] = data.draft[field];
    }
  }
  if (!draft.theme?.trim()) throw new Error("A proposta precisa de um tema válido.");
  const referenceIds: string[] = Array.isArray(data.referenceIds) ? Array.from(new Set<string>(data.referenceIds.filter((id: unknown) => typeof id === "string" && uuid.test(id)))).slice(0, 10) : [];
  const rawOrigin = data.origin && typeof data.origin === "object" ? data.origin as Record<string, unknown> : null;
  let origin: TransferOrigin | null = null;
  if (rawOrigin && rawOrigin.sourceType === "idea" && typeof rawOrigin.sourceKey === "string" && rawOrigin.sourceKey.length >= 8 && rawOrigin.sourceKey.length <= 200) {
    origin = {
      sourceType: "idea",
      sourceKey: rawOrigin.sourceKey,
      ideaVersionId: typeof rawOrigin.ideaVersionId === "string" && uuid.test(rawOrigin.ideaVersionId) ? rawOrigin.ideaVersionId : undefined,
      seriesId: typeof rawOrigin.seriesId === "string" && uuid.test(rawOrigin.seriesId) ? rawOrigin.seriesId : undefined,
      generationId: typeof rawOrigin.generationId === "string" && uuid.test(rawOrigin.generationId) ? rawOrigin.generationId : undefined,
      language: rawOrigin.language === "en" ? "en" : "pt-BR",
      radarQuery: typeof rawOrigin.radarQuery === "string" ? rawOrigin.radarQuery.slice(0, 2000) : undefined,
    };
  }
  return { draft, referenceIds, origin };
}
