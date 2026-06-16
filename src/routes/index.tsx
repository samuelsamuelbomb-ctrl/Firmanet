import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/swish/AppShell";
import { TopBar } from "@/components/swish/TopBar";
import { StatusCard } from "@/components/swish/StatusCard";
import { QuickActions } from "@/components/swish/QuickActions";
import { SignalCard } from "@/components/swish/SignalCard";
import { SectionHeader } from "@/components/swish/SectionHeader";
import { Intensity } from "@/lib/swish-mock";
import { useSignals } from "@/lib/swish-store";
import { useSignalsRealtime } from "@/lib/swish-store";
import { play } from "@/lib/swish-sound";
import { SponsorStrip } from "@/components/swish/SponsorCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Firmanet — Home" },
      { name: "description", content: "Real-time safety status, trusted alerts, and one-tap SOS for your neighborhood." },
      { property: "og:title", content: "Firmanet — Home" },
      { property: "og:description", content: "Real-time safety status, trusted alerts, and one-tap SOS for your neighborhood." },
    ],
  }),
  component: Home,
});

const INTENSITY_CYCLE: Intensity[] = ["calm", "warn", "danger"];

function Home() {
  const [intensity, setIntensity] = useState<Intensity>("calm");
  const signals = useSignals();
  useSignalsRealtime();
  const first = useRef(true);
  const cycle = () =>
    setIntensity((cur) => INTENSITY_CYCLE[(INTENSITY_CYCLE.indexOf(cur) + 1) % 3]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    play(intensity);
  }, [intensity]);

  return (
    <AppShell>
      <TopBar />
      <div className="space-y-5 px-4">
        <StatusCard intensity={intensity} onCycle={cycle} />
        <QuickActions />
        <section>
          <SectionHeader title="Latest near you" action="See all" to="/feed" />
          <div className="space-y-3">
            {signals.slice(0, 3).map((s) => (
              <SignalCard key={s.id} signal={s} />
            ))}
          </div>
        </section>
        <SponsorStrip />
      </div>
    </AppShell>
  );
}
