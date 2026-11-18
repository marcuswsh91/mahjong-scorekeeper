import { useState } from 'react';
import type { RuleSet } from '../rules/ruleset';
import type { HandEvent } from '../session/events';
import { WIND, type HandRecord } from '../session/replay';
import { Seg } from './bits';
import { emptyDraft, fromEntry, parseDice } from './entryModel';
import { FalseWin } from './FalseWin';
import { WinEntry, type PendingWin } from './WinEntry';

/**
 * Edit any past hand: same screens as entering it, pre-filled, scored against the
 * rotation as it stood before that hand. Saving appends an amend; everything after is recomputed.
 */
export function EditHand({ record, original, rules, onSave, onCancel }: {
  record: HandRecord; original: HandEvent; rules: RuleSet; onSave: (replacement: HandEvent) => void; onCancel: () => void;
}) {
  const [kind, setKind] = useState<HandEvent['type']>(original.type);
  const [diceText, setDiceText] = useState(original.dice ? original.dice.join('') : '');
  const [win, setWin] = useState<PendingWin>(original.type === 'win'
    ? { winner: original.winner, from: original.from, draft: fromEntry(original.entry) }
    : { winner: null, from: null, draft: emptyDraft() });
  const dice = parseDice(diceText);
  const base = { id: original.id, at: original.at, dice };
  const r = record.before;
  const title = `Edit hand #${record.no}`;

  const top = (
    <div className="card stack">
      <p className="small">{WIND[r.roundWind]}風{WIND[r.dealer]} · 莊家 {record.seats[r.dealer]}. Saving recalculates every hand after this one.</p>
      <Seg options={[{ value: 'win' as const, label: '胡 Win' }, { value: 'draw' as const, label: '流局' }, { value: 'falseWin' as const, label: '詐胡' }]} value={kind} onChange={setKind} />
      <label className="stack" style={{ display: 'block' }}>
        <span>Dealer's dice for that hand <span className="muted small">(blank = none)</span></span>
        <input inputMode="numeric" placeholder="e.g. 456" value={diceText} onChange={(e) => setDiceText(e.target.value)} />
      </label>
    </div>
  );

  if (kind === 'win') {
    return <WinEntry seats={record.seats} rules={rules} rotation={r} dice={dice} value={win} onChange={setWin} title={title} top={top}
      onCancel={onCancel} onSave={(winner, from, entry) => onSave({ ...base, type: 'win', winner, from, entry })} />;
  }
  if (kind === 'falseWin') {
    return <FalseWin seats={record.seats} rules={rules} rotation={r} dice={dice} title={title} top={top}
      initialOffender={original.type === 'falseWin' ? original.offender : null} initialTai={original.type === 'falseWin' ? original.announcedTai : 0}
      onCancel={onCancel} onSave={(offender, announcedTai) => onSave({ ...base, type: 'falseWin', offender, announcedTai })} />;
  }
  return (
    <>
      <button className="link" onClick={onCancel}>Cancel</button>
      <h1>{title}</h1>
      {top}
      <div className="card"><p>流局: nobody pays; {record.seats[r.dealer]} stays dealer.</p></div>
      <div className="sticky"><div>
        <button onClick={onCancel}>Cancel</button>
        <button className="primary" onClick={() => onSave({ ...base, type: 'draw' })}>Save 流局</button>
      </div></div>
    </>
  );
}
