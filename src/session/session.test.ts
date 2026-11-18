import { describe, expect, it } from 'vitest';
import { hand, rules } from '../engine/testkit';
import type { Seat } from '../engine/types';
import { snapshot, type RuleSet } from '../rules/ruleset';
import { appendEvent, loadSession, memoryKV, saveSession } from '../storage/store';
import type { BaseEvent, Dice, SessionEvent } from './events';
import { replay, type Session } from './replay';
import { seatingProblem } from './rotation';
import { settle } from './settle';

// Synthetic players and a 0-tai hand (自摸 only on zimo) that is legal for any seat.
const P = ['Amy', 'Ben', 'Cat', 'Dan'] as const;
const plain = () => hand('234s 678m 55p', '4s', { melds: ['chi 123m', 'chi 456p', 'pon 999s'] });

let n = 0;
const at = '2026-11-17T20:00:00Z';
const seat = (...s: string[]): BaseEvent => ({ type: 'seating', id: `e${++n}`, at, seats: s as [string, string, string, string] });
const win = (winner: Seat, from: 'zimo' | Seat, dice: Dice = null): BaseEvent => ({ type: 'win', id: `e${++n}`, at, dice, winner, from, entry: plain() });
const draw = (dice: Dice = null): BaseEvent => ({ type: 'draw', id: `e${++n}`, at, dice });
const fw = (offender: Seat, tai = 2): BaseEvent => ({ type: 'falseWin', id: `e${++n}`, at, dice: null, offender, announcedTai: tai });
const undo = (target: string): SessionEvent => ({ type: 'undo', id: `e${++n}`, at, target });
const amend = (target: string, replacement: BaseEvent): SessionEvent => ({ type: 'amend', id: `e${++n}`, at, target, replacement });

const FW_RULES = { falseWinMode: 'announced', falseWinDealerTai: true, falseWinDice: false, falseWinDealerAfter: 'passes' } as const;
const session = (events: SessionEvent[], r: RuleSet = rules(FW_RULES)): Session =>
  ({ schema: 1, id: 's1', createdAt: at, snapshot: snapshot(r, new Date(at)), events });

// [event, round wind, dealer seat, streak, change] after each hand
type Step = [BaseEvent, number, number, number, string];
const SCRIPT: Step[] = [
  [win(0, 'zimo'), 0, 0, 1, 'stays'], // 東風東 dealer wins: 連1
  [draw(), 0, 0, 2, 'stays'], // 流局: 連2
  [win(2, 1), 0, 1, 0, 'passes'],
  [win(1, 'zimo'), 0, 1, 1, 'stays'],
  [win(3, 0), 0, 2, 0, 'passes'],
  [fw(3), 0, 3, 0, 'passes'], // 詐胡, rule: dealer passes
  [draw(), 0, 3, 1, 'stays'],
  [win(0, 3), 1, 0, 0, 'roundChanges'], // → 南
  [win(1, 2), 1, 1, 0, 'passes'],
  [win(2, 'zimo'), 1, 2, 0, 'passes'],
  [win(2, 3), 1, 2, 1, 'stays'],
  [win(3, 'zimo'), 1, 3, 0, 'passes'],
  [win(0, 'zimo'), 2, 0, 0, 'roundChanges'], // → 西
  [draw(), 2, 0, 1, 'stays'],
  [win(1, 0), 2, 1, 0, 'passes'],
  [win(2, 1), 2, 2, 0, 'passes'],
  [win(3, 2), 2, 3, 0, 'passes'],
  [win(0, 1), 3, 0, 0, 'roundChanges'], // → 北
  [win(1, 'zimo'), 3, 1, 0, 'passes'],
  [win(1, 'zimo'), 3, 1, 1, 'stays'],
  [win(2, 0), 3, 2, 0, 'passes'],
  [win(3, 'zimo'), 3, 3, 0, 'passes'], // 北風北
  [draw([5, 5, 5]), 3, 3, 1, 'stays'], // triple on a 流局: nothing paid
  [win(0, 'zimo'), 3, 0, 0, 'jiangOver'],
];
const opening = seat(...P);
const full = [opening, ...SCRIPT.map((s) => s[0])];

describe('scripted session: a full 將 with streaks, draws and a 詐胡', () => {
  const st = replay(session(full));

  it('has 24 hands', () => expect(st.hands.length).toBe(24));
  SCRIPT.forEach(([, round, dealer, streak, change], i) => {
    it(`hand ${i + 1}: ${change}, then round ${round} dealer ${dealer} streak ${streak}`, () => {
      const h = st.hands[i];
      expect(h.change).toBe(change);
      const after = st.hands[i + 1]?.before ?? st.next.rotation;
      expect([after.roundWind, after.dealer, after.streak]).toEqual([round, dealer, streak]);
      expect(h.warnings).toEqual([]);
    });
  });
  it('after 北風北 the 將 is over and asks for a seat redraw', () => {
    expect(st.next.kind).toBe('needSeating');
    expect(st.next.text).toBe('將 over: redraw seats.');
    expect(st.hands[23].nextText).toBe('將 over: redraw seats.');
  });
  it('tells the table what happens next in words', () => {
    expect(st.hands[0].nextText).toBe('Dealer stays: Amy, 連1拉1.');
    expect(st.hands[2].nextText).toBe('Dealer passes to Ben.');
    expect(st.hands[7].nextText).toBe('Round wind changes to 南. Amy deals.');
  });
  it('the same seating is rejected; a new one starts 東風東', () => {
    expect(seatingProblem(st.seats, [...P])).toBe('The seating came out the same as last 將: draw again.');
    const s2 = replay(session([...full, seat('Ben', 'Cat', 'Dan', 'Amy'), win(1, 'zimo')]));
    expect(s2.hands[24].before).toEqual({ roundWind: 0, dealer: 0, streak: 0, jiangOver: false });
    expect(s2.hands[24].nextText).toBe('Dealer passes to Cat.');
  });
  it('payments: dealer zimo on 連0 pays 5 each; 流局 pays nothing; nets sum to zero', () => {
    expect(st.hands[0].netByPlayer).toEqual({ Amy: 15, Ben: -5, Cat: -5, Dan: -5 });
    expect(st.hands[1].payments).toEqual([]);
    expect(st.hands[22].payments).toEqual([]); // the triple 流局
    expect(Object.values(st.totals).reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('a 詐胡 pays each of the three, dealer tai on the dealer\'s payment', () => {
    // Hand 6: dealer is Cat (seat 2), offender Dan (seat 3), announced 2 tai.
    expect(st.hands[5].netByPlayer).toEqual({ Dan: -16, Amy: 5, Ben: 5, Cat: 6 });
  });
});

describe('rule variants', () => {
  it('詐胡 with "dealer stays" keeps the dealer and the streak', () => {
    const st = replay(session([opening, win(0, 'zimo'), fw(2)], rules({ ...FW_RULES, falseWinDealerAfter: 'stays' })));
    expect(st.next.rotation).toMatchObject({ dealer: 0, streak: 1 });
  });
  it('流局 not adding to the streak', () => {
    const st = replay(session([opening, draw()], rules({ ...FW_RULES, drawExtendsStreak: false })));
    expect(st.next.rotation).toMatchObject({ dealer: 0, streak: 0 });
  });
  it('a triple on a 流局 carries to the next hand only when the rule says so', () => {
    const events = [opening, draw([5, 5, 5]), win(1, 'zimo', [1, 2, 6])];
    expect(replay(session(events)).hands[1].netByPlayer.Ben).toBe(7 + 4 + 4); // no carry: 自摸 1, dealer adds 莊家 1 + 連1 2
    const carry = replay(session(events, rules({ ...FW_RULES, diceCarryOver: true })));
    expect(carry.hands[1].dice).toEqual([5, 5, 5]);
    // dealer: (3 + 1 + 莊家 1 + 連1 2) × 3 = 21; others (3 + 1) × 3 = 12
    expect(carry.hands[1].netByPlayer.Ben).toBe(21 + 12 + 12);
  });
});

describe('undo and edit', () => {
  const redraw = seat('Ben', 'Cat', 'Dan', 'Amy');
  const after = win(1, 'zimo');
  const log: SessionEvent[] = [...full, redraw, after];

  it('undo across a seat redraw: first the hand, then the redraw', () => {
    const u1 = replay(session([...log, undo(after.id)]));
    expect(u1.hands.length).toBe(24);
    expect(u1.next).toMatchObject({ kind: 'play', text: '東風東: Ben deals, first deal.' });
    const u2 = replay(session([...log, undo(after.id), undo(redraw.id)]));
    expect(u2.next.kind).toBe('needSeating');
    expect(u2.seats).toEqual(P);
  });
  it('editing a hand that changed the dealer recomputes everything after it', () => {
    const third = full[3]; // hand 3: Cat won off Ben, deal passed to Ben
    const st = replay(session([...log, amend(third.id, win(0, 'zimo'))]));
    expect(st.hands[2].change).toBe('stays');
    expect(st.hands[3].before).toMatchObject({ dealer: 0, streak: 3 }); // Amy still dealing, 連3
    // Ben's zimo in hand 4 is now a non-dealer win, so the deal passes there and lines up again.
    expect(st.hands[3].change).toBe('passes');
    expect(st.hands[3].netByPlayer.Amy).toBe(-(3 + 1 + 1 + 2 * 3)); // Amy paid dealer tai on 連3
    expect(Object.values(st.totals).reduce((a, b) => a + b, 0)).toBe(0);
  });
  it('an edit that un-ends the 將 flags the redraw instead of blocking', () => {
    const last = full[24]; // 北風北, Amy won: 將 over
    const st = replay(session([...log, amend(last.id, draw())]));
    expect(st.seatingWarnings).toEqual(['Seats were redrawn before the 將 ended (北 round, Dan dealing).']);
    expect(st.hands.length).toBe(25); // the hand after the redraw still counts
  });
  it('the log keeps every original event', () => {
    const edited = [...log, amend(full[3].id, draw())];
    expect(edited.filter((e) => e.type !== 'amend').length).toBe(log.length);
  });
});

describe('rule snapshots and storage', () => {
  it('changing a value in a new session leaves the earlier session\'s totals unchanged', () => {
    const kv = memoryKV();
    const events = [opening, win(1, 'zimo'), win(1, 2), draw(), win(3, 'zimo')];
    const s1: Session = { ...session(events), id: 'week1' };
    saveSession(kv, s1);
    const before = replay(loadSession(kv, 'week1')!).totals;

    const s2: Session = { ...session(events, rules({ ...FW_RULES, zimo: 5 })), id: 'week2' };
    saveSession(kv, s2);
    expect(replay(loadSession(kv, 'week1')!).totals).toEqual(before);
    expect(replay(loadSession(kv, 'week2')!).totals).not.toEqual(before);
    expect(s1.snapshot.version).not.toBe(s2.snapshot.version);
  });
  it('every appended event is saved immediately', () => {
    const kv = memoryKV();
    let s = session([opening]);
    saveSession(kv, s);
    ({ session: s } = appendEvent(kv, s, win(1, 'zimo')));
    expect(loadSession(kv, 's1')!.events.length).toBe(2);
  });
  it('a failed save is reported, not thrown', () => {
    const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
    const r = appendEvent(full, session([opening]), draw());
    expect(r.saved).toEqual({ ok: false, error: "Couldn't save to this phone: QuotaExceededError" });
    expect(r.session.events.length).toBe(2);
  });
});

describe('settlement: fewest transfers', () => {
  it('pairs off equal and opposite nets', () => {
    expect(settle({ Amy: 5, Ben: -5, Cat: 3, Dan: -3 })).toEqual([
      { from: 'Ben', to: 'Amy', amount: 5 }, { from: 'Dan', to: 'Cat', amount: 3 }]);
  });
  it('one winner, three losers: three transfers', () => {
    expect(settle({ Amy: 6, Ben: -1, Cat: -2, Dan: -3 }).length).toBe(3);
  });
  it('all square: nothing to pay', () => expect(settle({ Amy: 0, Ben: 0, Cat: 0, Dan: 0 })).toEqual([]));
  it('settles the scripted session exactly', () => {
    const totals = replay(session(full)).totals;
    const left = { ...totals };
    for (const t of settle(totals)) { left[t.from] += t.amount; left[t.to] -= t.amount; }
    expect(Object.values(left).every((v) => v === 0)).toBe(true);
  });
});
