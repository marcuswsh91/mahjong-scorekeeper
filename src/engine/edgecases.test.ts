import { describe, expect, it } from 'vitest';
import { scoreHand } from './score';
import { ctx, hand, rules } from './testkit';

const tai = (r: ReturnType<typeof scoreHand>) => (r.legal ? Object.fromEntries(r.lines.map((l) => [l.id, l.tai])) : r.reasons);

describe('edge cases', () => {
  it('eight flowers in an ordinary tile hand: 2 正花 + two 花槓', () => {
    const r = scoreHand(hand('234s 678m 55p', '4s', { melds: ['chi 123m', 'chi 456p', 'pon 999s'], flowers: 'f1 f2 f3 f4 f5 f6 f7 f8' }), ctx({ from: 2 }), rules());
    expect(tai(r)).toEqual({ zhenghua: 2, huagang: 4 });
  });
  it('four kongs (21 tiles) is legal', () => {
    const r = scoreHand(hand('678m 33p', '6m', { melds: ['minkan 1111m', 'minkan 5555p', 'ankan 9999s', 'ankan 2222s'] }), ctx(), rules());
    expect(tai(r)).toEqual({ zimo: 1 });
    expect(r.legal && r.payments.map((p) => p.amount)).toEqual([5, 4, 4]);
  });
  it('a kong hand entered without the extra tile is rejected with the count', () => {
    const r = scoreHand(hand('678m 5p', '6m', { melds: ['minkan 1111m', 'chi 123p', 'chi 456p', 'pon 999s'] }), ctx(), rules());
    expect(r.legal ? [] : r.reasons).toContain('Expected 18 tiles (17 + 1 for kong), got 17: 4 concealed + 13 in exposed sets.');
  });
});
