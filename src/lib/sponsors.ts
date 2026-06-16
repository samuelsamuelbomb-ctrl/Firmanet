export type SponsorTier = "infrastructure" | "community" | "national";

export interface Sponsor {
  id: string;
  name: string;
  tagline: string;
  tier: SponsorTier;
  initials: string;
  accent: string; // tailwind bg utility for logo bubble
  url?: string;
}

export const TIER_META: Record<SponsorTier, { label: string; chip: string }> = {
  infrastructure: {
    label: "Safety Infrastructure Partner",
    chip: "bg-mint/60 text-mint-foreground",
  },
  community: {
    label: "Community Safety Supporter",
    chip: "bg-lavender/60 text-lavender-foreground",
  },
  national: {
    label: "National Resilience Partner",
    chip: "bg-peach/60 text-peach-foreground",
  },
};

export const sponsors: Sponsor[] = [
  {
    id: "mtn",
    name: "MTN Nigeria",
    tagline: "Connecting Nigerians to safety in real time",
    tier: "infrastructure",
    initials: "MTN",
    accent: "bg-warn/70 text-warn-foreground",
  },
  {
    id: "gtb",
    name: "GTBank",
    tagline: "Supporting safer communities across Nigeria",
    tier: "community",
    initials: "GTB",
    accent: "bg-primary text-primary-foreground",
  },
  {
    id: "access",
    name: "Access Bank",
    tagline: "Committed to community safety and resilience",
    tier: "community",
    initials: "AB",
    accent: "bg-lavender text-lavender-foreground",
  },
  {
    id: "shell",
    name: "Shell Nigeria",
    tagline: "Investing in safer, more resilient communities",
    tier: "national",
    initials: "SH",
    accent: "bg-peach text-peach-foreground",
  },
];