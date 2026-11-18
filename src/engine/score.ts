import { CATALOGUE_BY_ID } from '../rules/catalogue';
import { choice, num, yes, type RuleSet } from '../rules/ruleset';
import { allSplits, groupContains, groupTiles, waitShape, type Group, type Split, type WaitShape } from './decompose';
import { classifyDice, dealerTaiFor, netBySeat, payerAmount, type DiceBonus, type Payment } from './payments';
import { ALL_TILES, countTiles, formatTiles, isHonour, suitOf, tileIndex, tileName, type Tile } from './tiles';
import { seatWindOf, type HandContext, type HandEntry, type Seat } from './types';
import { validateHand } from './validate';
import { winningTiles } from './waits';

export interface TaiLine {
  id: string; // catalogue id, custom item id, or 'cap'
  zh: string;
  en: string;
  tai: number;
  detail?: string;
}

export interface LegalScore {
  legal: true;
  /** Hand tai lines (dealer tai and dice are per payer, in `payments`). */
  lines: TaiLine[];
  handTai: number;
  /** How the hand was read, e.g. "123m 456m 789m 11z | 吃 345p". */
  split: string;
  waitTiles: Tile[];
  waitShape: WaitShape | null;
  dice: DiceBonus;
  payments: Payment[];
  net: [number, number, number, number];
}
export interface IllegalScore {
  legal: false;
  reasons: string[];
}
export type ScoreResult = LegalScore | IllegalScore;

/** A set as the scorer sees it, whether exposed or from the concealed split. */
interface SetView {
  kind: 'chow' | 'pung' | 'kong' | 'pair';
  tile: number; // tile index (first tile for chows)
  concealed: boolean;
}

const ALL_SEATS: Seat[] = [0, 1, 2, 3];

class Lines {
  list: TaiLine[] = [];
  constructor(private rules: RuleSet) {}
  /** Add catalogue item `id` × `times` if it is on (value > 0). */
  add(id: string, detail?: string, times = 1) {
    const v = num(this.rules, id);
    if (v > 0 && times > 0) {
      const item = CATALOGUE_BY_ID.get(id)!;
      this.list.push({ id, zh: item.zh, en: item.en, tai: v * times, detail: times > 1 ? `${times} × ${v}${detail ? `: ${detail}` : ''}` : detail });
    }
  }
  on(id: string) {
    return num(this.rules, id) > 0;
  }
  total() {
    return this.list.reduce((a, l) => a + l.tai, 0);
  }
}

function setViews(entry: HandEntry, split: Split, placement: number, zimo: boolean): SetView[] {
  const views: SetView[] = entry.melds.map((m) => {
    const t = tileIndex(m.tiles.slice().sort()[0]);
    if (m.kind === 'chi') return { kind: 'chow', tile: t, concealed: false };
    if (m.kind === 'pon') return { kind: 'pung', tile: t, concealed: false };
    return { kind: 'kong', tile: t, concealed: m.kind === 'ankan' };
  });
  split.groups.forEach((g, i) => {
    // A triplet completed by someone else's discard does not count as concealed.
    const concealed = !(g.type === 'pung' && i === placement && !zimo);
    views.push({ kind: g.type, tile: g.start, concealed });
  });
  return views;
}

function scoreCandidate(entry: HandEntry, ctx: HandContext, rules: RuleSet, split: Split, placement: number, waits: Tile[]): Lines {
  const L = new Lines(rules);
  const zimo = ctx.from === 'zimo';
  const seatWind = seatWindOf(ctx.winner, ctx.dealer);
  const qidui = split.shape === 'qidui';
  const sets = setViews(entry, split, placement, zimo);
  const triplets = sets.filter((s) => s.kind === 'pung' || s.kind === 'kong');
  const pair = sets.find((s) => s.kind === 'pair');
  const allTiles = [...entry.concealed, ...entry.melds.flatMap((m) => m.tiles)];
  const hasHonour = allTiles.some(isHonour);
  const numberSuits = new Set(allTiles.filter((t) => !isHonour(t)).map(suitOf));
  const menqing = entry.melds.every((m) => m.kind === 'ankan');
  const winShape = waitShape(split.groups[placement], tileIndex(entry.winningTile!));

  // How you won
  if (menqing && zimo && L.on('menqingZimo')) L.add('menqingZimo');
  else {
    if (zimo) L.add('zimo');
    if (menqing) L.add('menqing');
  }
  const quanqiu = !qidui && !zimo && entry.melds.length === 5 && entry.melds.every((m) => m.kind !== 'ankan') && L.on('quanqiuren');
  if (quanqiu) L.add('quanqiuren', '單吊 off a discard');
  if (waits.length === 1 && !quanqiu) L.add('duting', `${winShape}: only ${tileName(waits[0])} wins`);
  if (entry.flags.kongReplacement && zimo) L.add('gangshang');
  if (entry.flags.lastTile) L.add(zimo ? 'haidi' : 'hedi');
  if (entry.flags.robbedKong) L.add('qianggang');
  const ready = entry.flags.ready;
  if (ready === 'dealt' && L.on('tianting')) L.add('tianting');
  else if (ready === 'early' && L.on('diting')) L.add('diting');
  else if (ready !== 'none') L.add('baoting');
  if (entry.flags.yifa && ready !== 'none') L.add('yifa');

  // Winds
  const windSets = triplets.filter((s) => s.tile >= 27 && s.tile <= 30);
  const windPair = !!pair && pair.tile >= 27 && pair.tile <= 30;
  const dasixi = windSets.length === 4;
  const xiaosixi = windSets.length === 3 && windPair;
  if (dasixi) L.add('dasixi');
  else if (xiaosixi) L.add('xiaosixi');
  const windSuppressed = (dasixi && L.on('dasixi')) || (xiaosixi && L.on('xiaosixi') && yes(rules, 'xiaosixiReplacesWind'));
  if (!windSuppressed) {
    for (const s of windSets) {
      const w = s.tile - 27;
      const name = tileName(ALL_TILES[s.tile]);
      if (w === ctx.roundWind) L.add('roundWind', name);
      if (w === seatWind) L.add('seatWind', name);
      if (w !== ctx.roundWind && w !== seatWind) L.add('jianfeng', name);
    }
  }

  // Dragons
  const dragonSets = triplets.filter((s) => s.tile >= 31);
  const dragonPair = !!pair && pair.tile >= 31;
  const dasanyuan = dragonSets.length === 3;
  const xiaosanyuan = dragonSets.length === 2 && dragonPair;
  if (dasanyuan) L.add('dasanyuan');
  else if (xiaosanyuan) L.add('xiaosanyuan');
  const dragonSuppressed = (dasanyuan && L.on('dasanyuan') && yes(rules, 'dasanyuanReplacesDragon')) || (xiaosanyuan && L.on('xiaosanyuan'));
  if (!dragonSuppressed) for (const s of dragonSets) L.add('dragon', tileName(ALL_TILES[s.tile]));

  // Hand shape
  const ziyise = numberSuits.size === 0;
  if (qidui) L.add('qidui');
  else {
    const chows = sets.filter((s) => s.kind === 'chow').length;
    if (chows === 5 && !hasHonour && entry.flowers.length === 0 && !zimo && waits.length > 1) L.add('pinghu');
    if (triplets.length === 5 && !(ziyise && L.on('ziyise') && yes(rules, 'ziyiseReplacesPengpeng'))) L.add('pengpeng');
    const an = triplets.filter((s) => s.concealed).length;
    const tier = (['an5', 'an4', 'an3'] as const).find((id, i) => an >= 5 - i && L.on(id));
    if (tier) L.add(tier, `${an} concealed`);
  }
  if (ziyise) L.add('ziyise');
  else if (numberSuits.size === 1 && !hasHonour) L.add('qingyise');
  if (numberSuits.size <= 1 && hasHonour && !(ziyise && L.on('ziyise') && yes(rules, 'ziyiseReplacesHunyise'))) L.add('hunyise');

  addFlowerLines(L, entry, seatWind);
  if (!hasHonour && entry.flowers.length === 0 && L.on('wuziwuhua')) L.add('wuziwuhua');
  else if (entry.flowers.length === 0) L.add('wuhua');
  L.add('minggang', undefined, entry.melds.filter((m) => m.kind === 'minkan').length);
  L.add('angang', undefined, entry.melds.filter((m) => m.kind === 'ankan').length);

  addOpeningLines(L, entry, ctx);
  return L;
}

function addFlowerLines(L: Lines, entry: HandEntry, seatWind: number) {
  const f = entry.flowers;
  if (L.on('jianhua')) L.add('jianhua', f.map(tileName).join(''), f.length);
  else {
    const own = f.filter((x) => x === `f${seatWind + 1}` || x === `f${seatWind + 5}`);
    L.add('zhenghua', own.map(tileName).join(''), own.length);
  }
  const sets = [['f1', 'f2', 'f3', 'f4'], ['f5', 'f6', 'f7', 'f8']].filter((s) => s.every((x) => f.includes(x)));
  L.add('huagang', sets.map((s) => s.map(tileName).join('')).join(' '), sets.length);
}

function addOpeningLines(L: Lines, entry: HandEntry, ctx: HandContext) {
  if (!entry.flags.firstDraw) return;
  const dealerWins = ctx.winner === ctx.dealer;
  if (ctx.from === 'zimo') L.add(dealerWins ? 'tianhu' : 'dihu');
  else if (!dealerWins) L.add('renhu');
}

function describe(entry: HandEntry, split: Split): string {
  const conc = split.groups.map((g: Group) => formatTiles(groupTiles(g))).join(' ');
  const exposed = entry.melds.map((m) => `${({ chi: '吃', pon: '碰', minkan: '明槓', ankan: '暗槓' })[m.kind]} ${formatTiles(m.tiles)}`);
  return [conc, ...exposed].join(' | ') + (split.shape === 'qidui' ? ' (嚦咕嚦咕)' : '');
}

/**
 * Score one confirmed hand. Pure: no UI, no storage.
 * Tries every split and every placement of the winning tile and keeps the highest hand tai.
 */
export function scoreHand(entry: HandEntry, ctx: HandContext, rules: RuleSet): ScoreResult {
  const qiduiOn = num(rules, 'qidui') > 0;
  const reasons = validateHand(entry, ctx, qiduiOn);
  if (reasons.length) return { legal: false, reasons };

  let best: { L: Lines; split: string; waits: Tile[]; shape: WaitShape | null } | null = null;
  if (entry.flowerWin) {
    const L = new Lines(rules);
    if (entry.flowerWin === 'qiqiangyi') L.add('qiqiangyi');
    else { L.add('baxian'); L.add('zimo'); }
    best = { L, split: `Flower win: ${entry.flowers.map(tileName).join('')}`, waits: [], shape: null };
  } else {
    const winIdx = tileIndex(entry.winningTile!);
    const waits = winningTiles(entry, qiduiOn);
    const splits = allSplits(countTiles(entry.concealed), 5 - entry.melds.length, qiduiOn && entry.melds.length === 0);
    for (const split of splits) {
      const seen = new Set<string>();
      split.groups.forEach((g, i) => {
        if (!groupContains(g, winIdx)) return;
        const key = `${g.type}${g.start}`;
        if (seen.has(key)) return; // identical groups give identical scores
        seen.add(key);
        const L = scoreCandidate(entry, ctx, rules, split, i, waits);
        if (!best || L.total() > best.L.total())
          best = { L, split: describe(entry, split), waits, shape: waitShape(g, winIdx) };
      });
    }
  }
  const b = best!;

  // Custom items, tapped on at entry
  for (const id of entry.customItems) {
    const c = rules.custom.find((x) => x.id === id);
    if (c && c.tai > 0) b.L.list.push({ id: c.id, zh: c.name, en: 'Custom item', tai: c.tai, detail: c.condition });
  }
  const cap = num(rules, 'taiCap');
  const raw = b.L.total();
  if (cap > 0 && raw > cap) b.L.list.push({ id: 'cap', zh: '封頂', en: 'Tai cap', tai: cap - raw, detail: `${raw} capped at ${cap}` });
  const handTai = b.L.total();

  const dice = classifyDice(ctx.dice, rules);
  const payments = handPayments(handTai, ctx, dice, rules);
  return { legal: true, lines: b.L.list, handTai, split: b.split, waitTiles: b.waits, waitShape: b.shape, dice, payments, net: netBySeat(payments) };
}

/** Who pays whom for a win, with dealer tai per payer. */
export function handPayments(handTai: number, ctx: HandContext, dice: DiceBonus, rules: RuleSet): Payment[] {
  const zimo = ctx.from === 'zimo';
  const payers = zimo ? ALL_SEATS.filter((s) => s !== ctx.winner) : [ctx.from as Seat];
  const dealer = dealerTaiFor(ctx.streak, rules);
  return payers.map((p) => {
    let involved = ctx.winner === ctx.dealer || p === ctx.dealer;
    if (zimo && ctx.winner !== ctx.dealer && !yes(rules, 'zimoDealerOnly')) involved = true;
    if (!zimo && choice(rules, 'discardDealerTai') === 'winnerOnly') involved = ctx.winner === ctx.dealer;
    const { amount, lines } = payerAmount(handTai, involved ? dealer.tai : 0, dealer.label, dice, rules);
    return { from: p, to: ctx.winner, amount, lines };
  });
}

/**
 * 詐胡: the false winner pays the hand amount to each of the other three.
 * `announcedTai` is used when the rule set says the amount is the tai they announced.
 */
export function scoreFalseWin(offender: Seat, ctx: Pick<HandContext, 'dealer' | 'streak' | 'dice'>, rules: RuleSet, announcedTai: number): { tai: number; payments: Payment[]; net: [number, number, number, number] } {
  const tai = choice(rules, 'falseWinMode') === 'fixed' ? num(rules, 'falseWinFixedTai') : announcedTai;
  const dice = yes(rules, 'falseWinDice') ? classifyDice(ctx.dice, rules) : classifyDice(null, rules);
  const dealer = dealerTaiFor(ctx.streak, rules);
  const payments = ALL_SEATS.filter((s) => s !== offender).map((to) => {
    const involved = yes(rules, 'falseWinDealerTai') && (offender === ctx.dealer || to === ctx.dealer);
    const { amount, lines } = payerAmount(tai, involved ? dealer.tai : 0, dealer.label, dice, rules);
    return { from: offender, to, amount, lines: [`詐胡 penalty`, ...lines] };
  });
  return { tai, payments, net: netBySeat(payments) };
}
