export const talentGames = ["reaction", "memory", "reasoning", "focus"] as const;
export type TalentGame = typeof talentGames[number];
export function isTalentGame(value: string | undefined): value is TalentGame {
  return talentGames.some(game => game === value);
}
export type TalentQuestion = { numbers?: number[]; choices?: number[]; word?: number; ink?: number };
export type TalentAttempt = { id: string; game: TalentGame; challenge: { sequence?: number[]; questions?: TalentQuestion[] } };
export type TalentSubmission = { samples_ms?: number[]; answers?: number[] };
export type TalentResult = { id: number; game: TalentGame; score: number; correct: number; wrong: number };
export type TalentRank = { user_id: number; login: string; avatar_url: string; score: number; rank: number };
export type TalentBoard = { items: TalentRank[]; own: TalentRank | null };
