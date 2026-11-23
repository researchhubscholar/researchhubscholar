import type { ProjectEvidenceDraft } from "../literature/project-evidence-handoff";
import { verifyEvidenceAnchor } from "../literature/provenance";

type EvidenceArticle = { id: string; abstract?: string | null };
type ManuscriptSection = { section_key: string; content: string };

export function insertReviewedEvidence<Section extends ManuscriptSection, Article extends EvidenceArticle>(
  projectId: string,
  sections: Section[],
  citationIds: string[],
  articles: Article[],
  drafts: ProjectEvidenceDraft[],
  citationLabel: (article: Article, number: number) => string,
) {
  if (!drafts.length) return null;

  const nextSections = sections.map(section => ({ ...section }));
  const nextIds = [...citationIds];
  for (const draft of drafts) {
    const key = draft.destination === "introduction_background" ? "introduction"
      : draft.destination === "discussion_evidence" ? "discussion" : null;
    const section = nextSections.find(item => item.section_key === key);
    const article = articles.find(item => item.id === draft.articleId);
    if (draft.projectId !== projectId || !section || !article?.abstract
      || draft.quote !== draft.provenance.excerpt || !verifyEvidenceAnchor(article.abstract, draft.provenance)) return null;

    if (!nextIds.includes(article.id)) nextIds.push(article.id);
    const citation = citationLabel(article, nextIds.indexOf(article.id) + 1);
    const paragraph = `“${draft.quote}” ${citation}`;
    if (!section.content.split("\n\n").includes(paragraph)) {
      section.content += (section.content ? "\n\n" : "") + paragraph;
    }
  }
  return { sections: nextSections, citationIds: nextIds };
}
