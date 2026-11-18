// Tile notation (see glossary in CLAUDE.md):
//   1m–9m 萬, 1p–9p 筒, 1s–9s 條, 1z 東 2z 南 3z 西 4z 北 5z 中 6z 發 7z 白
//   f1–f4 春夏秋冬, f5–f8 梅蘭竹菊
// Digits can be grouped before a suit letter: "123m 456p 11z".

export type Tile = string; // e.g. "5m", "3z"
export type Flower = string; // "f1".."f8"

export const SUITS = ['m', 'p', 's', 'z'] as const;
export const ALL_TILES: Tile[] = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${n}m`),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${n}p`),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${n}s`),
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => `${n}z`),
];
export const ALL_FLOWERS: Flower[] = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];

const TILE_INDEX = new Map(ALL_TILES.map((t, i) => [t, i]));

export const TILE_NAMES: Record<string, string> = {
  '1z': '東', '2z': '南', '3z': '西', '4z': '北', '5z': '中', '6z': '發', '7z': '白',
  f1: '春', f2: '夏', f3: '秋', f4: '冬', f5: '梅', f6: '蘭', f7: '菊', f8: '竹',
};
const SUIT_NAMES: Record<string, string> = { m: '萬', p: '筒', s: '條' };

export function isTile(t: string): boolean {
  return TILE_INDEX.has(t);
}
export function isFlower(t: string): boolean {
  return ALL_FLOWERS.includes(t);
}
export function tileIndex(t: Tile): number {
  const i = TILE_INDEX.get(t);
  if (i === undefined) throw new Error(`Unknown tile "${t}"`);
  return i;
}
export function suitOf(t: Tile): string {
  return t[1];
}
export function rankOf(t: Tile): number {
  return Number(t[0]);
}
export function isHonour(t: Tile): boolean {
  return suitOf(t) === 'z';
}
export function isWind(t: Tile): boolean {
  return isHonour(t) && rankOf(t) <= 4;
}
export function isDragon(t: Tile): boolean {
  return isHonour(t) && rankOf(t) >= 5;
}
/** Wind 0..3 (東南西北) → tile code. */
export function windTile(wind: number): Tile {
  return `${wind + 1}z`;
}

/** Human-readable Chinese name: "5萬", "東", "春". */
export function tileName(t: string): string {
  if (TILE_NAMES[t]) return TILE_NAMES[t];
  return `${t[0]}${SUIT_NAMES[t[1]] ?? t[1]}`;
}

/**
 * Parse notation such as "123m 456p 11z f1 f5" into tile codes.
 * Throws with the offending token on bad input.
 */
export function parseTiles(text: string): string[] {
  const out: string[] = [];
  for (const token of text.trim().split(/\s+/).filter(Boolean)) {
    if (/^f[1-8]$/.test(token)) {
      out.push(token);
      continue;
    }
    const m = /^([1-9]+)([mpsz])$/.exec(token);
    if (!m) throw new Error(`Can't read tile group "${token}"`);
    for (const d of m[1]) {
      const t = `${d}${m[2]}`;
      if (!isTile(t)) throw new Error(`No such tile "${t}" in "${token}"`);
      out.push(t);
    }
  }
  return out;
}

/** Format tiles back to compact notation, sorted by suit then rank. */
export function formatTiles(tiles: string[]): string {
  const flowers = tiles.filter(isFlower).sort();
  const groups: string[] = [];
  for (const s of SUITS) {
    const ranks = tiles.filter((t) => isTile(t) && suitOf(t) === s).map(rankOf).sort((a, b) => a - b);
    if (ranks.length) groups.push(`${ranks.join('')}${s}`);
  }
  return [...groups, ...flowers].join(' ');
}

/** Count array of length 34. */
export function countTiles(tiles: Tile[]): number[] {
  const c = new Array(34).fill(0);
  for (const t of tiles) c[tileIndex(t)]++;
  return c;
}
