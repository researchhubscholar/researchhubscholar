/** Capture before awaiting: edits made during synchronization belong to a later version. */
export async function preserveVersion<T, R>(snapshot: T, synchronize: () => Promise<boolean>, persist: (saved: T) => Promise<R>): Promise<R> {
  const captured = structuredClone(snapshot);
  if (!await synchronize()) throw new Error("O manuscrito ainda não foi salvo. Tente salvar novamente antes de criar uma versão.");
  return persist(captured);
}
