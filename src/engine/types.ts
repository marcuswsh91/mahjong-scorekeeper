import type { Flower, Tile } from './tiles';

export type MeldKind = 'chi' | 'pon' | 'minkan' | 'ankan';
export interface Meld {
  kind: MeldKind;
  tiles: Tile[]; // 3 for chi/pon, 4 for kongs
}

export type ReadyKind = 'none' | 'declared' | 'early' | 'dealt'; // 報聽 / 地聽 / 天聽

/**
 * What the scorekeeper (or, later, a photo) records about the winning hand.
 * Everything else (winds, dealer, streak, dice) comes from session state.
 */
export interface HandEntry {
  /** Concealed tiles, including the winning tile. Empty for a flower win. */
  concealed: Tile[];
  melds: Meld[];
  winningTile: Tile | null;
  flowers: Flower[];
  flags: {
    lastTile: boolean; // 海底撈月 (zimo) / 河底撈魚 (discard)
    kongReplacement: boolean; // 槓上開花
    robbedKong: boolean; // 搶槓
    firstDraw: boolean; // 天胡 / 地胡 / 人胡
    ready: ReadyKind; // 報聽 / 地聽 / 天聽
    yifa: boolean; // 一發 (only asked when that rule is on)
  };
  /** 七搶一 / 八仙過海: scored without a tile hand. */
  flowerWin?: 'qiqiangyi' | 'baxian';
  /** Ids of custom rule items tapped on. */
  customItems: string[];
  source: 'manual' | 'photo';
}

export type Seat = 0 | 1 | 2 | 3; // physical seats in turn (counterclockwise) order

export interface HandContext {
  dealer: Seat;
  /** Round wind 0..3 = 東南西北. */
  roundWind: number;
  /** Streak N in 連N拉N (0 = dealer's first hand). */
  streak: number;
  /** Dealer's dice roll at the start of the hand, or null if not entered. */
  dice: [number, number, number] | null;
  winner: Seat;
  /** 'zimo' or the seat that discarded (for 七搶一: the flower holder; for 搶槓: the kong maker). */
  from: 'zimo' | Seat;
}

/** Seat wind 0..3 (東南西北): dealer is 東, then turn order. */
export function seatWindOf(seat: Seat, dealer: Seat): number {
  return (seat - dealer + 4) % 4;
}

export function emptyFlags(): HandEntry['flags'] {
  return { lastTile: false, kongReplacement: false, robbedKong: false, firstDraw: false, ready: 'none', yifa: false };
}
