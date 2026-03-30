import { FIT_SCORE_WEIGHTS } from "./types";

interface SubScores {
  transport: number;
  safety: number;
  rentValue: number;
  newBuilds: number;
  amenities: number;
  areaQuality: number;
}

export function calculateFitScore(scores: SubScores): number {
  const weighted =
    scores.transport * FIT_SCORE_WEIGHTS.transport +
    scores.safety * FIT_SCORE_WEIGHTS.safety +
    scores.rentValue * FIT_SCORE_WEIGHTS.rentValue +
    scores.newBuilds * FIT_SCORE_WEIGHTS.newBuilds +
    scores.amenities * FIT_SCORE_WEIGHTS.amenities +
    scores.areaQuality * FIT_SCORE_WEIGHTS.areaQuality;

  return Math.round(weighted * 100) / 100;
}
