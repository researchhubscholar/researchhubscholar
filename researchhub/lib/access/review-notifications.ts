export const reviewReadEvent = "scholar-review-notification-read";
export function reviewReadKey(userId: string) { return `scholar:review-read:${userId}`; }

export function readReviewIds(userId: string): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(reviewReadKey(userId)) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
}

export function markReviewRead(userId: string, commentId: string) {
  try {
    const ids = readReviewIds(userId);
    if (!ids.includes(commentId)) window.localStorage.setItem(reviewReadKey(userId), JSON.stringify([...ids, commentId]));
  } catch { /* In private storage modes the current tab still updates. */ }
  window.dispatchEvent(new CustomEvent(reviewReadEvent, { detail: { userId, commentId } }));
}

export function reviewLink(projectId: string, commentId: string) {
  return `/manuscrito?${new URLSearchParams({ projeto: projectId, comentario: commentId })}`;
}
