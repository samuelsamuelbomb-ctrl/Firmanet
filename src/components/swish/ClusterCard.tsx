import { useState } from "react";
import { ChevronDown, Layers, MapPin, Users } from "lucide-react";
import { SignalCluster } from "@/lib/swish-cluster";
import { SignalCard } from "./SignalCard";
import { TrustBar } from "./TrustBar";

export function ClusterCard({ cluster }: { cluster: SignalCluster }) {
  const [open, setOpen] = useState(false);
  const tone =
    cluster.avgTrust >= 80
      ? "bg-danger/10 ring-danger/30"
      : cluster.avgTrust >= 60
        ? "bg-warn/30 ring-warn/40"
        : "bg-mint/40 ring-mint/40";
  return (
    <article className={`rounded-3xl ${tone} p-4 shadow-soft ring-1`}>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold shadow-soft">
          <Layers className="h-3 w-3" />
          {cluster.signals.length} related reports
        </span>
        <span className="text-[11px] text-muted-foreground">{cluster.minutesAgo} min</span>
      </div>
      <h3 className="mt-3 font-display text-[17px] font-semibold leading-tight">
        {cluster.primary.title}
      </h3>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" /> {cluster.location}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {cluster.totalReports} reports
        </span>
      </div>
      <div className="mt-3">
        <TrustBar value={cluster.avgTrust} />
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-foreground/80"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
        {open ? "Hide" : "Show"} individual reports
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {cluster.signals.map((s) => (
            <SignalCard key={s.id} signal={s} />
          ))}
        </div>
      )}
    </article>
  );
}
