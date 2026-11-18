// Worked payouts for the interview read-back, computed by the real engine from the answers.
import { scoreHand } from '../engine/score';
import { parseTiles } from '../engine/tiles';
import { emptyFlags, type HandContext, type HandEntry, type MeldKind } from '../engine/types';
import type { RuleSet } from '../rules/ruleset';

const SEAT_LABEL = ['東 (dealer)', '南', '西', '北'];

function hand(concealed: string, win: string, melds: string[]): HandEntry {
  return {
    concealed: parseTiles(concealed),
    melds: melds.map((m) => { const [k, t] = m.split(' '); return { kind: k as MeldKind, tiles: parseTiles(t) }; }),
    winningTile: win, flowers: [], flags: emptyFlags(), customItems: [], source: 'manual',
  };
}
const ONLY_ZIMO = () => hand('234s 678m 55p', '4s', ['chi 123m', 'chi 456p', 'pon 999s']);
const PENGPENG = () => hand('333s 777m 99p', '7m', ['pon 222m', 'pon 555p', 'pon 888s']);
const QINGYISE = () => hand('234m 567m 999m 111m 88m', '8m', ['chi 123m']);
const ctx = (o: Partial<HandContext>): HandContext => ({ dealer: 0, roundWind: 0, streak: 0, dice: null, winner: 1, from: 'zimo', ...o });

export interface WorkedExample {
  title: string;
  hand: string;
  taiLines: string[];
  payments: { payer: string; amount: number; working: string }[];
  error?: string;
}

const EXAMPLES: { title: string; hand: string; entry: () => HandEntry; ctx: HandContext }[] = [
  { title: 'Non-dealer self-draw, only 自摸', hand: '吃123m 吃456p 碰999s + 234s 678m 55p, 自摸 4s', entry: ONLY_ZIMO, ctx: ctx({}) },
  { title: '碰碰胡 self-draw', hand: '碰222m 碰555p 碰888s + 333s 777m 99p, 自摸 7m', entry: PENGPENG, ctx: ctx({}) },
  { title: 'Same 碰碰胡, dealer rolled 4-5-6', hand: 'as above', entry: PENGPENG, ctx: ctx({ dice: [4, 5, 6] }) },
  { title: 'Same 碰碰胡, dealer rolled a triple', hand: 'as above', entry: PENGPENG, ctx: ctx({ dice: [3, 3, 3] }) },
  { title: 'Dealer on 連2拉2 wins 清一色 off a discard', hand: '吃123m + 234m 567m 999m 111m 88m, 西 discards 8m', entry: QINGYISE, ctx: ctx({ winner: 0, from: 2, streak: 2 }) },
];

export function workedExamples(rules: RuleSet): WorkedExample[] {
  return EXAMPLES.map((ex) => {
    const r = scoreHand(ex.entry(), ex.ctx, rules);
    if (!r.legal) return { title: ex.title, hand: ex.hand, taiLines: [], payments: [], error: r.reasons.join(' ') };
    return {
      title: ex.title,
      hand: ex.hand,
      taiLines: r.lines.length ? r.lines.map((l) => `${l.zh} ${l.tai}`) : ['No hand tai (base only)'],
      payments: r.payments.map((p) => ({ payer: SEAT_LABEL[p.from], amount: p.amount, working: p.lines.slice(1).join(' · ') })),
    };
  });
}
