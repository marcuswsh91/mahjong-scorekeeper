import { useState, type ReactNode } from 'react';
import { scoreHand } from '../engine/score';
import { ALL_FLOWERS, ALL_TILES } from '../engine/tiles';
import type { HandContext, HandEntry, MeldKind, ReadyKind, Seat } from '../engine/types';
import { num, type RuleSet } from '../rules/ruleset';
import type { Dice } from '../session/events';
import type { RotationState } from '../session/rotation';
import { Seg, Tile } from './bits';
import { addTile, concealedTarget, removeConcealed, removeMeld, toEntry, type Draft, type Row } from './entryModel';

export interface PendingWin { winner: Seat | null; from: 'zimo' | Seat | null; draft: Draft }

const MELD_LABEL: Record<MeldKind, string> = { chi: '吃', pon: '碰', minkan: '明槓', ankan: '暗槓' };
const SUITS = ['m', 'p', 's', 'z'];

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return <button className={on ? 'on' : ''} aria-pressed={on} onClick={() => onChange(!on)}>{label}</button>;
}

export function WinEntry({ seats, rules, rotation, dice, value, onChange, onSave, onSaveAsDraw, onCancel, title = 'Record a win 胡', top }: {
  seats: readonly string[]; rules: RuleSet; rotation: RotationState; dice: Dice;
  value: PendingWin; onChange: (p: PendingWin) => void;
  onSave: (winner: Seat, from: 'zimo' | Seat, entry: HandEntry) => void; onSaveAsDraw?: () => void; onCancel: () => void;
  title?: string; top?: ReactNode;
}) {
  const [row, setRow] = useState<Row>(value.draft.concealed.length >= concealedTarget(value.draft) ? 'winning' : 'concealed');
  const [error, setError] = useState<string | null>(null);
  const [pickWho, setPickWho] = useState(false);
  const { winner, from, draft } = value;
  const setDraft = (d: Draft) => onChange({ ...value, draft: d });
  const flags = draft.flags;
  const setFlag = <K extends keyof HandEntry['flags']>(k: K, v: HandEntry['flags'][K]) => setDraft({ ...draft, flags: { ...flags, [k]: v } });

  const tap = (tile: string) => {
    const r = addTile(draft, row, tile);
    if (!r.draft) { setError(r.error ?? null); return; }
    setError(null);
    setDraft(r.draft);
    if (row === 'concealed' && r.draft.concealed.length >= concealedTarget(r.draft)) setRow('winning');
  };

  const entry = toEntry(draft);
  const ctx: HandContext | null = winner === null || from === null ? null
    : { dealer: rotation.dealer, roundWind: rotation.roundWind, streak: rotation.streak, dice, winner, from };
  const result = ctx ? scoreHand(entry, ctx, rules) : null;
  const target = concealedTarget(draft);

  const rowBox = (r: Row, label: string, children: ReactNode) => (
    <div className="stack" style={{ marginTop: 10 }}>
      <button className="link" onClick={() => setRow(r)} style={{ textDecoration: 'none' }}><b>{label}</b></button>
      <div className={`handrow${row === r ? ' active' : ''}`} onClick={() => row !== r && setRow(r)}>{children}</div>
    </div>
  );

  return (
    <>
      <button className="link" onClick={onCancel}>Cancel</button>
      <h1>{title}</h1>
      {top}

      {winner !== null && from !== null && !pickWho ? (
        <div className="card spread">
          <span><b>{seats[winner]}</b> {from === 'zimo' ? '自摸 self-draw' : `off ${seats[from]}'s discard`}{dice ? ` · dice ${dice.join('-')}` : ''}</span>
          <button onClick={() => setPickWho(true)}>Change</button>
        </div>
      ) : (
        <div className="card stack">
          <b>Who won?</b>
          <Seg options={seats.map((n, i) => ({ value: i as Seat, label: n }))} value={winner}
            onChange={(w) => onChange({ ...value, winner: w, from: from === w ? null : from })} />
          <b>How?</b>
          <Seg options={[{ value: 'zimo' as const, label: '自摸 self-draw' }, ...seats.map((n, i) => ({ value: i as Seat, label: `${n} discarded` })).filter((o) => o.value !== winner)]}
            value={from} onChange={(f) => { onChange({ ...value, from: f }); if (winner !== null) setPickWho(false); }} />
          {dice && <p className="muted small">Dice {dice.join('-')} (from the scoreboard)</p>}
        </div>
      )}

      <div className="card">
        <Seg options={[{ value: '', label: 'Tile hand' }, { value: 'qiqiangyi', label: '七搶一' }, { value: 'baxian', label: '八仙過海' }]}
          value={draft.flowerWin ?? ''} onChange={(v) => setDraft({ ...draft, flowerWin: (v || undefined) as Draft['flowerWin'] })} />

        {/* Pinned to the top while scrolling, so the rows being filled stay in view just below it. */}
        <div className="gridpanel">
          <p className="small" style={{ margin: '0 0 4px' }}>
            Adding to: <b>{({ concealed: 'Concealed 手牌', winning: 'Winning tile 胡牌', chi: '吃 (tap the lowest tile)', pon: '碰', minkan: '明槓', ankan: '暗槓', flowers: 'Flowers 花' } as Record<Row, string>)[row]}</b>
          </p>
          {error && <div className="alert" style={{ margin: '0 0 4px' }}>{error}</div>}
          {row === 'flowers' ? (
            <div className="tiles" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {ALL_FLOWERS.map((f) => <Tile key={f} code={f} onClick={() => tap(f)} />)}
            </div>
          ) : !draft.flowerWin && (
            <div className="tiles">
              {SUITS.flatMap((s) => ALL_TILES.filter((t) => t[1] === s)).map((t) => <Tile key={t} code={t} onClick={() => tap(t)} />)}
            </div>
          )}
        </div>

        {!draft.flowerWin && rowBox('concealed', `Concealed 手牌 ${draft.concealed.length} / ${target} (tap a tile to remove)`,
          draft.concealed.map((t, i) => <Tile key={i} code={t} onClick={() => setDraft(removeConcealed(draft, i))} />))}
        {!draft.flowerWin && rowBox('winning', 'Winning tile 胡牌',
          draft.winning ? <Tile code={draft.winning} onClick={() => setDraft({ ...draft, winning: null })} /> : <span className="muted small">Tap the tile that won</span>)}
        {!draft.flowerWin && (
          <div className="stack" style={{ marginTop: 10 }}>
            <b>Exposed sets and concealed kongs</b>
            <Seg options={(['chi', 'pon', 'minkan', 'ankan'] as MeldKind[]).map((k) => ({ value: k, label: `+ ${MELD_LABEL[k]}` }))}
              value={row === 'chi' || row === 'pon' || row === 'minkan' || row === 'ankan' ? row : null} onChange={setRow} />
            {(row === 'chi') && <p className="muted small">吃: tap the lowest tile of the run.</p>}
            <div className="row">
              {draft.melds.length === 0 && <span className="muted small">None</span>}
              {draft.melds.map((m, i) => (
                <span key={i} className="meld" onClick={() => setDraft(removeMeld(draft, i))} title="Tap to remove">
                  <span className="small" style={{ alignSelf: 'center', padding: '0 2px' }}>{MELD_LABEL[m.kind]}</span>
                  {m.tiles.map((t, k) => <Tile key={k} code={t} />)}
                </span>
              ))}
            </div>
          </div>
        )}
        {rowBox('flowers', `Flowers 花 ${draft.flowers.length}`, draft.flowers.length ? draft.flowers.map((f) => <Tile key={f} code={f} onClick={() => setDraft({ ...draft, flowers: draft.flowers.filter((x) => x !== f) })} />) : <span className="muted small">None</span>)}

      </div>

      <div className="card stack">
        <b>Timing</b>
        <div className="seg">
          <Toggle on={flags.lastTile} label={from === 'zimo' ? '海底撈月 last tile' : '河底撈魚 last discard'} onChange={(v) => setFlag('lastTile', v)} />
          <Toggle on={flags.kongReplacement} label="槓上開花" onChange={(v) => setFlag('kongReplacement', v)} />
          <Toggle on={flags.robbedKong} label="搶槓" onChange={(v) => setFlag('robbedKong', v)} />
          <Toggle on={flags.firstDraw} label="First draw 天/地/人胡" onChange={(v) => setFlag('firstDraw', v)} />
        </div>
        <b>Declared ready</b>
        <Seg options={[{ value: 'none', label: 'No' }, { value: 'declared', label: '報聽' }, { value: 'early', label: '地聽' }, { value: 'dealt', label: '天聽' }]}
          value={flags.ready} onChange={(v) => setFlag('ready', v as ReadyKind)} />
        {num(rules, 'yifa') > 0 && <Toggle on={flags.yifa} label="一發 within one go-around" onChange={(v) => setFlag('yifa', v)} />}
        {rules.custom.length > 0 && <b>Custom items</b>}
        <div className="seg">
          {rules.custom.map((c) => (
            <Toggle key={c.id} on={draft.customItems.includes(c.id)} label={`${c.name} ${c.tai}`}
              onChange={(on) => setDraft({ ...draft, customItems: on ? [...draft.customItems, c.id] : draft.customItems.filter((x) => x !== c.id) })} />
          ))}
        </div>
      </div>

      <div className="card">
        {!result ? <p className="muted">Pick who won and how to see the score.</p>
          : !result.legal ? (
            <>
              <b>Not a legal win yet:</b>
              <ul className="lines small">{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              {onSaveAsDraw && <button onClick={onSaveAsDraw}>Can't fix it? Save as 流局 instead</button>}
            </>
          ) : (
            <>
              <div className="spread"><b>{result.handTai} tai</b><span className="muted small">{result.split}</span></div>
              <ul className="lines small">
                {result.lines.length === 0 && <li>No hand tai (base only)</li>}
                {result.lines.map((l, i) => <li key={i}>{l.zh} {l.en}: <b>{l.tai}</b>{l.detail ? ` (${l.detail})` : ''}</li>)}
              </ul>
              {result.payments.map((p, i) => <p key={i} className="small"><b>{seats[p.from]} pays {p.amount}</b> <span className="muted">({p.lines.join(' · ')})</span></p>)}
            </>
          )}
      </div>

      <div className="sticky"><div>
        <button onClick={onCancel}>Cancel</button>
        <button className="primary" disabled={!result?.legal} onClick={() => result?.legal && onSave(winner!, from!, entry)}>Save hand</button>
      </div></div>
    </>
  );
}
