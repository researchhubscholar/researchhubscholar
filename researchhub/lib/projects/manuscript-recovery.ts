type RecoverySection = { section_key: string; content: string };
export type ManuscriptRecovery = { title?: string; sections: RecoverySection[] };

export function readManuscriptRecovery(raw: string | null, allowedKeys: string[]): ManuscriptRecovery | null {
  if (!raw || raw.length > 600000) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || !Array.isArray(value.sections) || value.sections.length !== allowedKeys.length) return null;
    if (value.sections.some((section: RecoverySection) => !section || !allowedKeys.includes(section.section_key) || typeof section.content !== "string" || section.content.length > 100000)) return null;
    if (new Set(value.sections.map((section: RecoverySection) => section.section_key)).size !== allowedKeys.length) return null;
    return { title: typeof value.title === "string" ? value.title.slice(0, 1000) : undefined, sections: value.sections.map((section: RecoverySection) => ({ section_key: section.section_key, content: section.content })) };
  } catch { return null; }
}
