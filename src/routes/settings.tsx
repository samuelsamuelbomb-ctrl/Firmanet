import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/swish/AppShell";
import { TopBar } from "@/components/swish/TopBar";
import { Volume2, Vibrate, Moon, Radius, BellRing } from "lucide-react";
import { Handshake } from "lucide-react";
import { SponsorCard } from "@/components/swish/SponsorCard";
import { sponsors } from "@/lib/sponsors";

const SETTINGS_KEY = "firmanet-settings";

type IntensityId = "minimal" | "balanced" | "full";

interface Settings {
  intensity: IntensityId;
  vibration: number;
  radius: number;
  quietHours: boolean;
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw) as Settings;
  } catch { /* ignore */ }
  return { intensity: "balanced", vibration: 70, radius: 3, quietHours: true };
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Firmanet — Settings" },
      { name: "description", content: "Tune alert intensity, vibration, quiet hours and radius sensitivity." },
    ],
  }),
  component: SettingsPage,
});

const INTENSITIES = [
  {
    id: "minimal",
    label: "Minimal",
    sub: "Only critical alerts",
    tone: "bg-mint/40 text-mint-foreground",
    ring: "ring-mint",
  },
  {
    id: "balanced",
    label: "Balanced",
    sub: "Recommended for most",
    tone: "bg-warn/40 text-warn-foreground",
    ring: "ring-warn",
  },
  {
    id: "full",
    label: "Full",
    sub: "All verified signals",
    tone: "bg-danger/15 text-danger",
    ring: "ring-danger",
  },
] as const;

function SettingsPage() {
  const [intensity, setIntensity] = useState<(typeof INTENSITIES)[number]["id"]>("balanced");
  const [vibration, setVibration] = useState(70);
  const [radius, setRadius] = useState(3);
  const [quietHours, setQuietHours] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    const s = loadSettings();
    setIntensity(s.intensity);
    setVibration(s.vibration);
    setRadius(s.radius);
    setQuietHours(s.quietHours);
    setLoaded(true);
  }, []);

  // Persist whenever a value changes and we've loaded from storage
  useEffect(() => {
    if (!loaded) return;
    saveSettings({ intensity, vibration, radius, quietHours });
  }, [intensity, vibration, radius, quietHours, loaded]);

  return (
    <AppShell>
      <TopBar />
      <div className="px-4">
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Stay calm. Get loud only when reality demands it.</p>

        {/* Intensity */}
        <section className="mt-5 rounded-3xl bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <BellRing className="h-4 w-4 text-mint-foreground" />
            <h2 className="font-display font-semibold">Alert Sound Intensity</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {INTENSITIES.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setIntensity(opt.id)}
                className={`rounded-2xl p-3 text-left transition-all ${
                  intensity === opt.id ? `ring-2 ${opt.ring} bg-surface` : "bg-muted/40"
                }`}
              >
                <span className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${opt.tone}`}>
                  {opt.label}
                </span>
                <div className="text-[11px] leading-tight text-muted-foreground">{opt.sub}</div>
              </button>
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Volume2 className="h-3.5 w-3.5" /> Volume escalation</span>
              <span>Smart</span>
            </div>
            <SoundLadder />
          </div>
        </section>

        <section className="mt-4 rounded-3xl bg-card p-4 shadow-soft">
          <SliderRow
            icon={<Vibrate className="h-4 w-4" />}
            label="Vibration strength"
            value={vibration}
            onChange={setVibration}
            unit="%"
          />
          <div className="my-3 h-px bg-border" />
          <SliderRow
            icon={<Radius className="h-4 w-4" />}
            label="Radius sensitivity"
            value={radius}
            min={1}
            max={10}
            onChange={setRadius}
            unit=" km"
          />
          <div className="my-3 h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <Moon className="h-4 w-4" /> Quiet hours
            </span>
            <button
              onClick={() => setQuietHours((v) => !v)}
              className={`h-7 w-12 rounded-full transition-colors ${
                quietHours ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`block h-6 w-6 translate-y-0.5 rounded-full bg-surface shadow-soft transition-transform ${
                  quietHours ? "translate-x-6" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        </section>

        <p className="mt-6 px-2 text-center text-[11px] text-muted-foreground">
          Firmanet · calm by default, loud when it matters.
        </p>

        <section id="supporters" className="mt-6 scroll-mt-24 rounded-3xl bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <Handshake className="h-4 w-4 text-mint-foreground" />
            <h2 className="font-display font-semibold">Firmanet Safety Partners</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Organizations supporting Nigeria's safety infrastructure. Sponsors never appear
            in active alerts or emergency flows.
          </p>
          <div className="mt-4 space-y-2">
            {sponsors.map((s) => (
              <SponsorCard key={s.id} sponsor={s} />
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SliderRow({
  icon,
  label,
  value,
  min = 0,
  max = 100,
  unit = "",
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          {icon} {label}
        </span>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

function SoundLadder() {
  const steps = [
    { label: "0–30%", tone: "bg-mint", h: "h-3" },
    { label: "30–60%", tone: "bg-warn/70", h: "h-5" },
    { label: "60–80%", tone: "bg-peach", h: "h-7" },
    { label: "80–95%", tone: "bg-danger/70", h: "h-9" },
    { label: "95%+", tone: "bg-danger", h: "h-11" },
  ];
  return (
    <div className="flex items-end justify-between gap-1.5">
      {steps.map((s) => (
        <div key={s.label} className="flex flex-1 flex-col items-center gap-1">
          <div className={`w-full rounded-t-lg ${s.tone} ${s.h}`} />
          <span className="text-[9px] text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  );
}