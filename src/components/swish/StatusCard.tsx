import { Intensity } from "@/lib/swish-mock";
import { ShieldCheck, AlertTriangle, Siren } from "lucide-react";

const VARIANTS: Record<
  Intensity,
  {
    bg: string;
    chip: string;
    Icon: typeof ShieldCheck;
    label: string;
    title: string;
    subtitle: string;
    extra?: string;
  }
> = {
  calm: {
    bg: "bg-gradient-to-br from-mint/60 via-surface to-surface",
    chip: "bg-mint text-mint-foreground",
    Icon: ShieldCheck,
    label: "Area Status: Safe",
    title: "All clear around you",
    subtitle: "No verified incidents nearby",
    extra: "Last update 4 min ago",
  },
  warn: {
    bg: "bg-gradient-to-br from-warn/40 via-surface to-surface",
    chip: "bg-warn/70 text-warn-foreground",
    Icon: AlertTriangle,
    label: "Suspicious Activity Nearby",
    title: "1.4 km away",
    subtitle: "Confidence 62% — multiple reports",
    extra: "Stay alert and avoid the area",
  },
  danger: {
    bg: "bg-gradient-to-br from-danger/15 via-surface to-surface ring-1 ring-danger/30",
    chip: "bg-danger text-danger-foreground",
    Icon: Siren,
    label: "Active Threat Nearby",
    title: "Armed robbery reported",
    subtitle: "1.2 km away · Confidence 87%",
    extra: "23 verified reports in last 8 min",
  },
};

export function StatusCard({
  intensity,
  onCycle,
}: {
  intensity: Intensity;
  onCycle?: () => void;
}) {
  const v = VARIANTS[intensity];
  return (
    <button
      type="button"
      onClick={onCycle}
      className={`w-full rounded-[28px] p-5 text-left shadow-pop transition-all ${v.bg}`}
    >
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${v.chip}`}>
          <v.Icon className="h-3.5 w-3.5" />
          {v.label}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Tap to demo
        </span>
      </div>
      <h2 className="mt-4 font-display text-[26px] font-semibold leading-tight">
        {v.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{v.subtitle}</p>
      {v.extra && (
        <p className="mt-3 text-xs font-medium text-foreground/70">{v.extra}</p>
      )}
    </button>
  );
}