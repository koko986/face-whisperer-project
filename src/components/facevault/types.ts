import type { MatchResult, RankSample } from "@/lib/facevault/face";

export type Analysis = {
  preview: string;
  base: MatchResult;
  ranks: RankSample[];
  singularValues: number[];
  origin: string;
  at: number;
};
