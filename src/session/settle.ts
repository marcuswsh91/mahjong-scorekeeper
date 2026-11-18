export interface Transfer { from: string; to: string; amount: number }

/**
 * Fewest transfers that settle the nets (which must sum to zero).
 * Exact for small groups: first pairs off equal-and-opposite nets
 * (each such pair saves a transfer), then settles the rest largest-first.
 */
export function settle(nets: Record<string, number>): Transfer[] {
  const sum = Object.values(nets).reduce((a, b) => a + b, 0);
  if (sum !== 0) throw new Error(`Nets don't sum to zero (${sum}).`);
  const bal = Object.entries(nets).filter(([, v]) => v !== 0).map(([name, v]) => ({ name, v }));
  const out: Transfer[] = [];

  for (const a of bal) {
    if (a.v >= 0) continue;
    const b = bal.find((x) => x.v === -a.v);
    if (b) { out.push({ from: a.name, to: b.name, amount: b.v }); a.v = 0; b.v = 0; }
  }
  for (;;) {
    const debtors = bal.filter((x) => x.v < 0).sort((x, y) => x.v - y.v);
    const creditors = bal.filter((x) => x.v > 0).sort((x, y) => y.v - x.v);
    if (!debtors.length) break;
    const d = debtors[0], c = creditors[0];
    const amount = Math.min(-d.v, c.v);
    out.push({ from: d.name, to: c.name, amount });
    d.v += amount;
    c.v -= amount;
  }
  return out;
}
