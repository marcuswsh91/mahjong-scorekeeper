import { useState } from 'react';
import { classifyDice } from '../engine/payments';
import { seatWindOf, type Seat } from '../engine/types';
import type { RuleSet } from '../rules/ruleset';
import { streakText, WIND, type HandRecord, type SessionState } from '../session/replay';
import { signed } from './bits';
import { parseDice } from './entryModel';
import type { WakeState } from './wakeLock';

function HandLog({ h, onEdit }: { h: HandRecord; onEdit: () => void }) {
  const r = h.before;
  const where = `${WIND[r.roundWind]}風${WIND[r.dealer]}`;
  const name = (s: number) => h.seats[s];
  let title = '';
  if (h.kind === 'draw') title = '流局 draw';
  else if (h.kind === 'falseWin') title = `詐胡 ${name(h.payments[0]?.from ?? 0)} (${h.falseWinTai} tai)`;
  else if (h.score?.legal) {
    const p = h.payments[0];
    title = `${name(p.to)} ${h.payments.length === 3 ? '自摸' : `off ${name(p.from)}`} · ${h.score.handTai} tai`;
  } else title = 'Win (not scored)';
  return (
    <details className="card">
      <summary><div className="spread" style={{ width: '100%' }}><span>#{h.no} {where} · {title}</span>{h.warnings.length > 0 && <span className="tag">check</span>}</div></summary>
      <p className="muted small">莊家 {name(r.dealer)}, {streakText(r.streak)}{h.dice ? ` · dice ${h.dice.join('-')}` : ''}</p>
      {h.warnings.map((w) => <p key={w} className="alert">{w}</p>)}
      {h.score?.legal && (
        <>
          <p className="small muted">{h.score.split}{h.score.waitTiles.length ? ` · winning tiles: ${h.score.waitTiles.join(' ')}` : ''}</p>
          <ul className="lines small">
            {h.score.lines.length === 0 && <li>No hand tai (base only)</li>}
            {h.score.lines.map((l, i) => <li key={i}>{l.zh} {l.en}: <b>{l.tai}</b>{l.detail ? ` (${l.detail})` : ''}</li>)}
          </ul>
        </>
      )}
      {h.payments.map((p, i) => (
        <p key={i} className="small"><b>{name(p.from)} → {name(p.to)}: {p.amount}</b> <span className="muted">({p.lines.join(' · ')})</span></p>
      ))}
      {h.kind === 'draw' && <p className="small">Nobody pays.</p>}
      <p className="small"><b>Next:</b> {h.nextText}</p>
      <button onClick={onEdit}>Edit this hand</button>
    </details>
  );
}

export function Scoreboard({ state, rules, diceText, onDice, onWin, onDraw, onFalseWin, onRedraw, onSettle, onHome, onEdit, onUndo, undoLabel, wake, saveError }: {
  state: SessionState; rules: RuleSet; diceText: string; onDice: (t: string) => void;
  onEdit: (h: HandRecord) => void; onUndo: () => void; undoLabel: string | null; wake: WakeState;
  onWin: () => void; onDraw: () => void; onFalseWin: () => void; onRedraw: () => void; onSettle: () => void; onHome: () => void; saveError: string | null;
}) {
  const [confirmDraw, setConfirmDraw] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const rot = state.next.rotation;
  const seats = state.seats!;
  const dice = parseDice(diceText);
  const bonus = dice ? classifyDice(dice, rules) : null;
  const last = state.hands[state.hands.length - 1];
  const needSeating = state.next.kind === 'needSeating';

  return (
    <>
      <div className="spread"><button className="link" onClick={onHome}>Home</button><button className="link" onClick={onSettle}>Settle up</button></div>
      {wake === 'unsupported' && <p className="muted small">This browser can't keep the screen awake here (it needs the installed or HTTPS version). Set Auto-Lock to Never for now.</p>}
      {wake === 'denied' && <p className="muted small">The browser didn't allow keeping the screen awake. The screen may lock; nothing is lost if it does.</p>}
      {saveError && <div className="alert">{saveError} Keep playing; the next save will try again.</div>}
      {state.seatingWarnings.map((w) => <div key={w} className="alert">{w}</div>)}
      <div className="banner">
        {needSeating ? <div className="big">將 over</div> : <div className="big">{WIND[rot.roundWind]}風{WIND[rot.dealer]}</div>}
        {!needSeating && <div>圈風 {WIND[rot.roundWind]} · 莊家 <b>{seats[rot.dealer]}</b> · {streakText(rot.streak)}</div>}
        {last && <div className="small" style={{ marginTop: 4 }}>{last.nextText}</div>}
      </div>

      <div className="players">
        {seats.map((name, i) => {
          const seat = i as Seat;
          return (
            <div key={name} className={`player${seat === rot.dealer && !needSeating ? ' dealer' : ''}`}>
              <div className="spread"><b>{name}</b><span className="muted">{WIND[i]}位 · 門風{WIND[seatWindOf(seat, rot.dealer)]}</span></div>
              <div className="total">{signed(state.totals[name] ?? 0)}</div>
            </div>
          );
        })}
      </div>

      {needSeating ? (
        <button className="big primary" style={{ marginTop: 12 }} onClick={onRedraw}>Redraw seats 重新抽位</button>
      ) : (
        <div className="card">
          <label className="stack" style={{ display: 'block' }}>
            <span>Dealer's dice 門骰 <span className="muted small">(three digits, any order)</span></span>
            <input inputMode="numeric" placeholder="e.g. 456" value={diceText} onChange={(e) => onDice(e.target.value)} />
          </label>
          <p className="small muted">{dice ? `${bonus!.label}${bonus!.tai ? `: +${bonus!.tai} tai to the winner` : bonus!.mult > 1 ? `: payout × ${bonus!.mult}` : ''}` : diceText ? 'Enter three dice, 1–6.' : 'No roll entered: no dice bonus.'}</p>
        </div>
      )}

      {confirmDraw && (
        <div className="card">
          <p>Record a 流局 (drawn hand)? Nobody pays; {seats[rot.dealer]} stays dealer.</p>
          <div className="row"><button className="primary" onClick={() => { setConfirmDraw(false); onDraw(); }}>Yes, 流局</button><button onClick={() => setConfirmDraw(false)}>Cancel</button></div>
        </div>
      )}

      <div className="spread"><h2>Hands</h2>{undoLabel && !confirmUndo && <button onClick={() => setConfirmUndo(true)}>↶ {undoLabel}</button>}</div>
      {confirmUndo && undoLabel && (
        <div className="card">
          <p>{undoLabel}? Totals and rotation are recalculated. The log keeps a record of the undo.</p>
          <div className="row"><button className="primary" onClick={() => { setConfirmUndo(false); onUndo(); }}>Yes, undo</button><button onClick={() => setConfirmUndo(false)}>Cancel</button></div>
        </div>
      )}
      {state.hands.length === 0 && <p className="muted">No hands yet.</p>}
      {[...state.hands].reverse().map((h) => <HandLog key={h.eventId} h={h} onEdit={() => onEdit(h)} />)}

      {!needSeating && (
        <div className="sticky"><div>
          <button className="primary" onClick={onWin}>胡 Win</button>
          <button onClick={() => setConfirmDraw(true)}>流局</button>
          <button onClick={onFalseWin}>詐胡</button>
        </div></div>
      )}
    </>
  );
}
