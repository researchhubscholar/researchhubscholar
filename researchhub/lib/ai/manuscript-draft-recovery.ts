/** A stale server-verified evidence checkpoint can be safely rebuilt once.
 * Failures in auth, billing, quota or provider availability are never retried. */
export function shouldRefreshDraftEvidence(error: unknown): boolean {
  const message=error instanceof Error?error.message:String(error||"");
  return /projeto mudou|análise anterior não pertence|uma das análises não foi encontrada|uma análise não foi encontrada/i.test(message);
}
