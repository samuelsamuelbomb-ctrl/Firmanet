import { Signal } from "./swish-mock";

export interface SignalCluster {
  id: string;
  signals: Signal[];
  primary: Signal;
  location: string;
  totalReports: number;
  avgTrust: number;
  minutesAgo: number;
}

function keyFor(s: Signal): string {
  // Cluster by location + type family (incident+update treated together)
  const family = s.type === "update" || s.type === "incident" ? "incident" : s.type;
  return `${s.location.toLowerCase()}::${family}`;
}

export function clusterSignals(signals: Signal[]): Array<Signal | SignalCluster> {
  const groups = new Map<string, Signal[]>();
  for (const s of signals) {
    const k = keyFor(s);
    const arr = groups.get(k) ?? [];
    arr.push(s);
    groups.set(k, arr);
  }

  const result: Array<Signal | SignalCluster> = [];
  // Preserve original order using first-occurrence position
  const seen = new Set<string>();
  for (const s of signals) {
    const k = keyFor(s);
    if (seen.has(k)) continue;
    seen.add(k);
    const items = groups.get(k)!;
    if (items.length < 2) {
      result.push(items[0]);
      continue;
    }
    const primary = [...items].sort((a, b) => b.trust - a.trust)[0];
    result.push({
      id: `c-${k}`,
      signals: items,
      primary,
      location: primary.location,
      totalReports: items.reduce((n, x) => n + x.reports, 0),
      avgTrust: Math.round(items.reduce((n, x) => n + x.trust, 0) / items.length),
      minutesAgo: Math.min(...items.map((x) => x.minutesAgo)),
    });
  }
  return result;
}

export function isCluster(x: Signal | SignalCluster): x is SignalCluster {
  return (x as SignalCluster).signals !== undefined;
}
