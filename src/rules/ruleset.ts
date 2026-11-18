import { CATALOGUE, CATALOGUE_BY_ID, type RuleValue } from './catalogue';

/** A scorekeeper-added item. The engine can't detect it; it is tapped on at hand entry. */
export interface CustomItem {
  id: string;
  name: string;
  tai: number;
  condition: string;
}

export interface RuleSet {
  schema: 1;
  values: Record<string, RuleValue>;
  custom: CustomItem[];
}

/** A confirmed rule set, frozen and attached to a session. */
export interface RuleSnapshot {
  version: string; // content hash
  confirmedAt: string; // ISO time
  rules: RuleSet;
}

export function defaultRuleSet(): RuleSet {
  const values: Record<string, RuleValue> = {};
  for (const item of CATALOGUE) values[item.id] = item.default;
  return { schema: 1, values, custom: [] };
}

function raw(rules: RuleSet, id: string): RuleValue {
  if (!CATALOGUE_BY_ID.has(id)) throw new Error(`Unknown rule "${id}"`);
  return id in rules.values ? rules.values[id] : CATALOGUE_BY_ID.get(id)!.default;
}
export function num(rules: RuleSet, id: string): number {
  const v = raw(rules, id);
  return typeof v === 'number' ? v : 0;
}
export function yes(rules: RuleSet, id: string): boolean {
  return raw(rules, id) === true;
}
export function choice(rules: RuleSet, id: string): string | null {
  const v = raw(rules, id);
  return typeof v === 'string' ? v : null;
}

/** Problems that stop a rule set being confirmed. Empty = OK. */
export function validateRuleSet(rules: RuleSet): string[] {
  const errors: string[] = [];
  for (const item of CATALOGUE) {
    const v = raw(rules, item.id);
    if (v === null) errors.push(`${item.zh} (${item.en}) needs an answer.`);
    else if ((item.kind === 'tai' || item.kind === 'number') && (typeof v !== 'number' || v < 0 || !Number.isInteger(v)))
      errors.push(`${item.zh} must be a whole number ≥ 0.`);
    else if (item.kind === 'number' && typeof v === 'number' && v < item.min)
      errors.push(`${item.zh} must be at least ${item.min}.`);
  }
  if (choice(rules, 'falseWinMode') === 'fixed' && num(rules, 'falseWinFixedTai') === 0)
    errors.push('詐胡 uses a fixed amount, so the fixed tai can\'t be Off.');
  for (const c of rules.custom) {
    if (!c.name.trim()) errors.push('A custom item needs a name.');
    if (!Number.isInteger(c.tai) || c.tai < 0) errors.push(`Custom item "${c.name}" needs whole-number tai ≥ 0.`);
  }
  return errors;
}

/** Stable JSON (sorted keys) so equal rule sets hash equally. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

/** FNV-1a 32-bit hash of the rule set, as 8 hex chars. */
export function hashRuleSet(rules: RuleSet): string {
  let h = 0x811c9dc5;
  for (const ch of stable(rules)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function snapshot(rules: RuleSet, now = new Date()): RuleSnapshot {
  const copy: RuleSet = JSON.parse(JSON.stringify(rules));
  return { version: hashRuleSet(copy), confirmedAt: now.toISOString(), rules: Object.freeze(copy) };
}
