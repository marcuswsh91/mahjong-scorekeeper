import { useState, type ReactNode } from 'react';
import { scoreFalseWin } from '../engine/score';
import type { Seat } from '../engine/types';
import { choice, type RuleSet } from '../rules/ruleset';
import type { Dice } from '../session/events';
import type { RotationState } from '../session/rotation';
import { Seg, Stepper } from './bits';

export function FalseWin({ seats, rules, rotation, dice, onSave, onCancel, title = 'False win 詐胡', top, initialOffender = null, initialTai = 0 }: {
  seats: readonly string[]; rules: RuleSet; rotation: RotationState; dice: Dice; onSave: (offender: Seat, tai: number) => void; onCancel: () => void;
  title?: string; top?: ReactNode; initialOffender?: Seat | null; initialTai?: number;
}) {
  const [offender, setOffender] = useState<Seat | null>(initialOffender);
  const [tai, setTai] = useState(initialTai);
  const announced = choice(rules, 'falseWinMode') === 'announced';
  const fw = offender === null ? null : scoreFalseWin(offender, { dealer: rotation.dealer, streak: rotation.streak, dice }, rules, tai);
  return (
    <>
      <button className="link" onClick={onCancel}>Cancel</button>
      <h1>{title}</h1>
      {top}
      <div className="card stack">
        <b>Who declared a false win?</b>
        <Seg options={seats.map((n, i) => ({ value: i as Seat, label: n }))} value={offender} onChange={setOffender} />
        {announced
          ? <><b>Tai they announced</b><Stepper value={tai} onChange={setTai} /></>
          : <p className="muted small">Your rules use a fixed amount.</p>}
      </div>
      {fw && (
        <div className="card">
          <b>{seats[offender!]} pays each other player ({fw.tai} tai)</b>
          {fw.payments.map((p, i) => <p key={i} className="small"><b>→ {seats[p.to]}: {p.amount}</b> <span className="muted">({p.lines.slice(1).join(' · ')})</span></p>)}
          <p className="muted small">Afterwards the dealer {choice(rules, 'falseWinDealerAfter') === 'passes' ? 'passes' : 'stays'}.</p>
        </div>
      )}
      <div className="sticky"><div>
        <button onClick={onCancel}>Cancel</button>
        <button className="primary" disabled={offender === null} onClick={() => onSave(offender!, tai)}>Save 詐胡</button>
      </div></div>
    </>
  );
}
