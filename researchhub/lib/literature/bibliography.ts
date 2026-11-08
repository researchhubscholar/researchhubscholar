import type { Article } from "./types";

const words = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
const normalized = (value: string) => words(value).join(" ");
const doi = (value?: string | null) => (value || "").trim().toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "");

function sameAuthor(a: string, b: string) {
  const left = words(a), right = words(b);
  if (left.length < 2 || right.length < 2) return false;
  if (left.join(" ") === right.join(" ")) return true;
  const surname = (tokens: string[]) => tokens.at(-1)!.length <= 3 ? tokens[0] : tokens.at(-1)!;
  const initial = (tokens: string[]) => (tokens.at(-1)!.length <= 3 ? tokens.at(-1)! : tokens[0])[0];
  return surname(left) === surname(right) && initial(left) === initial(right);
}

export function matchBibliography(input: {title: string; authors: string[]; journal: string; doi?: string; year?: number}, candidates: Article[]) {
  const matches = candidates.filter(article => {
    if (normalized(article.title) !== normalized(input.title)) return false;
    if (input.doi && article.doi && doi(input.doi) !== doi(article.doi)) return false;
    if (input.year && article.year && input.year !== article.year) return false;
    const authorMatches = input.authors.some(author => article.authors.some(candidate => sameAuthor(author, candidate)));
    const journalMatches = Boolean(input.journal && normalized(input.journal) === normalized(article.journal));
    return input.doi && doi(input.doi) === doi(article.doi) || authorMatches && journalMatches;
  });
  if (!matches.length) return null;
  const [first, ...others] = matches;
  if (others.some(item => {
    if (first.doi && item.doi) return doi(first.doi) !== doi(item.doi);
    return first.source === item.source || !first.year || first.year !== item.year ||
      normalized(first.journal) !== normalized(item.journal) ||
      !first.authors.some(author => item.authors.some(other => sameAuthor(author, other)));
  })) return null;
  return matches.sort((a, b) => Number(Boolean(b.abstract)) - Number(Boolean(a.abstract)) || Number(Boolean(b.doi)) - Number(Boolean(a.doi)))[0];
}
