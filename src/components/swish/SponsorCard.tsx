import { Link } from "@tanstack/react-router";
import { Sponsor, TIER_META, sponsors } from "@/lib/sponsors";

/** Full-width institutional support card — onboarding + supporters page. */
export function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  const tier = TIER_META[sponsor.tier];
  return (
    <article className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft">
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${sponsor.accent}`}
      >
        {sponsor.initials}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-base font-semibold leading-tight">
          {sponsor.name}
        </h3>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {sponsor.tagline}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${tier.chip}`}
      >
        {sponsor.tier === "infrastructure" ? "Safety Partner" : sponsor.tier === "community" ? "Supporter" : "Resilience"}
      </span>
    </article>
  );
}

/** Compact footer strip — home + about. */
export function SponsorStrip() {
  return (
    <Link
      to="/settings"
      hash="supporters"
      className="block rounded-2xl bg-muted/40 px-4 py-3 text-center text-[11px] text-muted-foreground"
    >
      <span className="font-semibold text-foreground/70">Supported by</span>{" "}
      {sponsors.slice(0, 3).map((s) => s.name.split(" ")[0]).join(" · ")}
    </Link>
  );
}

/** Tiny feed separator — never near urgent or verified posts. */
export function SponsorSeparator({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/60 px-4 py-3">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold ${sponsor.accent}`}
      >
        {sponsor.initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Safety Partner
        </div>
        <div className="truncate text-xs text-foreground/80">
          <span className="font-semibold">{sponsor.name}</span> · {sponsor.tagline}
        </div>
      </div>
    </div>
  );
}

/** Map / infra watermark badge. */
export function SponsorWatermark() {
  return (
    <div className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold text-foreground/70 shadow-soft">
      <span className="h-1.5 w-1.5 rounded-full bg-warn" />
      Network coverage supported by MTN
    </div>
  );
}