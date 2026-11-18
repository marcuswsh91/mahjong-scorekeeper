// Property: for random legal hands, dice and rule sets, every hand's payments sum to zero.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CATALOGUE, type RuleValue } from '../rules/catalogue';
import { defaultRuleSet, type RuleSet } from '../rules/ruleset';
import { scoreHand } from './score';
import { ALL_FLOWERS, ALL_TILES } from './tiles';
import { emptyFlags, type HandContext, type HandEntry, type Meld, type Seat } from './types';

type SetSpec = { chow: boolean; tile: number; meld: 0 | 1 | 2 | 3 }; // meld: 0 concealed, 1 chi/pon, 2 minkan, 3 ankan

const setArb: fc.Arbitrary<SetSpec> = fc.record({
  chow: fc.boolean(),
  tile: fc.integer({ min: 0, max: 33 }),
  meld: fc.constantFrom<0 | 1 | 2 | 3>(0, 0, 1, 2, 3),
});

/** Build a legal hand from 5 set specs + a pair tile, or null if tile counts overflow. */
function build(sets: SetSpec[], pairTile: number, winPick: number, flowers: boolean[], flags: { last: boolean; repl: boolean; rob: boolean; first: boolean }, zimo: boolean): HandEntry | null {
  const count = new Array(34).fill(0);
  const concealed: string[] = [];
  const melds: Meld[] = [];
  for (const s of sets) {
    let tiles: number[];
    const chow = s.chow && s.tile < 27 && s.tile % 9 <= 6;
    if (chow) tiles = [s.tile, s.tile + 1, s.tile + 2];
    else tiles = [s.tile, s.tile, s.tile];
    if (!chow && s.meld >= 2) tiles.push(s.tile);
    tiles.forEach((t) => count[t]++);
    const codes = tiles.map((t) => ALL_TILES[t]);
    if (s.meld === 0) concealed.push(...codes);
    else if (chow) melds.push({ kind: 'chi', tiles: codes });
    else melds.push({ kind: s.meld === 1 ? 'pon' : s.meld === 2 ? 'minkan' : 'ankan', tiles: codes });
  }
  count[pairTile] += 2;
  concealed.push(ALL_TILES[pairTile], ALL_TILES[pairTile]);
  if (count.some((c) => c > 4)) return null;
  return {
    concealed,
    melds,
    winningTile: concealed[winPick % concealed.length],
    flowers: ALL_FLOWERS.filter((_, i) => flowers[i]),
    flags: { ...emptyFlags(), lastTile: flags.last, kongReplacement: zimo && flags.repl, robbedKong: !zimo && flags.rob, firstDraw: flags.first },
    customItems: [],
    source: 'manual',
  };
}

const rulesArb: fc.Arbitrary<RuleSet> = fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: CATALOGUE.length, maxLength: CATALOGUE.length }).map((rand) => {
  const r = defaultRuleSet();
  const values: Record<string, RuleValue> = {};
  CATALOGUE.forEach((item, i) => {
    const x = rand[i];
    if (item.kind === 'tai') values[item.id] = x % 11;
    else if (item.kind === 'number') values[item.id] = item.min + (x % 5);
    else if (item.kind === 'yesno') values[item.id] = x % 2 === 0;
    else values[item.id] = item.options[x % item.options.length].value;
  });
  return { ...r, values };
});

const seatArb = fc.constantFrom<Seat>(0, 1, 2, 3);
const diceArb = fc.option(fc.tuple(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 6 })), { nil: null });

describe('zero-sum (fast-check)', () => {
  it('every legal hand\'s payments sum to zero, with the right number of payers', () => {
    let scored = 0;
    fc.assert(
      fc.property(
        fc.array(setArb, { minLength: 5, maxLength: 5 }), fc.integer({ min: 0, max: 33 }), fc.nat(),
        fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
        fc.record({ last: fc.boolean(), repl: fc.boolean(), rob: fc.boolean(), first: fc.boolean() }),
        seatArb, seatArb, seatArb, fc.boolean(), fc.integer({ min: 0, max: 6 }), fc.nat({ max: 3 }), diceArb, rulesArb,
        (sets, pair, winPick, flowers, flags, dealer, winner, discarder, zimoPick, streak, round, dice, rules) => {
          const zimo = zimoPick || discarder === winner;
          const entry = build(sets, pair, winPick, flowers, flags, zimo);
          if (!entry) return; // tile overflow: not a legal hand, skip
          const ctx: HandContext = { dealer, winner, roundWind: round, streak, dice, from: zimo ? 'zimo' : discarder };
          const r = scoreHand(entry, ctx, rules);
          if (!r.legal) throw new Error(`Generated hand judged illegal: ${r.reasons.join('; ')}`);
          scored++;
          expect(r.net.reduce((a, b) => a + b, 0)).toBe(0);
          expect(r.payments.reduce((a, p) => a + p.amount, 0)).toBe(r.net[winner]);
          expect(r.payments.length).toBe(zimo ? 3 : 1);
          for (const p of r.payments) {
            expect(p.to).toBe(winner);
            expect(p.amount).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: 2000 },
    );
    expect(scored).toBeGreaterThan(500);
  });
});
