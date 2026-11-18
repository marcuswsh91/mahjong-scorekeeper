// The starting rule catalogue. Every value the engine uses comes from a RuleSet
// built from these items; nothing in the engine hardcodes a tai value.
//
// Source keys:
//   BRIEF = the project brief (your table's starting values)
//   WB    = zh.wikibooks「臺灣麻將」台數表 §4.3–4.11, oldid 186135 (edited 2026-07-13)
//           https://zh.wikibooks.org/wiki/臺灣麻將
//   ASKED = your answers during planning (2026-11-17)
//   CC    = Claude's proposed default, not from your brief: confirm at the table

export type RuleGroup =
  | 'stakes' | 'dice' | 'falseWin' | 'howWon' | 'honours'
  | 'shape' | 'flowers' | 'opening' | 'regional';

export const GROUP_ORDER: { id: RuleGroup; zh: string; en: string }[] = [
  { id: 'stakes', zh: '底台與莊家', en: 'Stakes and dealer' },
  { id: 'dice', zh: '門骰', en: 'Dice' },
  { id: 'falseWin', zh: '詐胡', en: 'False win' },
  { id: 'howWon', zh: '胡法', en: 'How you won' },
  { id: 'honours', zh: '風牌與三元', en: 'Winds and dragons' },
  { id: 'shape', zh: '牌型', en: 'Hand shape' },
  { id: 'flowers', zh: '花牌', en: 'Flowers' },
  { id: 'opening', zh: '起手', en: 'Opening hands' },
  { id: 'regional', zh: '地方加台', en: 'Regional add-ons' },
];

export type RuleValue = number | boolean | string | null;

interface Base {
  id: string;
  group: RuleGroup;
  zh: string;
  en: string;
  /** One-line condition shown in the interview. */
  condition: string;
  /** Exclusions shown on the item and enforced by the engine. */
  note?: string;
  source: string;
}
export type CatalogueItem =
  | (Base & { kind: 'tai'; default: number; max?: number }) // stepper, 0 = Off
  | (Base & { kind: 'number'; default: number; min: number; max?: number })
  | (Base & { kind: 'yesno'; default: boolean | null })
  | (Base & { kind: 'choice'; default: string | null; options: { value: string; label: string }[] });

export const CATALOGUE: CatalogueItem[] = [
  // ── Stakes and dealer ──────────────────────────────────────────
  { id: 'basePoints', group: 'stakes', kind: 'number', default: 3, min: 0, zh: '底', en: 'Base points',
    condition: 'Every payer pays this, plus the tai.', source: 'BRIEF' },
  { id: 'pointsPerTai', group: 'stakes', kind: 'number', default: 1, min: 1, zh: '每台', en: 'Points per tai',
    condition: 'A payer pays base + tai × this.', source: 'BRIEF' },
  { id: 'dealer', group: 'stakes', kind: 'tai', default: 1, zh: '莊家', en: 'Dealer',
    condition: 'Added when the dealer wins or pays.', source: 'BRIEF; WB 莊家 1' },
  { id: 'streak', group: 'stakes', kind: 'tai', default: 2, zh: '連莊拉莊', en: 'Each 連N拉N',
    condition: 'Per streak count N, on top of 莊家 (連1拉1 = +3 with 莊家 1).', source: 'BRIEF; WB 2N+1' },
  { id: 'zimoDealerOnly', group: 'stakes', kind: 'yesno', default: true, zh: '閒家自摸只莊家付莊台', en: 'Non-dealer zimo: only dealer pays dealer tai',
    condition: 'Yes: only the dealer\'s payment includes dealer tai. No: all three payments do.', source: 'BRIEF' },
  { id: 'discardDealerTai', group: 'stakes', kind: 'choice', default: 'either', zh: '放槍莊台', en: 'Dealer tai on a discard win',
    condition: 'When the discarder pays dealer tai.',
    options: [{ value: 'either', label: 'Dealer wins or discards' }, { value: 'winnerOnly', label: 'Only if dealer wins' }],
    source: 'ASKED' },
  { id: 'drawExtendsStreak', group: 'stakes', kind: 'yesno', default: true, zh: '流局連莊', en: '流局 adds to the streak',
    condition: 'The dealer stays on a drawn hand; Yes also adds 1 to the streak.', source: 'BRIEF; WB 臭莊' },
  { id: 'doubleWin', group: 'stakes', kind: 'choice', default: 'jiehu', zh: '一炮多響', en: 'Two winners on one discard',
    condition: 'Only the first player in turn order after the discarder wins.',
    options: [{ value: 'jiehu', label: '截胡 (first in turn order)' }], source: 'BRIEF' },
  { id: 'taiCap', group: 'stakes', kind: 'number', default: 0, min: 0, zh: '封頂', en: 'Tai cap',
    condition: 'Caps the hand tai (before dealer tai and dice). 0 = Off.', source: 'BRIEF (Off); how it applies is an open question' },

  // ── Dice (門骰) ────────────────────────────────────────────────
  { id: 'diceStraight', group: 'dice', kind: 'tai', default: 1, zh: '順子骰', en: 'Straight 1-2-3 / 2-3-4 / 3-4-5',
    condition: 'Dealer\'s roll, any order. Goes to whoever wins the hand.', source: 'BRIEF' },
  { id: 'dice456', group: 'dice', kind: 'tai', default: 2, zh: '四五六', en: 'Roll 4-5-6',
    condition: 'Dealer\'s roll, any order. Goes to whoever wins the hand.', source: 'BRIEF' },
  { id: 'diceTripleMult', group: 'dice', kind: 'number', default: 3, min: 1, zh: '豹子', en: 'Triple multiplies the payout by',
    condition: 'Any triple: (base + all tai) × this. 1 = Off.', source: 'BRIEF' },
  { id: 'diceTripleDealer', group: 'dice', kind: 'yesno', default: true, zh: '豹子乘莊台', en: 'Triple also multiplies dealer tai',
    condition: 'No: dealer tai is added after multiplying.', source: 'BRIEF' },
  { id: 'diceCarryOver', group: 'dice', kind: 'yesno', default: false, zh: '流局骰留', en: 'Bonus carries over after a 流局',
    condition: 'Yes: a drawn hand\'s dice bonus applies to the next hand too.', source: 'BRIEF' },

  // ── False win (詐胡) ──────────────────────────────────────────
  { id: 'falseWinMode', group: 'falseWin', kind: 'choice', default: null, zh: '詐胡金額', en: 'False win amount',
    condition: 'The false winner pays this hand amount to each of the other three.',
    options: [{ value: 'announced', label: 'Tai they announced' }, { value: 'fixed', label: 'Fixed tai' }],
    source: 'BRIEF (no common standard); WB: pay 1 base + tai to each of three' },
  { id: 'falseWinFixedTai', group: 'falseWin', kind: 'tai', default: 0, zh: '詐胡固定台', en: 'Fixed tai',
    condition: 'Used when the amount is fixed. Can\'t be Off then.', source: 'BRIEF' },
  { id: 'falseWinDealerTai', group: 'falseWin', kind: 'yesno', default: null, zh: '詐胡算莊台', en: 'Dealer tai applies',
    condition: 'Yes: dealer tai is added on payments to or from the dealer.', source: 'BRIEF (no common standard)' },
  { id: 'falseWinDice', group: 'falseWin', kind: 'yesno', default: null, zh: '詐胡算骰', en: 'Dice bonus applies',
    condition: 'Yes: the hand\'s dice bonus is applied to the penalty.', source: 'BRIEF (no common standard)' },
  { id: 'falseWinDealerAfter', group: 'falseWin', kind: 'choice', default: null, zh: '詐胡後莊家', en: 'Dealer afterwards',
    condition: 'What happens to the deal after a false win.',
    options: [{ value: 'stays', label: 'Dealer stays' }, { value: 'passes', label: 'Dealer passes' }],
    source: 'BRIEF (no common standard)' },

  // ── How you won ───────────────────────────────────────────────
  { id: 'zimo', group: 'howWon', kind: 'tai', default: 1, zh: '自摸', en: 'Self-draw',
    condition: 'You drew the winning tile yourself.', source: 'BRIEF; WB 1' },
  { id: 'menqing', group: 'howWon', kind: 'tai', default: 1, zh: '門清', en: 'Concealed hand',
    condition: 'No 吃, 碰 or 明槓 (暗槓 allowed).', source: 'BRIEF; WB 1' },
  { id: 'menqingZimo', group: 'howWon', kind: 'tai', default: 3, zh: '門清自摸', en: 'Concealed self-draw',
    condition: 'Concealed hand and self-draw.', note: 'Replaces 門清 + 自摸.', source: 'BRIEF; WB 不求 3' },
  { id: 'quanqiuren', group: 'howWon', kind: 'tai', default: 2, zh: '全求人', en: 'All melded',
    condition: 'All five sets melded, win off a discard on the single tile left.', note: 'Doesn\'t stack with 獨聽.', source: 'BRIEF; WB 全求 2' },
  { id: 'duting', group: 'howWon', kind: 'tai', default: 1, zh: '獨聽 (邊張/中洞/單吊)', en: 'Single wait',
    condition: 'Exactly one tile could have won the hand.', source: 'BRIEF; WB 1' },
  { id: 'gangshang', group: 'howWon', kind: 'tai', default: 1, zh: '槓上開花', en: 'Win on kong replacement',
    condition: 'Self-draw on the replacement tile after a kong. 自摸 also counts.', source: 'BRIEF; WB 1 (WB also counts a flower replacement)' },
  { id: 'haidi', group: 'howWon', kind: 'tai', default: 1, zh: '海底撈月', en: 'Last-tile self-draw',
    condition: 'Self-draw on the last tile of the wall. 自摸 also counts.', source: 'BRIEF; WB 1' },
  { id: 'hedi', group: 'howWon', kind: 'tai', default: 1, zh: '河底撈魚', en: 'Last-discard win',
    condition: 'Win on the last discard of the hand.', source: 'BRIEF; WB 1' },
  { id: 'qianggang', group: 'howWon', kind: 'tai', default: 1, zh: '搶槓', en: 'Robbing a kong',
    condition: 'Win on a tile someone adds to a 碰 to make a kong. They pay.', source: 'BRIEF; WB 1' },
  { id: 'baoting', group: 'howWon', kind: 'tai', default: 0, max: 2, zh: '報聽', en: 'Declared ready',
    condition: 'Declared ready before winning.', note: 'Replaced by 地聽 / 天聽.', source: 'BRIEF (Off, 0–2); not in WB' },

  // ── Winds and dragons ─────────────────────────────────────────
  { id: 'roundWind', group: 'honours', kind: 'tai', default: 1, zh: '圈風刻', en: 'Round wind triplet',
    condition: 'Triplet or kong of the round wind.', source: 'BRIEF; WB 圈風牌 1' },
  { id: 'seatWind', group: 'honours', kind: 'tai', default: 1, zh: '門風刻', en: 'Seat wind triplet',
    condition: 'Triplet or kong of your seat wind (dealer = 東).', source: 'BRIEF; WB 門風牌 1' },
  { id: 'dragon', group: 'honours', kind: 'tai', default: 1, zh: '三元刻', en: 'Dragon triplet (each)',
    condition: 'Each triplet or kong of 中, 發 or 白.', source: 'BRIEF; WB 三元牌 1' },
  { id: 'xiaosanyuan', group: 'honours', kind: 'tai', default: 4, zh: '小三元', en: 'Little three dragons',
    condition: 'Two dragon triplets and a dragon pair.', note: 'Replaces 三元刻.', source: 'BRIEF; WB 4 (不得重複計算三元台)' },
  { id: 'dasanyuan', group: 'honours', kind: 'tai', default: 8, zh: '大三元', en: 'Big three dragons',
    condition: 'Three dragon triplets.', source: 'BRIEF; WB 8' },
  { id: 'dasanyuanReplacesDragon', group: 'honours', kind: 'yesno', default: true, zh: '大三元不計三元刻', en: '大三元 replaces 三元刻',
    condition: 'Yes: no 三元刻 tai on top of 大三元.', source: 'CC (not from your brief); WB says 不得重複計算三元台' },
  { id: 'xiaosixi', group: 'honours', kind: 'tai', default: 8, zh: '小四喜', en: 'Little four winds',
    condition: 'Three wind triplets and a wind pair.', source: 'BRIEF; WB 8' },
  { id: 'xiaosixiReplacesWind', group: 'honours', kind: 'yesno', default: false, zh: '小四喜不計風台', en: '小四喜 replaces wind tai',
    condition: 'Yes: no 圈風刻 / 門風刻 on top of 小四喜.', source: 'CC (not from your brief); WB says 小四喜 得加計風牌台 (= No)' },
  { id: 'dasixi', group: 'honours', kind: 'tai', default: 16, zh: '大四喜', en: 'Big four winds',
    condition: 'Four wind triplets.', note: 'Replaces 圈風刻 / 門風刻.', source: 'BRIEF; WB 16 (不重複計算風牌台)' },

  // ── Hand shape ────────────────────────────────────────────────
  { id: 'pinghu', group: 'shape', kind: 'tai', default: 2, zh: '平胡', en: 'All chows',
    condition: 'Five chows, no honours, no flowers, not self-draw, not a single wait.', source: 'BRIEF; WB 2 (無花、無字、無刻、非獨聽、非自摸)' },
  { id: 'pengpeng', group: 'shape', kind: 'tai', default: 4, zh: '碰碰胡', en: 'All triplets',
    condition: 'Five triplets or kongs.', source: 'BRIEF; WB 4' },
  { id: 'an3', group: 'shape', kind: 'tai', default: 2, zh: '三暗刻', en: 'Three concealed triplets',
    condition: 'Three triplets not completed by a 碰 or someone\'s discard (暗槓 counts).', source: 'BRIEF; WB 2' },
  { id: 'an4', group: 'shape', kind: 'tai', default: 5, zh: '四暗刻', en: 'Four concealed triplets',
    condition: 'Four concealed triplets.', note: 'Replaces 三暗刻.', source: 'BRIEF; WB 5' },
  { id: 'an5', group: 'shape', kind: 'tai', default: 8, zh: '五暗刻', en: 'Five concealed triplets',
    condition: 'Five concealed triplets.', note: 'Replaces 三暗刻 / 四暗刻.', source: 'BRIEF; WB 8' },
  { id: 'hunyise', group: 'shape', kind: 'tai', default: 4, zh: '混一色', en: 'One suit plus honours',
    condition: 'One number suit plus honours.', source: 'BRIEF; WB 4' },
  { id: 'qingyise', group: 'shape', kind: 'tai', default: 8, zh: '清一色', en: 'One suit only',
    condition: 'One number suit, no honours.', note: 'Replaces 混一色.', source: 'BRIEF; WB 8' },
  { id: 'ziyise', group: 'shape', kind: 'tai', default: 8, zh: '字一色', en: 'All honours',
    condition: 'Only wind and dragon tiles.', source: 'BRIEF (8, varies 8–32); WB gives no single value' },
  { id: 'ziyiseReplacesHunyise', group: 'shape', kind: 'yesno', default: true, zh: '字一色不計混一色', en: '字一色 replaces 混一色',
    condition: 'Yes: no 混一色 on top of 字一色.', source: 'CC (not from your brief)' },
  { id: 'ziyiseReplacesPengpeng', group: 'shape', kind: 'yesno', default: false, zh: '字一色不計碰碰胡', en: '字一色 replaces 碰碰胡',
    condition: 'Yes: no 碰碰胡 on top of 字一色.', source: 'CC (not from your brief); WB lists both variants' },

  // ── Flowers ───────────────────────────────────────────────────
  { id: 'zhenghua', group: 'flowers', kind: 'tai', default: 1, zh: '正花', en: 'Seat flower (each)',
    condition: 'Flower matching your seat: 東 春梅, 南 夏蘭, 西 秋菊, 北 冬竹.', source: 'BRIEF; WB 1' },
  { id: 'huagang', group: 'flowers', kind: 'tai', default: 2, zh: '花槓', en: 'Full flower set (each)',
    condition: 'All four of 春夏秋冬 or of 梅蘭竹菊. 正花 also counts.', source: 'BRIEF; WB 2 (可加算正花台)' },
  { id: 'qiqiangyi', group: 'flowers', kind: 'tai', default: 8, zh: '七搶一', en: 'Seven flowers rob the eighth',
    condition: 'You hold 7 flowers and take the 8th; its holder pays alone, as a discard.', source: 'BRIEF; WB 8; payer ASKED' },
  { id: 'baxian', group: 'flowers', kind: 'tai', default: 8, zh: '八仙過海', en: 'All eight flowers',
    condition: 'You hold all 8 flowers. Scored as a self-draw: 自摸 also counts.', source: 'BRIEF (8 + 自摸); WB 視為自摸8台' },

  // ── Opening hands ─────────────────────────────────────────────
  { id: 'tianhu', group: 'opening', kind: 'tai', default: 24, zh: '天胡', en: 'Heavenly win',
    condition: 'Dealer wins on the opening deal. Stacks with everything.', source: 'BRIEF 24; WB 32' },
  { id: 'dihu', group: 'opening', kind: 'tai', default: 16, zh: '地胡', en: 'Earthly win',
    condition: 'Non-dealer self-draws on their first draw. Stacks with everything.', source: 'BRIEF; WB 16 (WB: on the dealer\'s first discard)' },
  { id: 'renhu', group: 'opening', kind: 'tai', default: 8, zh: '人胡', en: 'Human win',
    condition: 'Non-dealer wins off a discard in the first go-around. Stacks with everything.', source: 'BRIEF; not in WB' },
  { id: 'diting', group: 'opening', kind: 'tai', default: 4, zh: '地聽', en: 'Early ready',
    condition: 'Declared ready in the first go-around, no calls made; must win.', note: 'Replaces 報聽.', source: 'BRIEF 4; WB 8' },
  { id: 'tianting', group: 'opening', kind: 'tai', default: 0, zh: '天聽', en: 'Ready from the deal',
    condition: 'Ready straight from the deal and declared; must win.', note: 'Replaces 報聽.', source: 'BRIEF (Off); WB 16' },

  // ── Regional add-ons (Off by default) ─────────────────────────
  { id: 'jianhua', group: 'regional', kind: 'tai', default: 0, zh: '見花見台', en: 'Every flower counts',
    condition: 'Tai per flower held, any seat.', note: 'Replaces 正花 (each flower counted once).', source: 'BRIEF (1 when on)' },
  { id: 'jianfeng', group: 'regional', kind: 'tai', default: 0, zh: '見風見台', en: 'Every wind triplet counts',
    condition: 'Tai per wind triplet that earns no 圈風 / 門風 tai.', source: 'BRIEF (1 when on)' },
  { id: 'wuziwuhua', group: 'regional', kind: 'tai', default: 0, zh: '無字無花', en: 'No honours, no flowers',
    condition: 'No honour tiles and no flowers.', note: 'Replaces 無花.', source: 'BRIEF (2 when on)' },
  { id: 'wuhua', group: 'regional', kind: 'tai', default: 0, zh: '無花', en: 'No flowers',
    condition: 'You hold no flowers.', source: 'BRIEF (1 when on)' },
  { id: 'minggang', group: 'regional', kind: 'tai', default: 0, zh: '明槓', en: 'Exposed kong (each)',
    condition: 'Tai per exposed kong.', source: 'BRIEF (1 when on)' },
  { id: 'angang', group: 'regional', kind: 'tai', default: 0, zh: '暗槓', en: 'Concealed kong (each)',
    condition: 'Tai per concealed kong.', source: 'BRIEF (2 when on)' },
  { id: 'yifa', group: 'regional', kind: 'tai', default: 0, zh: '一發', en: 'Win within one go-around of declaring',
    condition: 'Win before your next discard after declaring ready.', source: 'BRIEF (1 when on)' },
  { id: 'qidui', group: 'regional', kind: 'tai', default: 0, zh: '嚦咕嚦咕', en: 'Seven pairs plus a triplet',
    condition: 'Fully concealed: 7 pairs and 1 triplet.', source: 'BRIEF (no common value: you set it); not in WB' },
];

export const CATALOGUE_BY_ID: Map<string, CatalogueItem> = new Map(CATALOGUE.map((i) => [i.id, i]));
