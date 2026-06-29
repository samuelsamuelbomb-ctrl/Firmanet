/**
 * Static sponsor data — ported from src/lib/sponsors.ts
 * Platform-agnostic. Zero dependencies.
 */

import type { Sponsor, SponsorTier } from "./types";

export const TIER_META: Record<SponsorTier, { label: string }> = {
  infrastructure: {
    label: "Safety Infrastructure Partner",
  },
  community: {
    label: "Community Safety Supporter",
  },
  national: {
    label: "National Resilience Partner",
  },
};

export const sponsors: Sponsor[] = [
  {
    id: "mtn",
    name: "MTN Nigeria",
    tagline: "Connecting Nigerians to safety in real time",
    tier: "infrastructure",
    initials: "MTN",
    accent: "#FF8C42",
    image_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/MTN_Group_Logo.svg/200px-MTN_Group_Logo.svg.png",
  },
  {
    id: "gtb",
    name: "GTBank",
    tagline: "Supporting safer communities across Nigeria",
    tier: "community",
    initials: "GTB",
    accent: "#6C63FF",
  },
  {
    id: "access",
    name: "Access Bank",
    tagline: "Committed to community safety and resilience",
    tier: "community",
    initials: "AB",
    accent: "#9B59B6",
  },
  {
    id: "shell",
    name: "Shell Nigeria",
    tagline: "Investing in safer, more resilient communities",
    tier: "national",
    initials: "SH",
    accent: "#E67E22",
  },
];
