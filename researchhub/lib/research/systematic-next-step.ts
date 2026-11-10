export type ScreeningProgress = { total: number; pending: number; included: number; findings: number };
export function systematicNextStep(progress: ScreeningProgress | null) {
  if (!progress) return "check";
  if (!progress.total) return "search";
  if (progress.pending === progress.total) return "start";
  if (progress.pending) return "continue";
  if (!progress.included) return "searchAgain";
  if (progress.findings < progress.included) return "extract";
  return "write";
}
