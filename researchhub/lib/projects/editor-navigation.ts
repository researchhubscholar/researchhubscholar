// Use the current editable title, never the immutable idea-origin snapshot.
export function projectRadarHref(projectId: string, title: string, fallbackQuestion = "") {
  const topic = title.trim() || fallbackQuestion.trim();
  return `/descobrir?${new URLSearchParams({ tema: topic, projeto: projectId, origem: "projeto" })}`;
}

export function insertCitationAt(content: string, citation: string, position = content.length) {
  const index = Math.max(0, Math.min(position, content.length));
  const before = content.slice(0, index), after = content.slice(index);
  const prefix = before && !/\s$/.test(before) ? " " : "";
  const suffix = /^[\p{L}\p{N}]/u.test(after) ? " " : "";
  const inserted = `${prefix}${citation}${suffix}`;
  return { content: before + inserted + after, caret: index + inserted.length };
}
