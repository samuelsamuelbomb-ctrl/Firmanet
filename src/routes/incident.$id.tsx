import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/swish/AppShell";
import { TopBar } from "@/components/swish/TopBar";
import { TrustBar } from "@/components/swish/TrustBar";
import { useSignals, useSignalsRealtime, signalStore } from "@/lib/swish-store";
import { trustToIntensity } from "@/lib/swish-mock";
import { ArrowLeft, MapPin, Clock, Users, ShieldCheck, CheckCircle2, AlertTriangle, Camera } from "lucide-react";
import { useState } from "react";
import { formatTimeAgo } from "@/lib/utils";

function isVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
  return videoExtensions.some(ext => url.toLowerCase().endsWith(ext));
}

export const Route = createFileRoute("/incident/$id")({
  head: () => ({
    meta: [
      { title: "Firmanet — Incident" },
      { name: "description", content: "Detailed incident view with verification timeline and community updates." },
    ],
  }),
  component: IncidentPage,
});

const STATE_LABEL = (reports: number, trust: number) => {
  if (reports >= 20) return { label: "Verified", tone: "bg-mint/60 text-mint-foreground" };
  if (trust >= 80) return { label: "High confidence", tone: "bg-warn/40 text-warn-foreground" };
  if (reports >= 3) return { label: "Emerging", tone: "bg-peach/60 text-peach-foreground" };
  return { label: "Unverified", tone: "bg-muted text-muted-foreground" };
};

function IncidentPage() {
  useSignalsRealtime();
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const signals = useSignals();
  const signal = signals.find((s) => s.id === id);
  const [verifying, setVerifying] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!signal) {
    return (
      <AppShell>
        <TopBar />
        <div className="px-4">
          <Link to="/feed" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to feed
          </Link>
          <div className="mt-6 rounded-3xl bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">
            This incident isn't in your local feed yet. Open the feed to refresh.
          </div>
        </div>
      </AppShell>
    );
  }

  const state = STATE_LABEL(signal.reports, signal.trust);
  const intensity = trustToIntensity(signal.trust);

  const verify = async () => {
    setVerifying(true);
    setErr(null);
    const r = await signalStore.verify(signal.id);
    setVerifying(false);
    if (!r.ok) setErr(r.error ?? "Couldn't verify");
  };

  return (
    <AppShell>
      <TopBar />
      <div className="px-4 pb-6 pt-4">
        <button onClick={() => navigate({ to: "/feed" })} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="mt-6 flex items-center justify-between">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${state.tone}`}>
            {state.label}
          </span>
          <span className="text-[11px] text-muted-foreground capitalize">{signal.type}</span>
        </div>

        <h1 className="mt-4 font-display text-2xl font-bold leading-tight">{signal.title}</h1>
        {signal.description && (
          <p className="mt-3 text-sm text-muted-foreground">{signal.description}</p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat icon={<MapPin className="h-4 w-4" />} label="Distance" value={`${signal.distanceKm.toFixed(1)} km`} />
          <Stat icon={<Clock className="h-4 w-4" />} label="Reported" value={formatTimeAgo(signal.minutesAgo)} />
          <Stat icon={<Users className="h-4 w-4" />} label="Reports" value={String(signal.reports)} />
        </div>

        <div className="mt-4 rounded-3xl bg-card p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-mint-foreground" />
            <h3 className="font-display text-sm font-semibold">Verification</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Confidence rises as more neighbors confirm. {signal.reports} of 20 needed for verified status.
          </p>
          <div className="mt-3"><TrustBar value={signal.trust} /></div>
          <button
            onClick={verify}
            disabled={verifying}
            className="mt-4 w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-pop active:scale-[0.98] disabled:opacity-50"
          >
            {verifying ? "Confirming…" : "I can confirm this"}
          </button>
          {err && <p className="mt-2 text-center text-xs text-danger">{err}</p>}
        </div>

        <div className="mt-4 rounded-3xl bg-card p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display text-sm font-semibold">Media</h3>
          </div>
          {signal.media_urls && signal.media_urls.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {signal.media_urls.map((url, index) => (
                isVideoUrl(url) ? (
                  <video
                    key={index}
                    src={url}
                    className="w-full h-32 object-cover rounded-xl"
                    controls
                    playsInline
                  />
                ) : (
                  <img 
                    key={index} 
                    src={url} 
                    alt={`Attachment ${index + 1}`} 
                    className="w-full h-32 object-cover rounded-xl"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )
              ))}
            </div>
          ) : signal.media > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">{signal.media} photo/video attachments.</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">No media attached yet.</p>
          )}
        </div>

        <div className="mt-4 rounded-3xl bg-card p-4 shadow-soft">
          <h3 className="font-display text-sm font-semibold">Timeline</h3>
          <ol className="mt-3 space-y-3">
            <TimelineItem icon={<AlertTriangle className="h-3.5 w-3.5" />} text="Initial report submitted" time={formatTimeAgo(signal.minutesAgo)} />
            {signal.reports >= 3 && (
              <TimelineItem icon={<Users className="h-3.5 w-3.5" />} text={`${signal.reports - 1} corroborating reports`} time="now" />
            )}
            {signal.reports >= 20 && (
              <TimelineItem icon={<CheckCircle2 className="h-3.5 w-3.5 text-mint-foreground" />} text="Reached verified status" time="now" />
            )}
          </ol>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {["Still active", "Resolved", "False alarm"].map((c) => (
            <button key={c} className="rounded-2xl border border-border bg-card py-2.5 text-xs font-semibold text-foreground shadow-soft active:scale-[0.98]">
              {c}
            </button>
          ))}
        </div>

        <p className="mt-3 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
          Intensity · {intensity}
        </p>
      </div>
    </AppShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-soft">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-display text-sm font-semibold">{value}</div>
    </div>
  );
}

function TimelineItem({ icon, text, time }: { icon: React.ReactNode; text: string; time: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-muted">{icon}</span>
      <div className="flex-1">
        <p className="text-sm">{text}</p>
        <p className="text-[11px] text-muted-foreground">{time}</p>
      </div>
    </li>
  );
}