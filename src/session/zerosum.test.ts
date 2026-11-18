// Property: for random event logs (wins, 流局, 詐胡, redraws, undos, edits) and random
// rule sets, every hand nets to zero and the session totals sum to zero.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CATALOGUE, type RuleValue } from '../rules/catalogue';
import { defaultRuleSet, snapshot, type RuleSet } from '../rules/ruleset';
import { hand } from '../engine/testkit';
import type { Seat } from '../engine/types';
import type { BaseEvent, SessionEvent } from './events';
import { replay } from './replay';
import { settle } from './settle';

const HANDS = [
  () => hand('234s 678m 55p', '4s', { melds: ['chi 123m', 'chi 456p', 'pon 999s'] }),
  () => hand('333s 777m 99p', '7m', { melds: ['pon 222m', 'pon 555p', 'pon 888s'] }),
  () => hand('123m 456p 234s 678m 789s 55p', '4s', { flowers: 'f1 f2' }),
  () => hand('111m 555p 999p 222s 333s 77s', '7s'),
];

const rulesArb: fc.Arbitrary<RuleSet> = fc.array(fc.nat(1000), { minLength: CATALOGUE.length, maxLength: CATALOGUE.length }).map((rand) => {
  const values: Record<string, RuleValue> = {};
  CATALOGUE.forEach((item, i) => {
    const x = rand[i];
    if (item.kind === 'tai') values[item.id] = x % 11;
    else if (item.kind === 'number') values[item.id] = item.min + (x % 5);
    else if (item.kind === 'yesno') values[item.id] = x % 2 === 0;
    else values[item.id] = item.options[x % item.options.length].value;
  });
  return { ...defaultRuleSet(), values };
});

const seat = fc.constantFrom<Seat>(0, 1, 2, 3);
const dice = fc.option(fc.tuple(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 6 })), { nil: null });
type Step = { kind: number; a: Seat; b: Seat; zimo: boolean; h: number; tai: number; dice: [number, number, number] | null; target: number };
const step: fc.Arbitrary<Step> = fc.record({
  kind: fc.nat(9), a: seat, b: seat, zimo: fc.boolean(), h: fc.nat(HANDS.length - 1), tai: fc.nat(20), dice, target: fc.nat(),
});

function toLog(steps: Step[]): SessionEvent[] {
  const log: SessionEvent[] = [{ type: 'seating', id: 'seat0', at: '', seats: ['Amy', 'Ben', 'Cat', 'Dan'] }];
  steps.forEach((s, i) => {
    const id = `e${i}`;
    const zimo = s.zimo || s.a === s.b;
    const base: BaseEvent =
      s.kind <= 4 ? { type: 'win', id, at: '', dice: s.dice, winner: s.a, from: zimo ? 'zimo' : s.b, entry: HANDS[s.h]() }
      : s.kind === 5 ? { type: 'draw', id, at: '', dice: s.dice }
      : s.kind === 6 ? { type: 'falseWin', id, at: '', dice: s.dice, offender: s.a, announcedTai: s.tai }
      : s.kind === 7 ? { type: 'seating', id, at: '', seats: s.zimo ? ['Ben', 'Amy', 'Dan', 'Cat'] : ['Cat', 'Dan', 'Amy', 'Ben'] }
      : { type: 'draw', id, at: '', dice: s.dice };
    const targets = log.filter((e) => e.type !== 'undo' && e.type !== 'amend');
    const target = targets[s.target % targets.length].id;
    if (s.kind === 8) log.push({ type: 'undo', id, at: '', target });
    else if (s.kind === 9) log.push({ type: 'amend', id, at: '', target, replacement: { ...base, id: target } });
    else log.push(base);
  });
  return log;
}

describe('session zero-sum (fast-check)', () => {
  it('every hand and the whole session net to zero, and settlement clears it', () => {
    fc.assert(
      fc.property(fc.array(step, { maxLength: 40 }), rulesArb, (steps, rules) => {
        const st = replay({ schema: 1, id: 'p', createdAt: '', snapshot: snapshot(rules), events: toLog(steps) });
        for (const h of st.hands) expect(Object.values(h.netByPlayer).reduce((a, b) => a + b, 0)).toBe(0);
        expect(Object.values(st.totals).reduce((a, b) => a + b, 0)).toBe(0);
        const left = { ...st.totals };
        for (const t of settle(st.totals)) { left[t.from] += t.amount; left[t.to] -= t.amount; }
        expect(Object.values(left).every((v) => v === 0)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });
});
