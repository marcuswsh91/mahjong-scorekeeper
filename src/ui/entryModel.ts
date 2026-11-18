// Hand-entry editing, kept pure so it can be tested and so a photo can fill a Draft later.
import { ALL_TILES, isHonour, rankOf, tileIndex, tileName, type Flower, type Tile } from '../engine/tiles';
import { emptyFlags, type HandEntry, type Meld, type MeldKind } from '../engine/types';

export type Row = 'concealed' | 'winning' | MeldKind | 'flowers';

export interface Draft {
  concealed: Tile[]; // concealed tiles, NOT including the winning tile
  winning: Tile | null;
  melds: Meld[];
  flowers: Flower[];
  flags: HandEntry['flags'];
  flowerWin?: HandEntry['flowerWin'];
  customItems: string[];
  source: HandEntry['source'];
}

export function emptyDraft(): Draft {
  return { concealed: [], winning: null, melds: [], flowers: [], flags: emptyFlags(), customItems: [], source: 'manual' };
}

const sortTiles = (t: Tile[]) => t.slice().sort((a, b) => tileIndex(a) - tileIndex(b));

/** How many of `tile` are already in the hand (concealed, winning tile, exposed sets). */
export function held(d: Draft, tile: Tile): number {
  return [...d.concealed, ...(d.winning ? [d.winning] : []), ...d.melds.flatMap((m) => m.tiles)].filter((t) => t === tile).length;
}

/** Concealed tiles still to enter, excluding the winning tile. */
export function concealedTarget(d: Draft): number {
  return 17 - 3 * d.melds.length - 1;
}

export type AddResult = { draft: Draft; error?: undefined } | { draft?: undefined; error: string };

/** Tap a tile on the grid with `row` active. */
export function addTile(d: Draft, row: Row, tile: string): AddResult {
  if (row === 'flowers') {
    const on = d.flowers.includes(tile);
    return { draft: { ...d, flowers: on ? d.flowers.filter((f) => f !== tile) : [...d.flowers, tile].sort() } };
  }
  const full = (t: Tile, need: number, without = 0) =>
    held(d, t) - without + need > 4 ? `Only 4 of ${tileName(t)} exist; ${held(d, t)} are already in the hand.` : null;

  if (row === 'concealed') {
    const e = full(tile, 1);
    return e ? { error: e } : { draft: { ...d, concealed: sortTiles([...d.concealed, tile]) } };
  }
  if (row === 'winning') {
    const e = full(tile, 1, d.winning === tile ? 1 : 0);
    return e ? { error: e } : { draft: { ...d, winning: tile } };
  }
  if (d.melds.length >= 5) return { error: 'A hand has at most 5 sets.' };
  if (row === 'chi') {
    if (isHonour(tile) || rankOf(tile) > 7) return { error: 'For 吃, tap the lowest tile of the run (1–7 of a suit).' };
    const run = [0, 1, 2].map((k) => ALL_TILES[tileIndex(tile) + k]);
    for (const t of run) { const e = full(t, 1); if (e) return { error: e }; }
    return { draft: { ...d, melds: [...d.melds, { kind: 'chi', tiles: run }] } };
  }
  const n = row === 'pon' ? 3 : 4;
  const e = full(tile, n);
  return e ? { error: e } : { draft: { ...d, melds: [...d.melds, { kind: row, tiles: new Array(n).fill(tile) }] } };
}

export function removeConcealed(d: Draft, i: number): Draft {
  return { ...d, concealed: d.concealed.filter((_, k) => k !== i) };
}
export function removeMeld(d: Draft, i: number): Draft {
  return { ...d, melds: d.melds.filter((_, k) => k !== i) };
}

export function toEntry(d: Draft): HandEntry {
  return {
    concealed: d.flowerWin ? [] : sortTiles([...d.concealed, ...(d.winning ? [d.winning] : [])]),
    melds: d.flowerWin ? [] : d.melds,
    winningTile: d.flowerWin ? null : d.winning,
    flowers: d.flowers,
    flags: d.flags,
    flowerWin: d.flowerWin,
    customItems: d.customItems,
    source: d.source,
  };
}

/** For a photo pre-fill or an edit: split the winning tile back out. */
export function fromEntry(e: HandEntry): Draft {
  const concealed = e.concealed.slice();
  if (e.winningTile) concealed.splice(concealed.indexOf(e.winningTile), 1);
  return { concealed, winning: e.winningTile, melds: e.melds, flowers: e.flowers, flags: e.flags, flowerWin: e.flowerWin, customItems: e.customItems, source: e.source };
}

/** "456" or "4 5 6" → [4,5,6]; anything else → null. */
export function parseDice(text: string): [number, number, number] | null {
  const d = text.replace(/\D/g, '').split('').map(Number);
  return d.length === 3 && d.every((x) => x >= 1 && x <= 6) ? [d[0], d[1], d[2]] : null;
}
