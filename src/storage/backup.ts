// Backup: export every session (with its frozen rule snapshot and full event log) and the
// last-used rules to one JSON file, and merge such a file back in. Pure apart from the KV store.
import type { RuleSet } from '../rules/ruleset';
import { replay, type Session } from '../session/replay';
import { listSessions, loadLastRules, loadSession, saveLastRules, saveSession, type KV } from './store';

export const BACKUP_APP = 'mahjong-scorekeeper';
export interface Backup {
  app: typeof BACKUP_APP;
  schema: 1;
  exportedAt: string;
  sessions: Session[];
  lastRules: RuleSet | null;
}

export function buildBackup(kv: KV, now = new Date()): Backup {
  const sessions = listSessions(kv).map((x) => loadSession(kv, x.id)).filter((s): s is Session => !!s);
  return { app: BACKUP_APP, schema: 1, exportedAt: now.toISOString(), sessions, lastRules: loadLastRules(kv) };
}

export function backupFileName(now = new Date()): string {
  const d = now.toISOString().slice(0, 10);
  return `mahjong-backup-${d}.json`;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Read a backup file's text. Says exactly what's wrong with a bad file. */
export function parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: string } {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { ok: false, error: "This file isn't a backup (it isn't valid JSON)." }; }
  if (!isObj(data) || data.app !== BACKUP_APP) return { ok: false, error: "This file isn't a score keeper backup." };
  if (data.schema !== 1) return { ok: false, error: `This backup is format ${String(data.schema)}; this version of the app reads format 1. Update the app first.` };
  if (!Array.isArray(data.sessions)) return { ok: false, error: 'This backup has no session list.' };
  for (const s of data.sessions) {
    if (!isObj(s) || s.schema !== 1 || typeof s.id !== 'string' || !isObj(s.snapshot) || !Array.isArray(s.events))
      return { ok: false, error: 'A session in this backup is damaged, so nothing was imported.' };
  }
  return { ok: true, backup: data as unknown as Backup };
}

export interface MergeSummary {
  added: number;
  updated: number;
  unchanged: number;
  /** Sessions where the phone and the file disagree; the phone's copy was kept. */
  kept: number;
  rulesRestored: boolean;
}

const sameEvents = (a: Session, b: Session, n: number) =>
  JSON.stringify(a.events.slice(0, n)) === JSON.stringify(b.events.slice(0, n));

/**
 * Merge a backup into this phone without losing anything already here:
 * - a session the phone doesn't have is added;
 * - the same session with more events (the phone's log is the start of it) replaces the phone's;
 * - otherwise the phone's copy is kept.
 * Last-used rules are restored only if the phone has none.
 */
export function mergeBackup(kv: KV, backup: Backup): MergeSummary {
  const sum: MergeSummary = { added: 0, updated: 0, unchanged: 0, kept: 0, rulesRestored: false };
  for (const incoming of backup.sessions) {
    try { replay(incoming); } catch { sum.kept++; continue; } // unreadable: never let it in
    const mine = loadSession(kv, incoming.id);
    if (!mine) { saveSession(kv, incoming); sum.added++; continue; }
    if (incoming.events.length > mine.events.length && sameEvents(mine, incoming, mine.events.length)) {
      saveSession(kv, { ...mine, events: incoming.events }); sum.updated++;
    } else if (incoming.events.length === mine.events.length && sameEvents(mine, incoming, mine.events.length)) {
      sum.unchanged++;
    } else {
      sum.kept++;
    }
  }
  if (!loadLastRules(kv) && backup.lastRules) { saveLastRules(kv, backup.lastRules); sum.rulesRestored = true; }
  return sum;
}

export function describeMerge(s: MergeSummary): string {
  const parts = [
    s.added && `${s.added} session${s.added === 1 ? '' : 's'} added`,
    s.updated && `${s.updated} updated with newer hands`,
    s.unchanged && `${s.unchanged} already up to date`,
    s.kept && `${s.kept} kept as on this phone (the file's copy differs)`,
    s.rulesRestored && 'house rules restored',
  ].filter(Boolean);
  return parts.length ? `Imported: ${parts.join(', ')}.` : 'The backup had no sessions.';
}

const LAST_BACKUP = 'mj.v1.lastBackup';
export function loadLastBackup(kv: KV): string | null {
  try { return kv.getItem(LAST_BACKUP); } catch { return null; }
}
export function saveLastBackup(kv: KV, at: string): void {
  try { kv.setItem(LAST_BACKUP, at); } catch { /* reported elsewhere; never block */ }
}
