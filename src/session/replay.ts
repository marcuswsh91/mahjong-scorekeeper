import type { Payment } from '../engine/payments';
import { classifyDice } from '../engine/payments';
import { scoreFalseWin, scoreHand, type ScoreResult } from '../engine/score';
import type { HandContext, Seat } from '../engine/types';
import { yes, type RuleSnapshot } from '../rules/ruleset';
import { effectiveEvents, type Dice, type SessionEvent } from './events';
import { advance, seatingProblem, START, type Change, type RotationState } from './rotation';

export interface Session {
  schema: 1;
  id: string;
  createdAt: string;
  snapshot: RuleSnapshot; // frozen rules: old sessions never change
  events: SessionEvent[]; // append-only
}

export const WIND = ['東', '南', '西', '北'];

export interface HandRecord {
  eventId: string;
  no: number; // hand number in the session, from 1
  kind: 'win' | 'draw' | 'falseWin';
  seats: readonly string[]; // seating in force
  before: RotationState;
  dice: Dice; // the roll actually applied (after any carry-over)
  score?: ScoreResult; // wins
  falseWinTai?: number;
  payments: Payment[];
  netByPlayer: Record<string, number>;
  change: Change;
  /** What happens next, in words. */
  nextText: string;
  /** Problems that don't block play (e.g. an edit left this hand out of place). */
  warnings: string[];
}

export interface NextStep {
  kind: 'needSeating' | 'play';
  text: string;
  rotation: RotationState;
}

export interface SessionState {
  hands: HandRecord[];
  totals: Record<string, number>;
  seats: readonly string[] | null;
  next: NextStep;
  seatingWarnings: string[];
}

export function streakText(streak: number): string {
  return streak > 0 ? `連${streak}拉${streak}` : 'first deal';
}

function describeNext(r: RotationState, seats: readonly string[], change: Change): string {
  const dealer = seats[r.dealer];
  switch (change) {
    case 'stays': return `Dealer stays: ${dealer}, ${streakText(r.streak)}.`;
    case 'passes': return `Dealer passes to ${dealer}.`;
    case 'roundChanges': return `Round wind changes to ${WIND[r.roundWind]}. ${dealer} deals.`;
    case 'jiangOver': return '將 over: redraw seats.';
  }
}

/** Recompute everything from the log with the session's own rule snapshot. */
export function replay(session: Session): SessionState {
  const rules = session.snapshot.rules;
  const hands: HandRecord[] = [];
  const totals: Record<string, number> = {};
  const seatingWarnings: string[] = [];
  let seats: readonly string[] | null = null;
  let prevSeats: readonly string[] | null = null;
  let rot: RotationState = START;
  let carried: Dice = null; // a drawn hand's roll, if bonuses carry over

  for (const e of effectiveEvents(session.events)) {
    if (e.type === 'seating') {
      const problem = seatingProblem(prevSeats, e.seats);
      if (problem) seatingWarnings.push(`Seat draw ${e.seats.join(', ')}: ${problem}`);
      if (seats && !rot.jiangOver) seatingWarnings.push(`Seats were redrawn before the 將 ended (${WIND[rot.roundWind]} round, ${seats[rot.dealer]} dealing).`);
      seats = e.seats;
      prevSeats = e.seats;
      rot = START;
      carried = null;
      continue;
    }

    const warnings: string[] = [];
    if (!seats) {
      warnings.push('No seating before this hand; seats assumed.');
      seats = ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4'];
    }
    if (rot.jiangOver) warnings.push('The 將 was over before this hand; seats should have been redrawn.');
    const before = rot;

    // Dice: a carried-over roll is used only when this hand's own roll gives no bonus.
    let dice = e.dice;
    if (carried && classifyDice(dice, rules).kind === 'none') dice = carried;
    carried = null;

    let payments: Payment[] = [];
    let score: ScoreResult | undefined;
    let falseWinTai: number | undefined;
    let outcome: Parameters<typeof advance>[1];
    if (e.type === 'win') {
      const ctx: HandContext = { dealer: rot.dealer, roundWind: rot.roundWind, streak: rot.streak, dice, winner: e.winner, from: e.from };
      score = scoreHand(e.entry, ctx, rules);
      if (score.legal) payments = score.payments;
      else warnings.push(`Not scored: ${score.reasons.join(' ')}`);
      outcome = e.winner === rot.dealer ? 'dealerWins' : 'nonDealerWins';
    } else if (e.type === 'draw') {
      outcome = 'draw';
      if (yes(rules, 'diceCarryOver') && classifyDice(dice, rules).kind !== 'none') carried = dice;
    } else {
      const fw = scoreFalseWin(e.offender as Seat, { dealer: rot.dealer, streak: rot.streak, dice }, rules, e.announcedTai);
      payments = fw.payments;
      falseWinTai = fw.tai;
      outcome = 'falseWin';
    }

    const netByPlayer: Record<string, number> = {};
    for (const p of payments) {
      const from = seats[p.from], to = seats[p.to];
      netByPlayer[from] = (netByPlayer[from] ?? 0) - p.amount;
      netByPlayer[to] = (netByPlayer[to] ?? 0) + p.amount;
    }
    for (const name of seats) totals[name] = (totals[name] ?? 0) + (netByPlayer[name] ?? 0);

    const { next, change } = advance(rot, outcome, rules);
    rot = next;
    hands.push({
      eventId: e.id, no: hands.length + 1, kind: e.type, seats, before, dice, score, falseWinTai,
      payments, netByPlayer, change, nextText: describeNext(rot, seats, change), warnings,
    });
  }

  const next: NextStep = !seats
    ? { kind: 'needSeating', text: 'Draw seats to start.', rotation: rot }
    : rot.jiangOver
      ? { kind: 'needSeating', text: '將 over: redraw seats.', rotation: rot }
      : { kind: 'play', text: `${WIND[rot.roundWind]}風${WIND[rot.dealer]}: ${seats[rot.dealer]} deals, ${streakText(rot.streak)}.`, rotation: rot };
  return { hands, totals, seats, next, seatingWarnings };
}
