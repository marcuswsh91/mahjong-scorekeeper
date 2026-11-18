import { describe, expect, it } from 'vitest';
import { CATALOGUE, CATALOGUE_BY_ID, RECOMMENDED } from './catalogue';
import { blankRuleSet, validateRuleSet } from './ruleset';

describe('recommended values', () => {
  it('every recommended id exists and has the right type for its item', () => {
    for (const [id, v] of Object.entries(RECOMMENDED)) {
      const item = CATALOGUE_BY_ID.get(id);
      expect(item, id).toBeDefined();
      if (item!.kind === 'yesno') expect(typeof v, id).toBe('boolean');
      else expect(typeof v, id).toBe('number');
    }
  });
});

describe('blank rule set', () => {
  it('needs an answer for every catalogue item before it can be confirmed', () => {
    expect(validateRuleSet(blankRuleSet()).length).toBe(CATALOGUE.length);
  });
  it('keeps custom items', () => {
    expect(blankRuleSet([{ id: 'c1', name: 'x', tai: 1, condition: '' }]).custom.length).toBe(1);
  });
});
