export function transverseNextStep(hasData: boolean | null, hasResultsText: boolean | null, collectionDone: boolean) {
  if (hasResultsText === true) return "write";
  if (hasData === null) return "check";
  if (hasData) return "analyze";
  return collectionDone ? "import" : "collect";
}
