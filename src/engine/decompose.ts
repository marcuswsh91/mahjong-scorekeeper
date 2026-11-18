import { ALL_TILES } from './tiles';

export type GroupType = 'chow' | 'pung' | 'pair';
/** A group made of concealed tiles; `start` is a tile index (0..33). */
export interface Group {
  type: GroupType;
  start: number;
}
export interface Split {
  shape: 'standard' | 'qidui';
  groups: Group[];
}

const isHonourIdx = (i: number) => i >= 27;

/**
 * Every way to split `counts` into `sets` sets (chows/pungs) plus one pair.
 * Recursion always consumes the lowest remaining tile, so each split appears once.
 */
export function standardSplits(counts: number[], sets: number): Split[] {
  const out: Split[] = [];
  const c = counts.slice();
  const groups: Group[] = [];
  const total = c.reduce((a, b) => a + b, 0);
  if (total !== sets * 3 + 2) return out;

  function rec(pairUsed: boolean) {
    let i = 0;
    while (i < 34 && c[i] === 0) i++;
    if (i === 34) {
      if (pairUsed) out.push({ shape: 'standard', groups: groups.slice() });
      return;
    }
    if (!pairUsed && c[i] >= 2) {
      c[i] -= 2; groups.push({ type: 'pair', start: i });
      rec(true);
      groups.pop(); c[i] += 2;
    }
    if (c[i] >= 3) {
      c[i] -= 3; groups.push({ type: 'pung', start: i });
      rec(pairUsed);
      groups.pop(); c[i] += 3;
    }
    if (!isHonourIdx(i) && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--; groups.push({ type: 'chow', start: i });
      rec(pairUsed);
      groups.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
    }
  }
  rec(false);
  return out;
}

/** 嚦咕嚦咕: 17 concealed tiles as 7 pairs + 1 triplet (four of a kind is not two pairs). */
export function qiduiSplit(counts: number[]): Split | null {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total !== 17) return null;
  const groups: Group[] = [];
  let pungs = 0;
  for (let i = 0; i < 34; i++) {
    if (counts[i] === 0) continue;
    if (counts[i] === 2) groups.push({ type: 'pair', start: i });
    else if (counts[i] === 3) { groups.push({ type: 'pung', start: i }); pungs++; }
    else return null;
  }
  return pungs === 1 ? { shape: 'qidui', groups } : null;
}

export function allSplits(counts: number[], sets: number, qiduiOn: boolean): Split[] {
  const splits = standardSplits(counts, sets);
  if (qiduiOn && sets === 5) {
    const q = qiduiSplit(counts);
    if (q) splits.push(q);
  }
  return splits;
}

export function groupContains(g: Group, idx: number): boolean {
  return g.type === 'chow' ? idx >= g.start && idx <= g.start + 2 : idx === g.start;
}

export function groupTiles(g: Group): string[] {
  if (g.type === 'chow') return [ALL_TILES[g.start], ALL_TILES[g.start + 1], ALL_TILES[g.start + 2]];
  return new Array(g.type === 'pung' ? 3 : 2).fill(ALL_TILES[g.start]);
}

export type WaitShape = '單吊' | '邊張' | '中洞' | '兩面' | '對碰';
/** The wait shape if the winning tile completed group `g`. */
export function waitShape(g: Group, winIdx: number): WaitShape {
  if (g.type === 'pair') return '單吊';
  if (g.type === 'pung') return '對碰';
  const pos = winIdx - g.start; // 0,1,2
  if (pos === 1) return '中洞';
  const rank = g.start % 9; // 0-based rank of the chow's first tile
  if ((pos === 2 && rank === 0) || (pos === 0 && rank === 6)) return '邊張';
  return '兩面';
}
