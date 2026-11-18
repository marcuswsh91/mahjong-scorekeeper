import type { HandEntry, Seat } from '../engine/types';

export type Dice = [number, number, number] | null;

/**
 * Seats are physical seats in turn (counterclockwise) order.
 * seats[0] is 東 for the new 將 and deals first.
 */
export interface SeatingEvent { type: 'seating'; id: string; at: string; seats: [string, string, string, string] }
export interface WinEvent { type: 'win'; id: string; at: string; dice: Dice; winner: Seat; from: 'zimo' | Seat; entry: HandEntry }
export interface DrawEvent { type: 'draw'; id: string; at: string; dice: Dice } // 流局
export interface FalseWinEvent { type: 'falseWin'; id: string; at: string; dice: Dice; offender: Seat; announcedTai: number } // 詐胡

export type BaseEvent = SeatingEvent | WinEvent | DrawEvent | FalseWinEvent;
export type HandEvent = WinEvent | DrawEvent | FalseWinEvent;

/** Edit: replaces the content of an earlier event, keeping its place in the log. */
export interface AmendEvent { type: 'amend'; id: string; at: string; target: string; replacement: BaseEvent }
/** Undo: removes an earlier event. */
export interface UndoEvent { type: 'undo'; id: string; at: string; target: string }

export type SessionEvent = BaseEvent | AmendEvent | UndoEvent;

export const isHandEvent = (e: BaseEvent): e is HandEvent => e.type !== 'seating';

/**
 * The log with undos and amends applied: base events in their original order,
 * each replaced by its latest amend; undone events dropped.
 */
export function effectiveEvents(log: SessionEvent[]): BaseEvent[] {
  const undone = new Set<string>();
  const latest = new Map<string, BaseEvent>();
  for (const e of log) {
    if (e.type === 'undo') undone.add(e.target);
    else if (e.type === 'amend') latest.set(e.target, { ...e.replacement, id: e.target });
  }
  return log
    .filter((e): e is BaseEvent => e.type !== 'undo' && e.type !== 'amend' && !undone.has(e.id))
    .map((e) => latest.get(e.id) ?? e);
}

let counter = 0;
export function newId(now = Date.now()): string {
  counter = (counter + 1) % 1e6;
  return `${now.toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
