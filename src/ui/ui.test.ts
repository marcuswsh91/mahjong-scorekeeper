import { describe, expect, it } from 'vitest';
import { rules } from '../engine/testkit';
import { addTile, concealedTarget, emptyDraft, fromEntry, parseDice, removeMeld, toEntry, type Draft } from './entryModel';
import { workedExamples } from './readback';

const tap = (d: Draft, row: Parameters<typeof addTile>[1], ...tiles: string[]) =>
  tiles.reduce((acc, t) => { const r = addTile(acc, row, t); if (!r.draft) throw new Error(r.error); return r.draft; }, d);

describe('hand entry model', () => {
  it('builds the 清一色 read-back hand by tapping', () => {
    let d = tap(emptyDraft(), 'chi', '1m');
    d = tap(d, 'concealed', '2m', '3m', '4m', '5m', '6m', '7m', '9m', '9m', '9m', '1m', '1m', '1m', '8m');
    d = tap(d, 'winning', '8m');
    expect(concealedTarget(d)).toBe(13);
    expect(toEntry(d).concealed.length).toBe(14);
    expect(toEntry(d).winningTile).toBe('8m');
  });
  it('refuses a fifth copy of a tile and says why', () => {
    const d = tap(emptyDraft(), 'pon', '5z');
    expect(addTile(d, 'minkan', '5z').error).toBe('Only 4 of 中 exist; 3 are already in the hand.');
  });
  it('吃 needs the lowest tile of a run', () => {
    expect(addTile(emptyDraft(), 'chi', '8p').error).toMatch(/lowest tile/);
    expect(addTile(emptyDraft(), 'chi', '1z').error).toMatch(/lowest tile/);
  });
  it('a kong adds four tiles; removing a set removes all of it', () => {
    const d = tap(emptyDraft(), 'ankan', '9s');
    expect(d.melds[0].tiles).toEqual(['9s', '9s', '9s', '9s']);
    expect(removeMeld(d, 0).melds).toEqual([]);
  });
  it('flowers toggle', () => {
    const d = tap(emptyDraft(), 'flowers', 'f3', 'f1', 'f3');
    expect(d.flowers).toEqual(['f1']);
  });
  it('round-trips through a HandEntry (the shape a photo will fill)', () => {
    const d = tap(tap(emptyDraft(), 'concealed', '2s', '3s', '4s'), 'winning', '4s');
    expect(fromEntry(toEntry(d)).concealed).toEqual(['2s', '3s', '4s']);
  });
  it('reads dice as three digits 1–6', () => {
    expect(parseDice('456')).toEqual([4, 5, 6]);
    expect(parseDice('4 5 6')).toEqual([4, 5, 6]);
    expect(parseDice('457')).toBeNull();
    expect(parseDice('45')).toBeNull();
  });
});

describe('read-back worked payouts with the starting values', () => {
  const ex = workedExamples(rules());
  const amounts = (i: number) => ex[i].payments.map((p) => `${p.payer} ${p.amount}`);
  it('non-dealer 自摸 only: non-dealers pay 4, dealer 5', () => expect(amounts(0)).toEqual(['東 (dealer) 5', '西 4', '北 4']));
  it('碰碰胡 self-draw', () => expect(amounts(1)).toEqual(['東 (dealer) 9', '西 8', '北 8']));
  it('with 4-5-6', () => expect(amounts(2)).toEqual(['東 (dealer) 11', '西 10', '北 10']));
  it('with a triple', () => expect(amounts(3)).toEqual(['東 (dealer) 27', '西 24', '北 24']));
  it('dealer 連2拉2 清一色 off a discard', () => expect(amounts(4)).toEqual(['西 16']));
});
