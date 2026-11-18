import type { Session } from '../session/replay';

export function Home({ sessions, hasLast, onSame, onNew, onOpen }: { sessions: { session: Session; hands: number; players: string }[]; hasLast: boolean; onSame: () => void; onNew: () => void; onOpen: (id: string) => void }) {
  return (
    <>
      <h1>台麻計分 Mahjong score keeper</h1>
      {hasLast && <button className="big primary" onClick={onSame}>New session · same rules as last time</button>}
      <button className="big" style={{ marginTop: 8 }} onClick={onNew}>{hasLast ? 'New session · go through the rules' : 'New session · set the house rules'}</button>
      {sessions.length > 0 && <h2>Sessions</h2>}
      {sessions.map(({ session, hands, players }) => (
        <button key={session.id} className="card" style={{ width: '100%', textAlign: 'left', height: 'auto', padding: 12 }} onClick={() => onOpen(session.id)}>
          <div className="spread"><b>{new Date(session.createdAt).toLocaleString()}</b><span className="muted small">{hands} hand{hands === 1 ? '' : 's'}</span></div>
          <div className="muted small">{players || 'No seating yet'} · rules v{session.snapshot.version}</div>
        </button>
      ))}
    </>
  );
}
