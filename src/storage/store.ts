// Saves to the phone after every event. localStorage writes synchronously, so an event
// is on disk before the next line runs. A failed write never blocks play: it is reported.
import type { RuleSet } from '../rules/ruleset';
import type { SessionEvent } from '../session/events';
import type { Session } from '../session/replay';

/** The subset of Storage we use, so tests can pass an in-memory map. */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const P = 'mj.v1.';
const K = { index: `${P}index`, lastRules: `${P}lastRules`, session: (id: string) => `${P}session.${id}` };

export type SaveResult = { ok: true } | { ok: false; error: string };

function write(kv: KV, key: string, value: unknown): SaveResult {
  try {
    kv.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Couldn't save to this phone: ${(e as Error).message}` };
  }
}
function read<T>(kv: KV, key: string): T | null {
  try {
    const s = kv.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

export function listSessions(kv: KV): { id: string; createdAt: string }[] {
  return read(kv, K.index) ?? [];
}
export function loadSession(kv: KV, id: string): Session | null {
  const s = read<Session>(kv, K.session(id));
  return s && s.schema === 1 ? s : null;
}
export function saveSession(kv: KV, s: Session): SaveResult {
  const r = write(kv, K.session(s.id), s);
  if (!r.ok) return r;
  const index = listSessions(kv).filter((x) => x.id !== s.id);
  return write(kv, K.index, [...index, { id: s.id, createdAt: s.createdAt }]);
}
/** Append one event and save at once. Returns the new session even if saving failed. */
export function appendEvent(kv: KV, s: Session, e: SessionEvent): { session: Session; saved: SaveResult } {
  const session = { ...s, events: [...s.events, e] };
  return { session, saved: saveSession(kv, session) };
}

export function loadLastRules(kv: KV): RuleSet | null {
  return read(kv, K.lastRules);
}
export function saveLastRules(kv: KV, rules: RuleSet): SaveResult {
  return write(kv, K.lastRules, rules);
}

export function memoryKV(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}
