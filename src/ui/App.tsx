import { useEffect, useMemo, useState } from 'react';
import type { HandEntry, Seat } from '../engine/types';
import { blankRuleSet, snapshot, type RuleSet } from '../rules/ruleset';
import { effectiveEvents, newId, type HandEvent, type SessionEvent } from '../session/events';
import { replay, type Session } from '../session/replay';
import {
  appendEvent, browserStorage, listSessions, loadCurrentId, loadDraft, loadLastRules, loadSession,
  saveCurrentId, saveDraft, saveLastRules, saveSession,
} from '../storage/store';
import { EditHand } from './EditHand';
import { emptyDraft, parseDice } from './entryModel';
import { FalseWin } from './FalseWin';
import { Home } from './Home';
import { Interview } from './Interview';
import { Scoreboard } from './Scoreboard';
import { Seating } from './Seating';
import { Settlement } from './Settlement';
import { useWakeLock } from './wakeLock';
import { WinEntry, type PendingWin } from './WinEntry';

const { kv, persistent } = browserStorage();
type Screen = 'home' | 'interview' | 'seating' | 'board' | 'win' | 'falseWin' | 'settle' | 'edit';
interface Pending { diceText: string; win: PendingWin | null }
const NO_PENDING: Pending = { diceText: '', win: null };

/** Reopen where the scorekeeper was: a refresh, lock screen or closed tab loses nothing. */
function restore(): { session: Session | null; pending: Pending; screen: Screen } {
  const id = loadCurrentId(kv);
  const session = id ? loadSession(kv, id) : null;
  if (!session) return { session: null, pending: NO_PENDING, screen: 'home' };
  const pending = loadDraft<Pending>(kv, session.id) ?? NO_PENDING;
  const st = replay(session);
  const screen: Screen = !st.seats ? 'seating' : pending.win && st.next.kind === 'play' ? 'win' : 'board';
  return { session, pending, screen };
}

export function App() {
  return (
    <>
      {!persistent && <div className="banner-warn">This browser isn't saving: scores will be lost if the page reloads. Leave private browsing, or allow site data.</div>}
      <Screens />
    </>
  );
}

function Screens() {
  const [boot] = useState(restore);
  const [session, setSession] = useState<Session | null>(boot.session);
  const [screen, setScreen] = useState<Screen>(boot.screen);
  const [pending, setPendingState] = useState<Pending>(boot.pending);
  const [interview, setInterview] = useState<{ start: RuleSet; atReadBack: boolean } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [imported, setImported] = useState(0); // bumps after a backup import so lists reload
  const state = useMemo(() => (session ? replay(session) : null), [session]);
  const wake = useWakeLock(!!session && screen !== 'home' && screen !== 'interview');

  useEffect(() => { window.scrollTo(0, 0); }, [screen]);

  const setPending = (p: Pending) => {
    setPendingState(p);
    if (session) saveDraft(kv, session.id, p);
  };
  const commit = (make: (id: string, at: string) => SessionEvent) => {
    if (!session) return;
    const { session: s, saved } = appendEvent(kv, session, make(newId(), new Date().toISOString()));
    setSession(s);
    setSaveError(saved.ok ? null : saved.error);
  };
  const dice = parseDice(pending.diceText);
  const endHand = () => { setPending(NO_PENDING); setScreen('board'); };

  // Known names: this session's players, else the most recent session's.
  const pastSessions = useMemo(() => listSessions(kv).map((x) => loadSession(kv, x.id)).filter((s): s is Session => !!s).reverse(), [session, screen, imported]);
  const known = useMemo(() => {
    for (const s of session ? [session, ...pastSessions] : pastSessions) {
      const seats = replay(s).seats;
      if (seats) return [...seats];
    }
    return [];
  }, [session, pastSessions]);

  const startInterview = (atReadBack: boolean) => {
    const last = loadLastRules(kv);
    // "Same as last time" starts filled; a full interview starts blank and needs every answer.
    setInterview({ start: atReadBack && last ? last : blankRuleSet(last?.custom), atReadBack });
    setScreen('interview');
  };
  const openSession = (s: Session | null) => {
    setSession(s);
    saveCurrentId(kv, s?.id ?? null);
    if (!s) { setScreen('home'); return; }
    setPendingState(loadDraft<Pending>(kv, s.id) ?? NO_PENDING);
    setScreen(replay(s).seats ? 'board' : 'seating');
  };

  if (screen === 'interview' && interview) {
    return <Interview start={interview.start} last={loadLastRules(kv)} atReadBack={interview.atReadBack}
      onCancel={() => setScreen(session ? 'board' : 'home')}
      onConfirm={(rules) => {
        const s: Session = { schema: 1, id: newId(), createdAt: new Date().toISOString(), snapshot: snapshot(rules), events: [] };
        const saved = saveSession(kv, s);
        saveLastRules(kv, rules);
        setSaveError(saved.ok ? null : saved.error);
        openSession(s);
      }} />;
  }

  if (!session || !state || screen === 'home') {
    return <Home kv={kv} onImported={() => setImported((n) => n + 1)} hasLast={!!loadLastRules(kv)} onSame={() => startInterview(true)} onNew={() => startInterview(false)}
      onOpen={(id) => openSession(loadSession(kv, id))}
      sessions={pastSessions.map((s) => { const st = replay(s); return { session: s, hands: st.hands.length, players: st.seats?.join(', ') ?? '' }; })} />;
  }

  const rules = session.snapshot.rules;
  const rotation = state.next.rotation;

  if (screen === 'seating' || !state.seats) {
    const redraw = !!state.seats;
    return <Seating previous={state.seats} known={known} redraw={redraw} onCancel={redraw ? () => setScreen('board') : () => openSession(null)}
      onConfirm={(seats) => { commit((id, at) => ({ type: 'seating', id, at, seats })); setScreen('board'); }} />;
  }

  if (screen === 'win' && pending.win) {
    return <WinEntry seats={state.seats} rules={rules} rotation={rotation} dice={dice} value={pending.win}
      onChange={(win) => setPending({ ...pending, win })}
      onCancel={() => { setPending({ ...pending, win: null }); setScreen('board'); }}
      onSaveAsDraw={() => { commit((id, at) => ({ type: 'draw', id, at, dice })); endHand(); }}
      onSave={(winner: Seat, from: 'zimo' | Seat, entry: HandEntry) => { commit((id, at) => ({ type: 'win', id, at, dice, winner, from, entry })); endHand(); }} />;
  }

  if (screen === 'falseWin') {
    return <FalseWin seats={state.seats} rules={rules} rotation={rotation} dice={dice} onCancel={() => setScreen('board')}
      onSave={(offender, announcedTai) => { commit((id, at) => ({ type: 'falseWin', id, at, dice, offender, announcedTai })); endHand(); }} />;
  }

  if (screen === 'settle') {
    return <Settlement state={state} onBack={() => setScreen('board')} onFinish={() => openSession(null)} />;
  }

  if (screen === 'edit' && editing) {
    const original = effectiveEvents(session.events).find((e) => e.id === editing) as HandEvent | undefined;
    const record = state.hands.find((h) => h.eventId === editing);
    if (original && record) {
      return <EditHand key={editing} record={record} original={original} rules={rules}
        onCancel={() => { setEditing(null); setScreen('board'); }}
        onSave={(replacement) => { commit((id, at) => ({ type: 'amend', id, at, target: editing, replacement })); setEditing(null); setScreen('board'); }} />;
    }
  }

  // Undo removes the last hand, or a seat redraw (never the session's first seating).
  const eff = effectiveEvents(session.events);
  const lastEvent = eff[eff.length - 1];
  const undoLabel = !lastEvent ? null
    : lastEvent.type === 'seating' ? (eff.filter((e) => e.type === 'seating').length > 1 ? 'Undo seat redraw' : null)
      : `Undo hand #${state.hands.length}`;

  return <Scoreboard state={state} rules={rules} diceText={pending.diceText} saveError={saveError} wake={wake}
    undoLabel={undoLabel} onUndo={() => lastEvent && commit((id, at) => ({ type: 'undo', id, at, target: lastEvent.id }))}
    onEdit={(h) => { setEditing(h.eventId); setScreen('edit'); }}
    onDice={(diceText) => setPending({ ...pending, diceText })}
    onWin={() => { if (!pending.win) setPending({ ...pending, win: { winner: null, from: null, draft: emptyDraft() } }); setScreen('win'); }}
    onDraw={() => { commit((id, at) => ({ type: 'draw', id, at, dice })); endHand(); }}
    onFalseWin={() => setScreen('falseWin')}
    onRedraw={() => setScreen('seating')}
    onSettle={() => setScreen('settle')}
    onHome={() => { saveCurrentId(kv, null); setScreen('home'); }} />;
}
