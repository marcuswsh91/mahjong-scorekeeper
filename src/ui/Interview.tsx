import { useState } from 'react';
import { CATALOGUE, GROUP_ORDER, type CatalogueItem, type RuleValue } from '../rules/catalogue';
import { validateRuleSet, type CustomItem, type RuleSet } from '../rules/ruleset';
import { Seg, Stepper } from './bits';
import { workedExamples } from './readback';

export function formatValue(item: CatalogueItem, v: RuleValue): string {
  if (v === null || v === undefined) return '—';
  if (item.kind === 'tai' || item.id === 'taiCap') return v === 0 ? 'Off' : `${v}`;
  if (item.kind === 'yesno') return v ? 'Yes' : 'No';
  if (item.kind === 'choice') return item.options.find((o) => o.value === v)?.label ?? String(v);
  return `${v}`;
}

function ItemRow({ item, value, last, onChange }: { item: CatalogueItem; value: RuleValue; last: RuleValue | undefined; onChange: (v: RuleValue) => void }) {
  const changed = last !== undefined && last !== value;
  return (
    <div className={`item${changed ? ' changed' : ''}`}>
      <div className="spread">
        <div><span className="zh">{item.zh}</span> <span className="muted">{item.en}</span></div>
      </div>
      <p className="small">{item.condition}</p>
      {item.note && <p className="note">{item.note}</p>}
      <p className="muted small">
        {item.default === null ? 'No common standard: you choose' : `Common: ${formatValue(item, item.default)}`}
        {item.source.startsWith('CC') && <> · <span className="tag">not from your brief</span></>}
        {changed && <> · Last time: <b>{formatValue(item, last)}</b></>}
      </p>
      <div style={{ marginTop: 6 }}>
        {item.kind === 'tai' && <Stepper value={Number(value ?? 0)} max={item.max} offAtZero onChange={onChange} />}
        {item.kind === 'number' && <Stepper value={Number(value ?? item.min)} min={item.min} max={item.max} offAtZero={item.id === 'taiCap'} onChange={onChange} />}
        {item.kind === 'yesno' && <Seg options={[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]} value={value as boolean | null} onChange={onChange} />}
        {item.kind === 'choice' && <Seg options={item.options.map((o) => ({ value: o.value, label: o.label }))} value={value as string | null} onChange={onChange} />}
      </div>
    </div>
  );
}

function CustomItems({ items, onChange }: { items: CustomItem[]; onChange: (c: CustomItem[]) => void }) {
  const set = (i: number, patch: Partial<CustomItem>) => onChange(items.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  return (
    <div className="card">
      <h3>Custom items 自訂</h3>
      <p className="muted small">The app can't detect these; you tap them on when entering a hand.</p>
      {items.map((c, i) => (
        <div key={c.id} className="item stack">
          <input type="text" placeholder="Name, e.g. 絕張" value={c.name} onChange={(e) => set(i, { name: e.target.value })} />
          <input type="text" placeholder="One-line condition" value={c.condition} onChange={(e) => set(i, { condition: e.target.value })} />
          <div className="spread">
            <Stepper value={c.tai} onChange={(tai) => set(i, { tai })} />
            <button onClick={() => onChange(items.filter((_, k) => k !== i))}>Remove</button>
          </div>
        </div>
      ))}
      <button onClick={() => onChange([...items, { id: `c${Date.now().toString(36)}`, name: '', tai: 1, condition: '' }])}>+ Add custom item</button>
    </div>
  );
}

function ReadBack({ rules, onJump }: { rules: RuleSet; onJump: (group: number) => void }) {
  const errors = validateRuleSet(rules);
  const examples = errors.length ? [] : workedExamples(rules);
  return (
    <>
      {errors.map((e) => {
        const item = CATALOGUE.find((i) => e.startsWith(i.zh));
        const g = item ? GROUP_ORDER.findIndex((x) => x.id === item.group) : -1;
        return <div key={e} className="alert spread">{e}{g >= 0 && <button className="link" onClick={() => onJump(g)}>Fix</button>}</div>;
      })}
      {examples.map((ex) => (
        <div key={ex.title} className="card">
          <h3>{ex.title}</h3>
          <p className="muted small">{ex.hand}</p>
          {ex.error ? <p className="alert">{ex.error}</p> : (
            <>
              <p className="small">Hand tai: {ex.taiLines.join(', ')}</p>
              <ul className="lines small">
                {ex.payments.map((p) => <li key={p.payer}><b>{p.payer} pays {p.amount}</b> <span className="muted">({p.working})</span></li>)}
              </ul>
            </>
          )}
        </div>
      ))}
      <div className="card">
        <h3>Every value</h3>
        {GROUP_ORDER.map((g, gi) => (
          <p key={g.id} className="small">
            <button className="link" onClick={() => onJump(gi)}>{g.zh}</button>{' '}
            {CATALOGUE.filter((i) => i.group === g.id).map((i) => `${i.zh} ${formatValue(i, rules.values[i.id])}`).join(' · ')}
          </p>
        ))}
        {rules.custom.length > 0 && <p className="small">自訂 {rules.custom.map((c) => `${c.name} ${c.tai}`).join(' · ')}</p>}
      </div>
    </>
  );
}

/** Group-by-group interview, then a read-back. Step GROUP_ORDER.length is the read-back. */
export function Interview({ start, last, atReadBack, onConfirm, onCancel }: { start: RuleSet; last: RuleSet | null; atReadBack: boolean; onConfirm: (r: RuleSet) => void; onCancel: () => void }) {
  const [rules, setRules] = useState<RuleSet>(start);
  const [step, setStep] = useState(atReadBack ? GROUP_ORDER.length : 0);
  const readBack = step === GROUP_ORDER.length;
  const group = GROUP_ORDER[step];
  const set = (id: string, v: RuleValue) => setRules((r) => ({ ...r, values: { ...r.values, [id]: v } }));
  const go = (s: number) => { setStep(s); window.scrollTo(0, 0); };
  const valid = validateRuleSet(rules).length === 0;

  return (
    <>
      <div className="spread">
        <button className="link" onClick={onCancel}>Cancel</button>
        <span className="muted small">{readBack ? 'Read-back' : `${step + 1} / ${GROUP_ORDER.length}`}</span>
      </div>
      <h1>{readBack ? 'Read-back 確認' : `${group.zh} ${group.en}`}</h1>
      {step === 0 && last && <button className="big" onClick={() => { setRules(last); go(GROUP_ORDER.length); }}>Same as last time → read-back</button>}
      {readBack ? <ReadBack rules={rules} onJump={go} /> : (
        <>
          <div className="card">
            {CATALOGUE.filter((i) => i.group === group.id).map((item) => (
              <ItemRow key={item.id} item={item} value={rules.values[item.id]} last={last?.values[item.id]} onChange={(v) => set(item.id, v)} />
            ))}
          </div>
          {group.id === 'regional' && <CustomItems items={rules.custom} onChange={(custom) => setRules((r) => ({ ...r, custom }))} />}
        </>
      )}
      <div className="sticky"><div>
        {step > 0 && <button onClick={() => go(step - 1)}>Back</button>}
        {readBack
          ? <button className="primary" disabled={!valid} onClick={() => onConfirm(rules)}>Confirm rules → seating</button>
          : <button className="primary" onClick={() => go(step + 1)}>Next</button>}
      </div></div>
    </>
  );
}
