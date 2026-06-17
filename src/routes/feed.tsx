import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, X, MapPin, Camera, ChevronLeft, ChevronRight, Loader2, ShieldAlert, Flame, Droplets, Car, UserSearch, HelpCircle } from "lucide-react";
import { AppShell } from "@/components/swish/AppShell";
import { TopBar } from "@/components/swish/TopBar";
import { SignalCard } from "@/components/swish/SignalCard";
import { ClusterCard } from "@/components/swish/ClusterCard";
import { SignalType, SignalCategory } from "@/lib/swish-mock";
import { signalStore, useSignals } from "@/lib/swish-store";
import { clusterSignals, isCluster } from "@/lib/swish-cluster";
import { play } from "@/lib/swish-sound";
import { useSignalsRealtime } from "@/lib/swish-store";
import { SponsorSeparator } from "@/components/swish/SponsorCard";
import { sponsors } from "@/lib/sponsors";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Firmanet — Feed" },
      { name: "description", content: "Structured intelligence from your neighborhood: observations, updates, incidents and verified alerts." },
    ],
  }),
  component: FeedPage,
});

const TABS = ["For You", "Near You", "Verified", "Alerts"] as const;
type Tab = (typeof TABS)[number];

function FeedPage() {
  const [tab, setTab] = useState<Tab>("For You");
  const [open, setOpen] = useState(false);
  const signals = useSignals();
  useSignalsRealtime();

  const filtered = signals.filter((s) => {
    if (tab === "Verified") return s.type === "verified";
    if (tab === "Alerts") return s.trust >= 70;
    if (tab === "Near You") return s.distanceKm <= 2;
    return true;
  });
  const grouped = clusterSignals(filtered);

  // Insert a single sponsor separator after the 4th item, never in Verified/Alerts streams.
  const showSponsor = tab !== "Verified" && tab !== "Alerts" && grouped.length > 4;

  return (
    <AppShell>
      <TopBar />
      <div className="px-4">
        <h1 className="font-display text-2xl font-semibold">Signals</h1>
        <p className="text-sm text-muted-foreground">Verified intelligence from your community.</p>

        <div className="mt-4 overflow-x-auto">
          <div className="inline-flex gap-1 rounded-full bg-muted p-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  tab === t ? "bg-surface text-foreground shadow-soft" : "text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {grouped.map((item, i) => (
            <div key={isCluster(item) ? item.id : item.id}>
              {showSponsor && i === 4 && (
                <div className="mb-3">
                  <SponsorSeparator sponsor={sponsors[1]} />
                </div>
              )}
              {
            isCluster(item) ? (
                <ClusterCard cluster={item} />
            ) : (
                <SignalCard signal={item} />
              )}
            </div>
          ))}
          {grouped.length === 0 && (
            <div className="rounded-3xl bg-card p-8 text-center text-sm text-muted-foreground shadow-soft">
              No signals in this view.
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setOpen(true)}
        aria-label="Create report"
        className="fixed bottom-40 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-pop active:scale-95"
      >
        <Plus className="h-6 w-6" strokeWidth={2.4} />
      </button>

      {open && <CreateModal onClose={() => setOpen(false)} />}
    </AppShell>
  );
}

type IncidentCategory = {
  key: SignalCategory;
  label: string;
  type: SignalType;
  Icon: React.ComponentType<{ className?: string }>;
  tint: string;
};

const CATEGORIES: IncidentCategory[] = [
  { key: "crime", label: "Crime", type: "incident", Icon: ShieldAlert, tint: "text-danger" },
  { key: "fire", label: "Fire", type: "incident", Icon: Flame, tint: "text-danger" },
  { key: "flood", label: "Flood", type: "update", Icon: Droplets, tint: "text-warn-foreground" },
  { key: "accident", label: "Accident", type: "incident", Icon: Car, tint: "text-warn-foreground" },
  { key: "missing", label: "Missing person", type: "update", Icon: UserSearch, tint: "text-foreground" },
  { key: "other", label: "Other", type: "observation", Icon: HelpCircle, tint: "text-muted-foreground" },
];

/**
 * Reverse geocode coordinates to a human-readable place name using Mapbox.
 * Returns the place name on success, or the raw coordinate string as fallback.
 */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const token =
    import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN ??
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN ??
    "";
  if (!token) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=locality,place,neighborhood&limit=1`,
    );
    const data = await res.json();
    if (data?.features?.[0]?.place_name) {
      return data.features[0].place_name;
    }
  } catch {
    // ignore — fall back to coordinates
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [cat, setCat] = useState<IncidentCategory | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [media, setMedia] = useState(0);
  const [location, setLocation] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoords({ lat, lng });
          // Show coordinates immediately as quick fallback
          setLocation(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          // Attempt reverse geocoding for a meaningful location name
          const name = await reverseGeocode(lat, lng);
          setLocation(name);
        },
        () => {},
        { timeout: 4000 },
      );
    }
  }, []);

  const submit = () => {
    if (!cat) return;
    setProcessing(true);
    window.setTimeout(() => {
      const created = signalStore.add({
        type: cat.type,
        category: cat.key,
        title: title.trim() || cat.label,
        description: desc,
        location: location ?? undefined,
        lat: coords?.lat,
        lng: coords?.lng,
      });
      play(created.trust >= 70 ? "danger" : created.trust >= 60 ? "warn" : "calm");
      onClose();
    }, 1100);
  };

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-[32px] bg-surface p-5 pb-8 shadow-pop animate-in slide-in-from-bottom">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step > 0 && !processing && (
              <button onClick={back} className="rounded-full bg-muted p-2"><ChevronLeft className="h-4 w-4" /></button>
            )}
            <h2 className="font-display text-lg font-semibold">
              {processing ? "Processing report" : ["Type", "Details", "Media", "Location", "Review"][step]}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-full bg-muted p-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-foreground" : "bg-muted"}`} />
          ))}
        </div>

        {processing ? (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm font-semibold">Scanning nearby reports…</p>
            <p className="mt-1 text-xs text-muted-foreground">Matching similar incidents.</p>
          </div>
        ) : step === 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => { setCat(c); next(); }}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-3 text-center ${
                  cat?.key === c.key ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <c.Icon className={`h-5 w-5 ${c.tint}`} />
                <div className="text-xs font-semibold leading-tight">{c.label}</div>
              </button>
            ))}
          </div>
        ) : step === 1 ? (
          <div className="mt-4 space-y-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={cat ? `${cat.label} — short title` : "Title"} className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary" />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's happening?" rows={4} className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary" />
          </div>
        ) : step === 2 ? (
          <div className="mt-4">
            <button onClick={() => setMedia((m) => m + 1)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card py-8 text-sm font-semibold text-muted-foreground">
              <Camera className="h-5 w-5" /> Add photo or video {media > 0 && `(${media})`}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">Optional · helps verification confidence.</p>
          </div>
        ) : step === 3 ? (
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-mint/50 px-3 py-1.5 text-xs font-semibold text-mint-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {coords ? "GPS locked" : "Auto"}
              </span>
              <input value={location ?? ""} onChange={(e) => setLocation(e.target.value || null)} placeholder="Address or area" className="w-full rounded-full bg-muted px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">You can adjust manually if GPS isn't precise.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            <Review label="Type" value={cat?.label ?? "—"} />
            <Review label="Title" value={title || "(none)"} />
            <Review label="Location" value={location ?? "Acquiring location…"} />
            <Review label="Media" value={`${media} attachment${media === 1 ? "" : "s"}`} />
            <p className="mt-3 rounded-2xl bg-mint/40 px-3 py-2 text-[11px] text-mint-foreground">
              Initial confidence: low. Will rise as neighbors confirm.
            </p>
          </div>
        )}

        {!processing && (
          step < 4 ? (
            <button onClick={next} disabled={step === 0 && !cat} className="mt-5 flex w-full items-center justify-center gap-1 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-pop active:scale-[0.98] disabled:opacity-50">
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={submit} className="mt-5 w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-pop active:scale-[0.98]">
              Submit report
            </button>
          )
        )}
      </div>
    </div>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-2.5 shadow-soft">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}