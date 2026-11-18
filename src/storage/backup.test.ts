import { describe, expect, it } from 'vitest';
import { hand, rules } from '../engine/testkit';
import { snapshot } from '../rules/ruleset';
import type { SessionEvent } from '../session/events';
import { replay, type Session } from '../session/replay';
import { backupFileName, buildBackup, describeMerge, mergeBackup, parseBackup } from './backup';
import { loadLastRules, loadSession, memoryKV, saveLastRules, saveSession } from './store';

const at = '2026-11-18T20:00:00Z';
const seat: SessionEvent = { type: 'seating', id: 'e0', at, seats: ['Amy', 'Ben', 'Cat', 'Dan'] };
const win = (id: string): SessionEvent => ({ type: 'win', id, at, dice: null, winner: 1, from: 'zimo', entry: hand('234s 678m 55p', '4s', { melds: ['chi 123m', 'chi 456p', 'pon 999s'] }) });
const draw = (id: string): SessionEvent => ({ type: 'draw', id, at, dice: null });
const session = (id: string, events: SessionEvent[]): Session => ({ schema: 1, id, createdAt: at, snapshot: snapshot(rules(), new Date(at)), events });

describe('backup', () => {
  it('round-trips every session and the house rules to a fresh phone, with identical totals', () => {
    const phone = memoryKV();
    saveSession(phone, session('s1', [seat, win('e1'), draw('e2')]));
    saveSession(phone, session('s2', [seat, win('e3')]));
    saveLastRules(phone, rules());
    const text = JSON.stringify(buildBackup(phone));

    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    const fresh = memoryKV();
    const sum = mergeBackup(fresh, (parsed as { ok: true; backup: never }).backup);
    expect(describeMerge(sum)).toBe('Imported: 2 sessions added, house rules restored.');
    expect(replay(loadSession(fresh, 's1')!).totals).toEqual(replay(loadSession(phone, 's1')!).totals);
    expect(loadLastRules(fresh)).toEqual(rules());
  });

  it('a newer copy of a session adds the missing hands; nothing on the phone is lost', () => {
    const phone = memoryKV();
    saveSession(phone, session('s1', [seat, win('e1')]));
    const newer = { app: 'mahjong-scorekeeper', schema: 1, exportedAt: at, lastRules: null, sessions: [session('s1', [seat, win('e1'), draw('e2')])] } as const;
    expect(mergeBackup(phone, { ...newer, sessions: [...newer.sessions] })).toMatchObject({ updated: 1 });
    expect(loadSession(phone, 's1')!.events.length).toBe(3);
  });

  it('when the phone and the file disagree, the phone keeps its copy', () => {
    const phone = memoryKV();
    saveSession(phone, session('s1', [seat, win('e1'), win('e9')]));
    const other = session('s1', [seat, draw('e1')]);
    const sum = mergeBackup(phone, { app: 'mahjong-scorekeeper', schema: 1, exportedAt: at, lastRules: null, sessions: [other] });
    expect(sum).toMatchObject({ kept: 1, added: 0, updated: 0 });
    expect(loadSession(phone, 's1')!.events.length).toBe(3);
  });

  it('importing the same backup twice changes nothing', () => {
    const phone = memoryKV();
    saveSession(phone, session('s1', [seat, win('e1')]));
    const b = buildBackup(phone);
    expect(describeMerge(mergeBackup(phone, b))).toBe('Imported: 1 already up to date.');
  });

  it('existing house rules on the phone are not overwritten', () => {
    const phone = memoryKV();
    const mine = rules({ zimo: 5 });
    saveLastRules(phone, mine);
    mergeBackup(phone, { app: 'mahjong-scorekeeper', schema: 1, exportedAt: at, lastRules: rules(), sessions: [] });
    expect(loadLastRules(phone)).toEqual(mine);
  });

  it('says exactly what is wrong with a bad file', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: "This file isn't a backup (it isn't valid JSON)." });
    expect(parseBackup('{"app":"something-else"}')).toEqual({ ok: false, error: "This file isn't a score keeper backup." });
    expect(parseBackup('{"app":"mahjong-scorekeeper","schema":2,"sessions":[]}').ok).toBe(false);
    expect(parseBackup('{"app":"mahjong-scorekeeper","schema":1,"sessions":[{"id":"x"}]}'))
      .toEqual({ ok: false, error: 'A session in this backup is damaged, so nothing was imported.' });
  });

  it('names the file by date', () => {
    expect(backupFileName(new Date('2026-11-18T20:00:00Z'))).toBe('mahjong-backup-2026-11-18.json');
  });
});
