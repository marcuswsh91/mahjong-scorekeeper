// Helpers for building synthetic hands in tests.
import { defaultRuleSet, type RuleSet } from '../rules/ruleset';
import type { RuleValue } from '../rules/catalogue';
import { parseTiles } from './tiles';
import { emptyFlags, type HandContext, type HandEntry, type Meld, type MeldKind } from './types';

/** "pon 999s", "chi 123m", "minkan 9999s", "ankan 1111p" */
function meld(text: string): Meld {
  const [kind, tiles] = text.split(' ');
  return { kind: kind as MeldKind, tiles: parseTiles(tiles) };
}

export function hand(concealed: string, win: string | null, opts: {
  melds?: string[];
  flowers?: string;
  flags?: Partial<HandEntry['flags']>;
  flowerWin?: HandEntry['flowerWin'];
  custom?: string[];
} = {}): HandEntry {
  return {
    concealed: concealed ? parseTiles(concealed) : [],
    melds: (opts.melds ?? []).map(meld),
    winningTile: win,
    flowers: opts.flowers ? parseTiles(opts.flowers) : [],
    flags: { ...emptyFlags(), ...opts.flags },
    flowerWin: opts.flowerWin,
    customItems: opts.custom ?? [],
    source: 'manual',
  };
}

export function ctx(over: Partial<HandContext> = {}): HandContext {
  return { dealer: 0, roundWind: 0, streak: 0, dice: null, winner: 1, from: 'zimo', ...over };
}

export function rules(over: Record<string, RuleValue> = {}, custom: RuleSet['custom'] = []): RuleSet {
  const r = defaultRuleSet();
  return { ...r, values: { ...r.values, ...over }, custom };
}
