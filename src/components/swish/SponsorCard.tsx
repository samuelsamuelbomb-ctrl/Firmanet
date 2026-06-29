import { Link } from "@tanstack/react-router";
import { Sponsor, TIER_META, hexToTailwindAccent } from "@/lib/sponsors";
import { useSponsors, useSponsorsBootstrap } from "@/lib/sponsorStore";
import { useEffect, useState } from "react";

/** Full-width institutional support card — onboarding + supporters page. */
export function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  const tier = TIER_META[sponsor.tier];
  const tailwindAccent = hexToTailwindAccent(sponsor.accent);
  return (
    <article className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft">
      {sponsor.image_url ? (
        <img
          src={sponsor.image_url}
          alt={`${sponsor.name} logo`}
          className="h-14 w-14 shrink-0 rounded-2xl object-cover"
        />
      ) : (
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${tailwindAccent}`}
        >
          {sponsor.initials}
        </div>
      )}
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

/** Compact footer strip — home + about, with smooth transitions and swapping icons. */
export function SponsorStrip() {
  const sponsors = useSponsors();
  const { bootstrap } = useSponsorsBootstrap();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (sponsors.length === 0) return;
    
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % sponsors.length);
        setIsTransitioning(false);
      }, 300); // Wait for fade out before changing
    }, 3000); // Swap every 3 seconds

    return () => clearInterval(interval);
  }, [sponsors.length]);

  const currentSponsor = sponsors.length > 0 ? sponsors[currentIndex] : null;
  const tailwindAccent = currentSponsor ? hexToTailwindAccent(currentSponsor.accent) : "";

  return (
    <Link
      to="/settings"
      hash="supporters"
      className="block rounded-2xl bg-muted/40 px-4 py-3 text-[11px] text-muted-foreground overflow-hidden"
    >
      <div className="flex items-center justify-center gap-3">
        <span className="font-semibold text-foreground/70 shrink-0">Supported by</span>
        {currentSponsor && (
          <div
            className={`flex items-center gap-2 transition-opacity duration-300 ${
              isTransitioning ? "opacity-0" : "opacity-100"
            }`}
          >
            {currentSponsor.image_url ? (
              <img
                src={currentSponsor.image_url}
                alt={`${currentSponsor.name} logo`}
                className="h-8 w-8 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold ${tailwindAccent}`}
              >
                {currentSponsor.initials}
              </div>
            )}
            <span className="font-semibold text-foreground/80">{currentSponsor.name}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

/** Tiny feed separator — never near urgent or verified posts. */
export function SponsorSeparator({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/60 px-4 py-3">
      {sponsor.image_url ? (
        <img
          src={sponsor.image_url}
          alt={`${sponsor.name} logo`}
          className="h-9 w-9 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold ${sponsor.accent}`}
        >
          {sponsor.initials}
        </span>
      )}
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