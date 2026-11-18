import type { ReactNode } from 'react';
import { suitOf, tileName } from '../engine/tiles';

export function Stepper({ value, min = 0, max = 99, offAtZero, onChange }: { value: number; min?: number; max?: number; offAtZero?: boolean; onChange: (v: number) => void }) {
  return (
    <span className="stepper">
      <button aria-label="less" disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <span className="val">{offAtZero && value === 0 ? 'Off' : value}</span>
      <button aria-label="more" disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}

export function Seg<T extends string | number | boolean>({ options, value, onChange }: { options: { value: T; label: ReactNode }[]; value: T | null | undefined; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.value)} className={o.value === value ? 'on' : ''} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/** A tile as a button: "5" over "萬", or "東", "春". */
export function Tile({ code, onClick, title }: { code: string; onClick?: () => void; title?: string }) {
  const name = tileName(code);
  const cls = code.startsWith('f') ? 'f' : suitOf(code);
  return (
    <button className={`tile ${cls}`} onClick={onClick} title={title ?? code} aria-label={name}>
      {name.length === 2 && cls !== 'f' ? <>{name[0]}<small>{name[1]}</small></> : name}
    </button>
  );
}

export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
