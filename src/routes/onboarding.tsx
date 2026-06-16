import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Users, Radar, Siren, Sparkles, ChevronRight } from "lucide-react";
import { SponsorCard } from "@/components/swish/SponsorCard";
import { sponsors } from "@/lib/sponsors";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Firmanet — Welcome" },
      { name: "description", content: "A calm introduction to Firmanet — Nigeria's real-time community safety network." },
    ],
  }),
  component: Onboarding,
});

const SLIDES = ["mission", "purpose", "intelligence", "alerts", "sponsors"] as const;
type Stage = (typeof SLIDES)[number];

function Onboarding() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("mission");
  const idx = SLIDES.indexOf(stage);

  const next = () => {
    if (idx === SLIDES.length - 1) {
      try {
        localStorage.setItem("swish.onboarded", "1");
      } catch {
        /* no-op */
      }
      navigate({ to: "/auth" });
      return;
    }
    setStage(SLIDES[idx + 1]);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {SLIDES.map((s, i) => (
              <span
                key={s}
                className={`h-1 rounded-full transition-all ${
                  i <= idx ? "w-6 bg-foreground" : "w-3 bg-muted"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => navigate({ to: "/auth" })}
            className="text-xs font-semibold text-muted-foreground"
          >
            Skip
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div key={stage} className="w-full animate-in fade-in slide-in-from-bottom-3 duration-500">
            {stage === "mission" && <Mission />}
            {stage === "purpose" && <Purpose />}
            {stage === "intelligence" && <Intelligence />}
            {stage === "alerts" && <Alerts />}
            {stage === "sponsors" && <Sponsors />}
          </div>
        </div>

        <button
          onClick={next}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-pop active:scale-[0.98]"
        >
          {idx === SLIDES.length - 1 ? "Get started" : "Continue"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Mission() {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-mint shadow-soft">
        <Shield className="h-10 w-10 text-mint-foreground" />
      </div>
      <h1 className="mt-6 font-display text-3xl font-bold leading-tight">Firmanet</h1>
      <p className="mt-2 text-base text-muted-foreground">
        A real-time safety network for Nigerian communities.
      </p>
    </div>
  );
}

function Purpose() {
  const items = [
    { Icon: Users, t: "Report incidents", s: "Calm, structured signals — not noise." },
    { Icon: Radar, t: "See nearby safety updates", s: "Only what's relevant to where you are." },
    { Icon: Sparkles, t: "Stay informed in real time", s: "Trust grows as community verifies." },
  ];
  return (
    <div>
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold leading-tight">Built for your neighborhood</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Detect, verify, and alert — together.
        </p>
      </div>
      <div className="mt-6 space-y-3">
        {items.map(({ Icon, t, s }, i) => (
          <div
            key={t}
            style={{ animationDelay: `${i * 150}ms` }}
            className="flex items-start gap-3 rounded-3xl bg-card p-4 shadow-soft animate-in fade-in slide-in-from-bottom-2"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-mint/60">
              <Icon className="h-5 w-5 text-mint-foreground" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">{t}</h3>
              <p className="text-xs text-muted-foreground">{s}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Intelligence() {
  return (
    <div>
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold leading-tight">Verified, not viral</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Every signal carries a trust score from the people around it.
        </p>
      </div>
      <article className="mt-6 rounded-3xl bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-peach/60 px-2.5 py-1 text-[11px] font-semibold text-peach-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-peach" />
            Incident Report
          </span>
          <span className="text-[11px] text-muted-foreground">9 min</span>
        </div>
        <h3 className="mt-3 font-display text-base font-semibold">Armed robbery suspected</h3>
        <p className="text-xs text-muted-foreground">Allen Avenue · 1.2 km away</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[82%] rounded-full bg-warn animate-in slide-in-from-left duration-700" />
          </div>
          <span className="text-xs font-semibold">82%</span>
        </div>
      </article>
    </div>
  );
}

function Alerts() {
  return (
    <div>
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold leading-tight">Loud only when it matters</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Quiet by default. Emergency override when reality demands it.
        </p>
      </div>
      <div className="relative mt-8 flex items-center justify-center">
        <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-danger text-danger-foreground shadow-danger">
          <span className="absolute inset-0 rounded-full bg-danger/40 animate-soft-ping" />
          <Siren className="relative h-12 w-12" />
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Active alert nearby — confidence rises as more neighbors confirm.
      </p>
    </div>
  );
}

function Sponsors() {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setShown((n) => Math.min(n + 1, sponsors.length)), 350);
    return () => clearInterval(i);
  }, []);
  return (
    <div>
      <div className="text-center">
        <h2 className="font-display text-2xl font-bold leading-tight">
          Backed by Nigeria's safety infrastructure
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Supported by organizations committed to public safety.
        </p>
      </div>
      <div className="mt-6 space-y-3">
        {sponsors.slice(0, shown).map((s) => (
          <div key={s.id} className="animate-in fade-in slide-in-from-bottom-2">
            <SponsorCard sponsor={s} />
          </div>
        ))}
      </div>
    </div>
  );
}