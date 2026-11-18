import { settle } from '../session/settle';
import type { SessionState } from '../session/replay';
import { signed } from './bits';

export function Settlement({ state, onBack, onFinish }: { state: SessionState; onBack: () => void; onFinish: () => void }) {
  const nets = Object.entries(state.totals).sort((a, b) => b[1] - a[1]);
  const transfers = settle(state.totals);
  return (
    <>
      <button className="link" onClick={onBack}>Back to the game</button>
      <h1>Settle up 結算</h1>
      <div className="card">
        <h3>Net points after {state.hands.length} hand{state.hands.length === 1 ? '' : 's'}</h3>
        {nets.map(([name, v]) => <div key={name} className="spread"><span>{name}</span><b>{signed(v)}</b></div>)}
      </div>
      <div className="card">
        <h3>Who pays whom</h3>
        {transfers.length === 0 ? <p>All square: nobody pays.</p> : (
          <ul className="lines">{transfers.map((t, i) => <li key={i}><b>{t.from}</b> pays <b>{t.to}</b> {t.amount}</li>)}</ul>
        )}
        <p className="muted small">The fewest payments that settle everyone. Points only; the app doesn't handle money.</p>
      </div>
      <div className="sticky"><div><button className="primary" onClick={onFinish}>Finish session</button></div></div>
    </>
  );
}
