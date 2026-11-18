import { allSplits } from './decompose';
import { ALL_TILES, countTiles, isFlower, isTile, rankOf, suitOf, tileName } from './tiles';
import type { HandContext, HandEntry, Meld } from './types';

const isSeat = (s: unknown) => s === 0 || s === 1 || s === 2 || s === 3;

function meldProblem(m: Meld, n: number): string | null {
  const label = `Exposed set ${n} (${m.kind})`;
  if (m.tiles.some((t) => !isTile(t))) return `${label} has an unknown tile.`;
  const want = m.kind === 'minkan' || m.kind === 'ankan' ? 4 : 3;
  if (m.tiles.length !== want) return `${label} needs ${want} tiles, has ${m.tiles.length}.`;
  if (m.kind === 'chi') {
    const s = m.tiles.map(suitOf);
    const r = m.tiles.map(rankOf).sort((a, b) => a - b);
    if (s[0] === 'z' || s.some((x) => x !== s[0]) || r[1] !== r[0] + 1 || r[2] !== r[0] + 2)
      return `${label} isn't a run of three in one number suit.`;
  } else if (m.tiles.some((t) => t !== m.tiles[0])) {
    return `${label} must be ${want} identical tiles.`;
  }
  return null;
}

/** Context problems (bad seats, dice). Empty = OK. */
export function validateContext(ctx: HandContext): string[] {
  const e: string[] = [];
  if (!isSeat(ctx.dealer) || !isSeat(ctx.winner)) e.push('Dealer and winner must be seats 0–3.');
  if (ctx.from !== 'zimo' && !isSeat(ctx.from)) e.push('Discarder must be a seat 0–3.');
  if (ctx.from === ctx.winner) e.push('The winner can\'t also be the discarder.');
  if (!Number.isInteger(ctx.streak) || ctx.streak < 0) e.push('Streak must be a whole number ≥ 0.');
  if (ctx.roundWind < 0 || ctx.roundWind > 3) e.push('Round wind must be 0–3.');
  if (ctx.dice && ctx.dice.some((d) => !Number.isInteger(d) || d < 1 || d > 6)) e.push('Each die must be 1–6.');
  return e;
}

/** Every reason the entered hand is not a legal win. Empty = legal. */
export function validateHand(entry: HandEntry, ctx: HandContext, qiduiOn: boolean): string[] {
  const e = validateContext(ctx);
  const bad = entry.flowers.filter((f) => !isFlower(f));
  if (bad.length) e.push(`Not flowers: ${bad.join(', ')} (flowers are f1–f8 and are held outside the hand).`);
  if (new Set(entry.flowers).size !== entry.flowers.length) e.push('The same flower is entered twice.');

  if (entry.flowerWin) {
    if (entry.flowers.length !== 8) e.push(`${entry.flowerWin === 'baxian' ? '八仙過海' : '七搶一'} needs all 8 flowers entered (has ${entry.flowers.length}).`);
    if (entry.flowerWin === 'baxian' && ctx.from !== 'zimo') e.push('八仙過海 is scored as a self-draw.');
    if (entry.flowerWin === 'qiqiangyi' && ctx.from === 'zimo') e.push('七搶一 needs the seat that held the 8th flower as the payer.');
    return e;
  }

  const unknown = [...entry.concealed, ...(entry.winningTile ? [entry.winningTile] : [])].filter((t) => !isTile(t));
  if (unknown.length) {
    const flowersInHand = unknown.filter(isFlower);
    e.push(flowersInHand.length
      ? `Flowers ${flowersInHand.join(', ')} are in the hand; move them to the flower row.`
      : `Unknown tiles: ${unknown.join(', ')}.`);
    return e;
  }
  entry.melds.forEach((m, i) => { const p = meldProblem(m, i + 1); if (p) e.push(p); });
  if (e.length) return e;

  const kongs = entry.melds.filter((m) => m.kind === 'minkan' || m.kind === 'ankan').length;
  const total = entry.concealed.length + entry.melds.reduce((a, m) => a + m.tiles.length, 0);
  const expected = 17 + kongs;
  if (total !== expected)
    e.push(`Expected ${expected} tiles${kongs ? ` (17 + ${kongs} for kong${kongs > 1 ? 's' : ''})` : ''}, got ${total}: ${entry.concealed.length} concealed + ${total - entry.concealed.length} in exposed sets.`);
  if (entry.melds.length > 5) e.push('More than 5 exposed sets.');

  const all = countTiles([...entry.concealed, ...entry.melds.flatMap((m) => m.tiles)]);
  all.forEach((n, i) => { if (n > 4) e.push(`${n} of ${tileName(ALL_TILES[i])} (${ALL_TILES[i]}) entered; there are only 4.`); });

  if (!entry.winningTile) e.push('Mark the winning tile.');
  else if (!entry.concealed.includes(entry.winningTile)) e.push(`The winning tile ${entry.winningTile} must be among the concealed tiles.`);

  if (entry.flags.kongReplacement && ctx.from !== 'zimo') e.push('槓上開花 is a self-draw; it can\'t be off a discard.');
  if (entry.flags.robbedKong && ctx.from === 'zimo') e.push('搶槓 is won off the player making the kong; pick them as the payer.');
  if (entry.flags.robbedKong && entry.flags.kongReplacement) e.push('搶槓 and 槓上開花 can\'t both apply.');

  if (e.length) return e;
  const sets = 5 - entry.melds.length;
  if (allSplits(countTiles(entry.concealed), sets, qiduiOn && entry.melds.length === 0).length === 0)
    e.push(`The concealed tiles don't split into ${sets} set${sets === 1 ? '' : 's'} and a pair${qiduiOn && entry.melds.length === 0 ? ' (or 7 pairs + a triplet)' : ''}.`);
  return e;
}
