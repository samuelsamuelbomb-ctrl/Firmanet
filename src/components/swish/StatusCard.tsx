import { ShieldCheck, AlertTriangle, Siren } from "lucide-react";
import type { Signal, Intensity } from "@/lib/swish-mock";

function computeIntensity(signals: Signal[]): Intensity {
  let top: Intensity = "calm";
  for (const s of signals) {
    if (s.trust >= 80) top = "danger";
    else if (s.trust >= 60 && top !== "danger") top = "warn";
  }
  return top;
}

function topSignal(signals: Signal[]): Signal | undefined {
  if (signals.length === 0) return undefined;
  return signals.reduce((a, b) => (a.trust > b.trust ? a : b));
}

function formatMinutes(minutes: number): string {
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  return h === 1 ? "1 hour ago" : `${h} hours ago`;
}

export function StatusCard({ signals }: { signals: Signal[] }) {
  const intensity = computeIntensity(signals);
  const top = topSignal(signals);

  if (intensity === "calm" || !top) {
    return (
      <div className="w-full rounded-[28px] bg-gradient-to-br from-mint/60 via-surface to-surface p-5 text-left shadow-pop">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-2.5 py-1 text-[11px] font-semibold text-mint-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Area Status: Safe
          </span>
        </div>
        <h2 className="mt-4 font-display text-[26px] font-semibold leading-tight">
          All clear around you
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {signals.length > 0
            ? `${signals.length} signal${signals.length === 1 ? "" : "s"} in your area`
            : "No active incidents nearby"}
        </p>
        {signals.length > 0 && (
          <p className="mt-3 text-xs font-medium text-foreground/70">
            Latest {formatMinutes(Math.min(...signals.map((s) => s.minutesAgo)))}
          </p>
        )}
      </div>
    );
  }

  if (intensity === "warn") {
    return (
      <div className="w-full rounded-[28px] bg-gradient-to-br from-warn/40 via-surface to-surface p-5 text-left shadow-pop">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/70 px-2.5 py-1 text-[11px] font-semibold text-warn-foreground">
            <AlertTriangle className="h-3.5 w-3.5" />
            Suspicious Activity Nearby
          </span>
        </div>
        <h2 className="mt-4 font-display text-[26px] font-semibold leading-tight">
          {top?.title ?? "Activity reported nearby"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {top?.distanceKm.toFixed(1) ?? "Nearby"} km · Confidence {top?.trust ?? 0}% · {top?.reports ?? 0} reports
        </p>
        {top && (
          <p className="mt-3 text-xs font-medium text-foreground/70">
            {top.location} · {formatMinutes(top.minutesAgo)}
          </p>
        )}
      </div>
    );
  }

  // danger
  return (
    <div className="w-full rounded-[28px] bg-gradient-to-br from-danger/15 via-surface to-surface p-5 text-left shadow-pop ring-1 ring-danger/30">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-danger px-2.5 py-1 text-[11px] font-semibold text-danger-foreground">
          <Siren className="h-3.5 w-3.5" />
          Active Threat Nearby
        </span>
      </div>
      <h2 className="mt-4 font-display text-[26px] font-semibold leading-tight">
        {top?.title ?? "Threat reported nearby"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {top?.distanceKm.toFixed(1) ?? "Nearby"} km · Confidence {top?.trust ?? 0}%
      </p>
      {top && (
        <p className="mt-3 text-xs font-medium text-foreground/70">
          {top.reports} report{top.reports === 1 ? "" : "s"} in last {formatMinutes(top.minutesAgo)} · {top.location}
        </p>
      )}
    </div>
  );
}