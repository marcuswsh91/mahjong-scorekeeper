import { allSplits } from './decompose';
import { ALL_TILES, countTiles, type Tile } from './tiles';
import type { HandEntry } from './types';

/**
 * Every tile that would have completed this hand, given the hand minus the
 * winning tile. A tile already held 4 times (concealed + exposed) can't win.
 */
export function winningTiles(entry: HandEntry, qiduiOn: boolean): Tile[] {
  if (!entry.winningTile) return [];
  const rest = entry.concealed.slice();
  rest.splice(rest.indexOf(entry.winningTile), 1);
  const base = countTiles(rest);
  const held = countTiles([...rest, ...entry.melds.flatMap((m) => m.tiles)]);
  const sets = 5 - entry.melds.length;
  const qidui = qiduiOn && entry.melds.length === 0;
  const out: Tile[] = [];
  for (let i = 0; i < 34; i++) {
    if (held[i] >= 4) continue;
    base[i]++;
    if (allSplits(base, sets, qidui).length > 0) out.push(ALL_TILES[i]);
    base[i]--;
  }
  return out;
}
