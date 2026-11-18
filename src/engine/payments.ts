import { num, yes, type RuleSet } from '../rules/ruleset';
import type { Seat } from './types';

export interface DiceBonus {
  kind: 'none' | 'straight' | '456' | 'triple';
  label: string;
  tai: number; // straight / 4-5-6 tai
  mult: number; // triple multiplier (1 = none)
}

/** Dealer's roll, dice in any order. Values come from the rule set. */
export function classifyDice(dice: [number, number, number] | null, rules: RuleSet): DiceBonus {
  if (!dice) return { kind: 'none', label: 'No roll entered', tai: 0, mult: 1 };
  const [a, b, c] = dice.slice().sort((x, y) => x - y);
  const roll = `${a}-${b}-${c}`;
  if (a === b && b === c) {
    const m = num(rules, 'diceTripleMult');
    return { kind: 'triple', label: `Triple ${roll}`, tai: 0, mult: Math.max(1, m) };
  }
  if (a === 4 && b === 5 && c === 6) return { kind: '456', label: roll, tai: num(rules, 'dice456'), mult: 1 };
  if (b === a + 1 && c === a + 2) return { kind: 'straight', label: `Straight ${roll}`, tai: num(rules, 'diceStraight'), mult: 1 };
  return { kind: 'none', label: `${roll}: no bonus`, tai: 0, mult: 1 };
}

export interface Payment {
  from: Seat;
  to: Seat;
  amount: number;
  /** Line-by-line working the table can check. */
  lines: string[];
}

/**
 * One payer's amount. Dice are applied last:
 *   no triple: base + ppt × (hand tai + dealer tai + dice tai)
 *   triple:    (base + ppt × (hand tai + dealer tai)) × mult   [dealer tai inside ×, by default]
 *              (base + ppt × hand tai) × mult + ppt × dealer tai   [if the rule says No]
 */
export function payerAmount(handTai: number, dealerTai: number, dealerLabel: string, dice: DiceBonus, rules: RuleSet): { amount: number; lines: string[] } {
  const base = num(rules, 'basePoints');
  const ppt = num(rules, 'pointsPerTai');
  const lines = [`底 base ${base}`, `Hand ${handTai} tai`];
  if (dealerTai) lines.push(`${dealerLabel}: ${dealerTai} tai`);
  const per = (t: number) => (ppt === 1 ? `${t}` : `${t} × ${ppt}`);

  if (dice.kind === 'triple' && dice.mult > 1) {
    if (yes(rules, 'diceTripleDealer') || !dealerTai) {
      const tai = handTai + dealerTai;
      const amount = (base + ppt * tai) * dice.mult;
      lines.push(`Dice ${dice.label}: × ${dice.mult}`, `(${base} + ${per(tai)}) × ${dice.mult} = ${amount}`);
      return { amount, lines };
    }
    const amount = (base + ppt * handTai) * dice.mult + ppt * dealerTai;
    lines.push(`Dice ${dice.label}: × ${dice.mult} (dealer tai added after)`, `(${base} + ${per(handTai)}) × ${dice.mult} + ${per(dealerTai)} = ${amount}`);
    return { amount, lines };
  }
  if (dice.tai) lines.push(`Dice ${dice.label}: +${dice.tai} tai`);
  const tai = handTai + dealerTai + dice.tai;
  const amount = base + ppt * tai;
  lines.push(`${base} + ${per(tai)} = ${amount}`);
  return { amount, lines };
}

/** Dealer tai for a streak: 莊家 + 連莊拉莊 × N. */
export function dealerTaiFor(streak: number, rules: RuleSet): { tai: number; label: string } {
  const tai = num(rules, 'dealer') + num(rules, 'streak') * streak;
  return { tai, label: streak > 0 ? `莊家 連${streak}拉${streak}` : '莊家' };
}

/** Net per seat from a list of payments (sums to zero). */
export function netBySeat(payments: Payment[]): [number, number, number, number] {
  const net: [number, number, number, number] = [0, 0, 0, 0];
  for (const p of payments) { net[p.from] -= p.amount; net[p.to] += p.amount; }
  return net;
}
