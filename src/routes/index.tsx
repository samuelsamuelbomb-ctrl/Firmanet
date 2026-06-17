import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/swish/AppShell";
import { TopBar } from "@/components/swish/TopBar";
import { StatusCard } from "@/components/swish/StatusCard";
import { QuickActions } from "@/components/swish/QuickActions";
import { SignalCard } from "@/components/swish/SignalCard";
import { SectionHeader } from "@/components/swish/SectionHeader";
import { useSignals, useSignalsRealtime } from "@/lib/swish-store";
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

function Home() {
  const signals = useSignals();
  useSignalsRealtime();

  return (
    <AppShell>
      <TopBar />
      <div className="space-y-5 px-4">
        <StatusCard signals={signals} />
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