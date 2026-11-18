// Golden hands: each has a hand-checked tai breakdown and payments.
// Default rules: base 3, 1 point per tai, 莊家 1, 連莊拉莊 2 each. Dealer is seat 0 (東),
// winner is seat 1 (南) unless stated; round wind 東.
import { describe, expect, it } from 'vitest';
import { validateRuleSet } from '../rules/ruleset';
import { scoreFalseWin, scoreHand, type LegalScore } from './score';
import { ctx, hand, rules } from './testkit';
import type { HandContext, HandEntry } from './types';

type Pay = [from: number, to: number, amount: number];
interface Golden {
  name: string;
  entry: HandEntry;
  ctx: HandContext;
  rules?: ReturnType<typeof rules>;
  tai: Record<string, number>; // exact set of hand tai lines
  pay: Pay[];
  waits?: string[];
}

// Reusable synthetic hands
const M3 = ['chi 123m', 'chi 456p', 'pon 999s'];
/** Not concealed, two-sided wait 1s/4s, no honours: worth 0 tai off a discard, 自摸 only on zimo. */
const plain = (o: Parameters<typeof hand>[2] = {}) => hand('234s 678m 55p', '4s', { melds: M3, ...o });
/** Fully concealed, all chows, two-sided wait 1s/4s. */
const closed = (o: Parameters<typeof hand>[2] = {}) => hand('123m 456p 234s 678m 789s 55p', '4s', o);
/** 碰碰胡 with a 對碰 wait (7m / 9p). */
const pengpeng = () => hand('333s 777m 99p', '7m', { melds: ['pon 222m', 'pon 555p', 'pon 888s'] });
const ALL8 = 'f1 f2 f3 f4 f5 f6 f7 f8';

const zimoPay = (dealerPays: number, otherPays: number, winner = 1): Pay[] =>
  [0, 1, 2, 3].filter((s) => s !== winner).map((s) => [s, winner, s === 0 ? dealerPays : otherPays]);

const GOLDEN: Golden[] = [
  // ── Read-back examples ──
  { name: 'RB1 non-dealer zimo, only 自摸: non-dealers pay 4, dealer 4 + 1', entry: plain(), ctx: ctx(),
    tai: { zimo: 1 }, pay: zimoPay(5, 4), waits: ['1s', '4s'] },
  { name: 'RB2 碰碰胡 zimo', entry: pengpeng(), ctx: ctx(),
    tai: { zimo: 1, pengpeng: 4 }, pay: zimoPay(9, 8), waits: ['7m', '9p'] },
  { name: 'RB3 碰碰胡 zimo with 4-5-6 (+2)', entry: pengpeng(), ctx: ctx({ dice: [6, 4, 5] }),
    tai: { zimo: 1, pengpeng: 4 }, pay: zimoPay(11, 10) },
  { name: 'RB4 碰碰胡 zimo with a triple (×3, dealer tai inside)', entry: pengpeng(), ctx: ctx({ dice: [2, 2, 2] }),
    tai: { zimo: 1, pengpeng: 4 }, pay: zimoPay(27, 24) },
  { name: 'RB5 dealer on 連2拉2 wins 清一色 off a discard (dealer tai 5)',
    entry: hand('234m 567m 999m 111m 88m', '8m', { melds: ['chi 123m'] }), ctx: ctx({ winner: 0, from: 2, streak: 2 }),
    tai: { qingyise: 8 }, pay: [[2, 0, 16]] },

  // ── Payers and dealer tai ──
  { name: 'Discard win between non-dealers: no dealer tai, 0-tai hand pays base', entry: plain(), ctx: ctx({ from: 2 }),
    tai: {}, pay: [[2, 1, 3]], waits: ['1s', '4s'] },
  { name: 'Non-dealer wins off the dealer: dealer pays dealer tai', entry: plain(), ctx: ctx({ from: 0 }),
    tai: {}, pay: [[0, 1, 4]] },
  { name: 'Dealer zimo on 連1拉1 (+3 each)', entry: plain(), ctx: ctx({ winner: 0, streak: 1 }),
    tai: { zimo: 1 }, pay: zimoPay(0, 7, 0) },
  { name: 'Dice straight 3-1-2 (+1)', entry: plain(), ctx: ctx({ dice: [3, 1, 2] }),
    tai: { zimo: 1 }, pay: zimoPay(6, 5) },
  { name: 'Dice 2-5-6: no bonus', entry: plain(), ctx: ctx({ dice: [2, 5, 6] }),
    tai: { zimo: 1 }, pay: zimoPay(5, 4) },
  { name: 'Triple with dealer tai outside the × (rule No)', entry: pengpeng(), ctx: ctx({ dice: [4, 4, 4] }),
    rules: rules({ diceTripleDealer: false }), tai: { zimo: 1, pengpeng: 4 }, pay: zimoPay(25, 24) },
  { name: 'Non-dealer zimo, rule "only dealer pays dealer tai" = No', entry: plain(), ctx: ctx(),
    rules: rules({ zimoDealerOnly: false }), tai: { zimo: 1 }, pay: zimoPay(5, 5) },

  // ── How you won ──
  { name: '門清自摸 replaces 門清 + 自摸', entry: closed(), ctx: ctx(),
    tai: { menqingZimo: 3 }, pay: zimoPay(7, 6) },
  { name: '門清自摸 Off: 門清 + 自摸 count separately', entry: closed(), ctx: ctx(), rules: rules({ menqingZimo: 0 }),
    tai: { zimo: 1, menqing: 1 }, pay: zimoPay(6, 5) },
  { name: '平胡 + 門清 off a discard', entry: closed(), ctx: ctx({ from: 2 }),
    tai: { menqing: 1, pinghu: 2 }, pay: [[2, 1, 6]] },
  { name: 'Near-平胡 with a non-seat flower: no 平胡', entry: closed({ flowers: 'f1' }), ctx: ctx({ from: 2 }),
    tai: { menqing: 1 }, pay: [[2, 1, 4]] },
  { name: '全求人 does not stack with 獨聽', entry: hand('99p', '9p', { melds: ['chi 123m', 'pon 555p', 'chi 789s', 'pon 222s', 'chi 456m'] }),
    ctx: ctx({ from: 2 }), tai: { quanqiuren: 2 }, pay: [[2, 1, 5]], waits: ['9p'] },
  { name: '獨聽 邊張 (12s waiting 3s)', entry: hand('123s 678m 55p', '3s', { melds: M3 }), ctx: ctx({ from: 2 }),
    tai: { duting: 1 }, pay: [[2, 1, 4]], waits: ['3s'] },
  { name: '獨聽 中洞 (2_4s waiting 3s)', entry: hand('234s 678m 55p', '3s', { melds: M3 }), ctx: ctx({ from: 2 }),
    tai: { duting: 1 }, pay: [[2, 1, 4]], waits: ['3s'] },
  { name: '獨聽 單吊 (waiting 5p)', entry: hand('234s 678m 55p', '5p', { melds: M3 }), ctx: ctx({ from: 2 }),
    tai: { duting: 1 }, pay: [[2, 1, 4]], waits: ['5p'] },
  { name: 'Looks 單吊 but 2m also wins (2345m): no 獨聽', entry: hand('23455m 678s', '5m', { melds: ['chi 123p', 'chi 456p', 'pon 999s'] }),
    ctx: ctx({ from: 2 }), tai: {}, pay: [[2, 1, 3]], waits: ['2m', '5m'] },
  { name: '槓上開花 + 自摸 with a 明槓 (18 tiles)', entry: hand('234s 678m 55p', '4s', { melds: ['chi 123m', 'chi 456p', 'minkan 9999s'], flags: { kongReplacement: true } }),
    ctx: ctx(), tai: { zimo: 1, gangshang: 1 }, pay: zimoPay(6, 5) },
  { name: '海底撈月 + 自摸', entry: plain({ flags: { lastTile: true } }), ctx: ctx(),
    tai: { zimo: 1, haidi: 1 }, pay: zimoPay(6, 5) },
  { name: '河底撈魚', entry: plain({ flags: { lastTile: true } }), ctx: ctx({ from: 2 }),
    tai: { hedi: 1 }, pay: [[2, 1, 4]] },
  { name: '搶槓 (kong maker pays)', entry: plain({ flags: { robbedKong: true } }), ctx: ctx({ from: 3 }),
    tai: { qianggang: 1 }, pay: [[3, 1, 4]] },
  { name: '報聽 when on', entry: plain({ flags: { ready: 'declared' } }), ctx: ctx({ from: 2 }), rules: rules({ baoting: 1 }),
    tai: { baoting: 1 }, pay: [[2, 1, 4]] },
  { name: '天聽 replaces 報聽', entry: plain({ flags: { ready: 'dealt' } }), ctx: ctx({ from: 2 }), rules: rules({ baoting: 1, tianting: 8 }),
    tai: { tianting: 8 }, pay: [[2, 1, 11]] },

  // ── Splits and concealed triplets ──
  { name: 'Two valid splits (111222333m): picks 三暗刻 over three chows',
    entry: hand('111222333m 456p 77s', '4p', { melds: ['chi 789s'] }), ctx: ctx(),
    tai: { zimo: 1, an3: 2 }, pay: zimoPay(7, 6), waits: ['4p', '7p'] },
  { name: '三暗刻 by zimo', entry: hand('111m 555p 999p 456s 77s', '9p', { melds: ['chi 789s'] }), ctx: ctx(),
    tai: { zimo: 1, an3: 2 }, pay: zimoPay(7, 6), waits: ['9p', '7s'] },
  { name: 'Same hand off a discard: 999p is not concealed, no 三暗刻', entry: hand('111m 555p 999p 456s 77s', '9p', { melds: ['chi 789s'] }),
    ctx: ctx({ from: 2 }), tai: {}, pay: [[2, 1, 3]] },
  { name: '五暗刻 + 碰碰胡 + 門清自摸 + 單吊', entry: hand('111m 555p 999p 222s 333s 77s', '7s'), ctx: ctx(),
    tai: { menqingZimo: 3, duting: 1, pengpeng: 4, an5: 8 }, pay: zimoPay(20, 19), waits: ['7s'] },
  { name: '四暗刻 off a discard (completed triplet not concealed)', entry: hand('111m 555p 999p 222s 333s 77s', '9p'), ctx: ctx({ from: 2 }),
    tai: { menqing: 1, pengpeng: 4, an4: 5 }, pay: [[2, 1, 13]] },

  // ── Winds and dragons ──
  { name: '小三元 replaces 三元刻', entry: hand('77z 456p 789s', '4p', { melds: ['pon 555z', 'pon 666z', 'chi 123m'] }), ctx: ctx({ from: 2 }),
    tai: { xiaosanyuan: 4 }, pay: [[2, 1, 7]] },
  { name: '小三元 Off: two 三元刻 instead', entry: hand('77z 456p 789s', '4p', { melds: ['pon 555z', 'pon 666z', 'chi 123m'] }), ctx: ctx({ from: 2 }),
    rules: rules({ xiaosanyuan: 0 }), tai: { dragon: 2 }, pay: [[2, 1, 5]] },
  { name: '大三元 replaces 三元刻', entry: hand('456p 99s', '4p', { melds: ['pon 555z', 'pon 666z', 'pon 777z', 'chi 123m'] }), ctx: ctx({ from: 2 }),
    tai: { dasanyuan: 8 }, pay: [[2, 1, 11]] },
  { name: '大三元 with 三元刻 stacking (rule No)', entry: hand('456p 99s', '4p', { melds: ['pon 555z', 'pon 666z', 'pon 777z', 'chi 123m'] }), ctx: ctx({ from: 2 }),
    rules: rules({ dasanyuanReplacesDragon: false }), tai: { dasanyuan: 8, dragon: 3 }, pay: [[2, 1, 14]] },
  { name: '圈風刻 + 門風刻 on the same wind (南 seat, 南 round)', entry: hand('234s 678m 55p', '4s', { melds: ['pon 222z', 'chi 123m', 'chi 456p'] }),
    ctx: ctx({ from: 2, roundWind: 1 }), tai: { roundWind: 1, seatWind: 1 }, pay: [[2, 1, 5]] },
  { name: '小四喜 + 圈風 + 門風 (default: stacks)', entry: hand('44z 456p 789m', '4p', { melds: ['pon 111z', 'pon 222z', 'pon 333z'] }), ctx: ctx({ from: 2 }),
    tai: { xiaosixi: 8, roundWind: 1, seatWind: 1 }, pay: [[2, 1, 13]] },
  { name: '小四喜 replacing wind tai (rule Yes)', entry: hand('44z 456p 789m', '4p', { melds: ['pon 111z', 'pon 222z', 'pon 333z'] }), ctx: ctx({ from: 2 }),
    rules: rules({ xiaosixiReplacesWind: true }), tai: { xiaosixi: 8 }, pay: [[2, 1, 11]] },
  { name: '大四喜 replaces wind tai', entry: hand('456p 55m', '4p', { melds: ['pon 111z', 'pon 222z', 'pon 333z', 'pon 444z'] }), ctx: ctx({ from: 2 }),
    tai: { dasixi: 16 }, pay: [[2, 1, 19]] },

  // ── Suits ──
  { name: '混一色', entry: hand('789m 234m 55m', '4m', { melds: ['chi 123m', 'pon 444z', 'chi 456m'] }), ctx: ctx({ from: 2 }),
    tai: { hunyise: 4 }, pay: [[2, 1, 7]], waits: ['1m', '4m'] },
  { name: '字一色 + 小三元 + 碰碰胡 + 圈風 + 單吊 zimo (混一色 replaced)', entry: hand('555z 666z 77z', '7z', { melds: ['pon 111z', 'pon 333z', 'pon 444z'] }),
    ctx: ctx(), tai: { zimo: 1, duting: 1, roundWind: 1, xiaosanyuan: 4, pengpeng: 4, ziyise: 8 }, pay: zimoPay(23, 22) },
  { name: '字一色 replacing 碰碰胡 (rule Yes)', entry: hand('555z 666z 77z', '7z', { melds: ['pon 111z', 'pon 333z', 'pon 444z'] }),
    ctx: ctx(), rules: rules({ ziyiseReplacesPengpeng: true }), tai: { zimo: 1, duting: 1, roundWind: 1, xiaosanyuan: 4, ziyise: 8 }, pay: zimoPay(19, 18) },

  // ── Flowers ──
  { name: '正花 ×2 (夏 蘭 for 南) + 花槓 春夏秋冬', entry: plain({ flowers: 'f1 f2 f3 f4 f6' }), ctx: ctx({ from: 2 }),
    tai: { zhenghua: 2, huagang: 2 }, pay: [[2, 1, 7]] },
  { name: '七搶一: the flower holder pays alone', entry: hand('', null, { flowers: ALL8, flowerWin: 'qiqiangyi' }), ctx: ctx({ from: 3 }),
    tai: { qiqiangyi: 8 }, pay: [[3, 1, 11]] },
  { name: '八仙過海 + 自摸', entry: hand('', null, { flowers: ALL8, flowerWin: 'baxian' }), ctx: ctx({ winner: 2 }),
    tai: { baxian: 8, zimo: 1 }, pay: zimoPay(13, 12, 2) },

  // ── Opening hands (stack with everything) ──
  { name: '天胡 + 門清自摸 (dealer)', entry: closed({ flags: { firstDraw: true } }), ctx: ctx({ winner: 0 }),
    tai: { menqingZimo: 3, tianhu: 24 }, pay: zimoPay(0, 31, 0) },
  { name: '地胡 + 門清自摸', entry: closed({ flags: { firstDraw: true } }), ctx: ctx(),
    tai: { menqingZimo: 3, dihu: 16 }, pay: zimoPay(23, 22) },
  { name: '人胡 + 門清 + 平胡', entry: closed({ flags: { firstDraw: true } }), ctx: ctx({ from: 2 }),
    tai: { menqing: 1, pinghu: 2, renhu: 8 }, pay: [[2, 1, 14]] },
  { name: '地聽 + 門清 + 平胡', entry: closed({ flags: { ready: 'early' } }), ctx: ctx({ from: 2 }),
    tai: { menqing: 1, pinghu: 2, diting: 4 }, pay: [[2, 1, 10]] },

  // ── Regional add-ons ──
  { name: '見花見台 replaces 正花', entry: plain({ flowers: 'f1 f2 f3 f4 f6' }), ctx: ctx({ from: 2 }), rules: rules({ jianhua: 1 }),
    tai: { jianhua: 5, huagang: 2 }, pay: [[2, 1, 10]] },
  { name: '見風見台 on a non-seat, non-round wind', entry: hand('789m 234m 55m', '4m', { melds: ['chi 123m', 'pon 444z', 'chi 456m'] }),
    ctx: ctx({ from: 2 }), rules: rules({ jianfeng: 1 }), tai: { hunyise: 4, jianfeng: 1 }, pay: [[2, 1, 8]] },
  { name: '無字無花 replaces 無花', entry: plain(), ctx: ctx({ from: 2 }), rules: rules({ wuziwuhua: 2, wuhua: 1 }),
    tai: { wuziwuhua: 2 }, pay: [[2, 1, 5]] },
  { name: '無花 with honours in hand', entry: hand('789m 234m 55m', '4m', { melds: ['chi 123m', 'pon 444z', 'chi 456m'] }),
    ctx: ctx({ from: 2 }), rules: rules({ wuziwuhua: 2, wuhua: 1 }), tai: { hunyise: 4, wuhua: 1 }, pay: [[2, 1, 8]] },
  { name: '明槓 + 暗槓 (19 tiles)', entry: hand('234s 678m 55p', '4s', { melds: ['chi 123m', 'minkan 9999s', 'ankan 1111p'] }),
    ctx: ctx({ from: 2 }), rules: rules({ minggang: 1, angang: 2 }), tai: { minggang: 1, angang: 2 }, pay: [[2, 1, 6]] },
  { name: '一發', entry: plain({ flags: { ready: 'declared', yifa: true } }), ctx: ctx({ from: 2 }), rules: rules({ yifa: 1 }),
    tai: { yifa: 1 }, pay: [[2, 1, 4]] },
  { name: '嚦咕嚦咕 + 門清自摸', entry: hand('11m 22m 33m 44p 55p 66s 77s 888s', '8s'), ctx: ctx(), rules: rules({ qidui: 4 }),
    tai: { menqingZimo: 3, qidui: 4 }, pay: zimoPay(11, 10) },
  { name: 'Custom item tapped on', entry: plain({ custom: ['c1'] }), ctx: ctx({ from: 2 }),
    rules: rules({}, [{ id: 'c1', name: '自訂', tai: 2, condition: 'Synthetic test item' }]), tai: { c1: 2 }, pay: [[2, 1, 5]] },
  { name: 'Tai cap 10 on 五暗刻 (16 → 10)', entry: hand('111m 555p 999p 222s 333s 77s', '7s'), ctx: ctx(), rules: rules({ taiCap: 10 }),
    tai: { menqingZimo: 3, duting: 1, pengpeng: 4, an5: 8, cap: -6 }, pay: zimoPay(14, 13) },
];

describe('golden hands', () => {
  it('has at least 30 hands', () => expect(GOLDEN.length).toBeGreaterThanOrEqual(30));
  for (const g of GOLDEN) {
    it(g.name, () => {
      const r = scoreHand(g.entry, g.ctx, g.rules ?? rules());
      if (!r.legal) throw new Error(`Illegal: ${r.reasons.join('; ')}`);
      const got: Record<string, number> = {};
      for (const l of r.lines) got[l.id] = (got[l.id] ?? 0) + l.tai;
      expect(got).toEqual(g.tai);
      expect(r.handTai).toBe(Object.values(g.tai).reduce((a, b) => a + b, 0));
      expect(r.payments.map((p) => [p.from, p.to, p.amount])).toEqual(g.pay);
      expect(r.net.reduce((a, b) => a + b, 0)).toBe(0);
      if (g.waits) expect(r.waitTiles).toEqual(g.waits);
    });
  }
});

describe('illegal hands say exactly why', () => {
  const reasons = (e: HandEntry, c = ctx()) => {
    const r = scoreHand(e, c, rules());
    return r.legal ? [] : r.reasons;
  };
  it('wrong tile count', () => {
    expect(reasons(hand('234s 678m 5p', '4s', { melds: M3 }))).toContain('Expected 17 tiles, got 16: 7 concealed + 9 in exposed sets.');
  });
  it('a kong needs 4 tiles', () => {
    expect(reasons(hand('234s 678m 55p', '4s', { melds: ['chi 123m', 'chi 456p', 'minkan 999s'] }))[0]).toBe('Exposed set 3 (minkan) needs 4 tiles, has 3.');
  });
  it('five of one tile', () => {
    expect(reasons(hand('1m 234s 678m 55p', '4s', { melds: ['chi 123m', 'pon 111m', 'pon 999s'] })))
      .toContain('5 of 1萬 (1m) entered; there are only 4.');
  });
  it('not a winning shape', () => {
    expect(reasons(hand('234s 679m 55p', '4s', { melds: M3 }))).toEqual(["The concealed tiles don't split into 2 sets and a pair."]);
  });
  it('flower inside the hand', () => {
    expect(reasons(hand('234s 678m 5p f1', '4s', { melds: M3 }))[0]).toMatch(/move them to the flower row/);
  });
  it('winner cannot discard to themself', () => {
    expect(reasons(plain(), ctx({ from: 1 }))).toContain("The winner can't also be the discarder.");
  });
  it('七搶一 without all 8 flowers', () => {
    expect(reasons(hand('', null, { flowers: 'f1 f2 f3', flowerWin: 'qiqiangyi' }), ctx({ from: 3 })))
      .toEqual(['七搶一 needs all 8 flowers entered (has 3).']);
  });
});

describe('詐胡 (false win)', () => {
  const r = rules({ falseWinMode: 'announced', falseWinDealerTai: true, falseWinDice: false, falseWinDealerAfter: 'stays' });
  it('announced 5 tai: pays each other player, dealer tai on the dealer\'s payment', () => {
    const fw = scoreFalseWin(2, { dealer: 0, streak: 0, dice: [4, 5, 6] }, r, 5);
    expect(fw.payments.map((p) => [p.from, p.to, p.amount])).toEqual([[2, 0, 9], [2, 1, 8], [2, 3, 8]]);
    expect(fw.net).toEqual([9, 8, -25, 8]);
  });
  it('fixed amount with dice applied', () => {
    const fixed = rules({ falseWinMode: 'fixed', falseWinFixedTai: 4, falseWinDealerTai: false, falseWinDice: true, falseWinDealerAfter: 'passes' });
    const fw = scoreFalseWin(0, { dealer: 0, streak: 1, dice: [1, 2, 3] }, fixed, 99);
    expect(fw.payments.map((p) => p.amount)).toEqual([8, 8, 8]);
  });
  it('fixed amount with fixed tai Off is rejected', () => {
    expect(validateRuleSet(rules({ falseWinMode: 'fixed', falseWinFixedTai: 0, falseWinDealerTai: true, falseWinDice: true, falseWinDealerAfter: 'stays' })))
      .toContain("詐胡 uses a fixed amount, so the fixed tai can't be Off.");
  });
  it('unanswered 詐胡 questions block confirmation', () => {
    expect(validateRuleSet(rules()).length).toBe(4);
  });
});

export type { LegalScore };
