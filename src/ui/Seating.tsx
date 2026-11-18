import { useState } from 'react';
import { seatingProblem } from '../session/rotation';
import { WIND } from '../session/replay';

/** Enter the seat draw. Tap a known name to fill the next empty seat. */
export function Seating({ previous, known, redraw, onConfirm, onCancel }: { previous: readonly string[] | null; known: string[]; redraw: boolean; onConfirm: (seats: [string, string, string, string]) => void; onCancel?: () => void }) {
  const [seats, setSeats] = useState<string[]>(redraw ? ['', '', '', ''] : [...(previous ?? ['', '', '', ''])]);
  const problem = seatingProblem(redraw ? previous : null, seats);
  const fillNext = (name: string) => {
    const i = seats.findIndex((s) => !s.trim());
    if (i >= 0 && !seats.includes(name)) setSeats(seats.map((s, k) => (k === i ? name : s)));
  };
  return (
    <>
      {onCancel && <button className="link" onClick={onCancel}>Back</button>}
      <h1>{redraw ? 'Redraw seats 重新抽位' : 'Seating 座位'}</h1>
      <p className="muted">Enter the seat draw. 東 deals first; turn order is 東 → 南 → 西 → 北 (counterclockwise).</p>
      {known.length > 0 && (
        <div className="card">
          <p className="small muted">Tap names in seat order:</p>
          <div className="row">
            {known.map((n) => <button key={n} disabled={seats.includes(n)} onClick={() => fillNext(n)}>{n}</button>)}
            <button className="link" onClick={() => setSeats(['', '', '', ''])}>Clear</button>
          </div>
        </div>
      )}
      <div className="card stack">
        {seats.map((s, i) => (
          <label key={i} className="row" style={{ flexWrap: 'nowrap' }}>
            <b style={{ width: 28, fontSize: 20 }}>{WIND[i]}</b>
            <input type="text" value={s} placeholder={`Player in the ${WIND[i]} seat`} onChange={(e) => setSeats(seats.map((x, k) => (k === i ? e.target.value : x)))} />
          </label>
        ))}
      </div>
      {problem && seats.every((s) => s.trim()) && <div className="alert">{problem}</div>}
      <div className="sticky"><div>
        <button className="primary" disabled={!!problem} onClick={() => onConfirm(seats.map((s) => s.trim()) as [string, string, string, string])}>Start 東風東</button>
      </div></div>
    </>
  );
}
