import { Camera, Check, Clock, Eye, MapPin, Users, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Signal } from "@/lib/swish-mock";
import { TrustBar } from "./TrustBar";
import { signalStore } from "@/lib/swish-store";

const TYPE_META: Record<
  Signal["type"],
  { label: string; dot: string; chip: string }
> = {
  observation: { label: "Observation", dot: "bg-mint", chip: "bg-mint/50 text-mint-foreground" },
  update: { label: "Community Update", dot: "bg-warn", chip: "bg-warn/40 text-warn-foreground" },
  incident: { label: "Incident Report", dot: "bg-peach", chip: "bg-peach/60 text-peach-foreground" },
  verified: { label: "Verified Alert", dot: "bg-danger", chip: "bg-danger/15 text-danger" },
};

export function SignalCard({ signal }: { signal: Signal }) {
  const meta = TYPE_META[signal.type];
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const verify = async () => {
    if (verifying || verified) return;
    setVerifying(true);
    const res = await signalStore.verify(signal.id);
    setVerifying(false);
    if (res.ok) setVerified(true);
  };
  return (
    <article className="rounded-3xl bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {signal.minutesAgo} min
        </span>
      </div>
      <h3 className="mt-3 font-display text-[17px] font-semibold leading-tight">
        {signal.title}
      </h3>
      {signal.description && (
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{signal.description}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" /> {signal.location}
        </span>
        <span className="inline-flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" /> {signal.distanceKm.toFixed(1)} km
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {signal.reports}
        </span>
        <span className="inline-flex items-center gap-1">
          <Camera className="h-3.5 w-3.5" /> {signal.media}
        </span>
      </div>
      <div className="mt-3">
        <TrustBar value={signal.trust} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Link
          to="/incident/$id"
          params={{ id: signal.id }}
          className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-soft"
        >
          Open <ChevronRight className="h-3 w-3" />
        </Link>
        <button
          onClick={verify}
          disabled={verifying || verified}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
            verified
              ? "bg-mint/70 text-mint-foreground"
              : "bg-muted text-foreground/80 hover:bg-muted/80"
          }`}
        >
          <Check className="h-3 w-3" />
          {verified ? "Verified" : verifying ? "Verifying…" : "Verify this"}
        </button>
      </div>
    </article>
  );
}