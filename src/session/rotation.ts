import type { Seat } from '../engine/types';
import { choice, yes, type RuleSet } from '../rules/ruleset';

export interface RotationState {
  roundWind: number; // 0..3 東南西北
  dealer: Seat;
  streak: number; // N in 連N拉N
  jiangOver: boolean; // 北風北 finished: redraw seats
}

export type Outcome = 'dealerWins' | 'nonDealerWins' | 'draw' | 'falseWin';
export type Change = 'stays' | 'passes' | 'roundChanges' | 'jiangOver';

export const START: RotationState = { roundWind: 0, dealer: 0, streak: 0, jiangOver: false };

/**
 * One hand's effect on the deal:
 * - dealer wins, or 流局 → dealer stays, streak +1 (a 流局 adds only if the rule says so)
 * - non-dealer wins → deal passes counterclockwise to the next seat, streak resets
 * - all four seats have dealt (the deal returns to seat 0) → round wind advances
 * - after 北風北 → the 將 is over
 * - 詐胡 → per the rule: dealer stays (streak unchanged) or passes
 */
export function advance(s: RotationState, outcome: Outcome, rules: RuleSet): { next: RotationState; change: Change } {
  const stay = (add: number) => ({ next: { ...s, streak: s.streak + add }, change: 'stays' as Change });
  if (outcome === 'dealerWins') return stay(1);
  if (outcome === 'draw') return stay(yes(rules, 'drawExtendsStreak') ? 1 : 0);
  if (outcome === 'falseWin' && choice(rules, 'falseWinDealerAfter') !== 'passes') return stay(0);

  const dealer = ((s.dealer + 1) % 4) as Seat;
  if (dealer !== 0) return { next: { ...s, dealer, streak: 0 }, change: 'passes' };
  if (s.roundWind === 3) return { next: { roundWind: 3, dealer: 0, streak: 0, jiangOver: true }, change: 'jiangOver' };
  return { next: { roundWind: s.roundWind + 1, dealer: 0, streak: 0, jiangOver: false }, change: 'roundChanges' };
}

/** Problem with a new seat draw, or null. Same player in every seat as before = draw again. */
export function seatingProblem(prev: readonly string[] | null, seats: readonly string[]): string | null {
  const names = seats.map((n) => n.trim());
  if (names.some((n) => !n)) return 'Every seat needs a player.';
  if (new Set(names).size !== 4) return 'Each player can only sit in one seat.';
  if (prev && prev.every((p, i) => p === names[i])) return 'The seating came out the same as last 將: draw again.';
  return null;
}
