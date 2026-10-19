export const jStat: {
  ibeta(x: number, a: number, b: number): number;
  studentt: { cdf(x: number, df: number): number; inv(p: number, df: number): number };
  chisquare: { cdf(x: number, df: number): number };
};
