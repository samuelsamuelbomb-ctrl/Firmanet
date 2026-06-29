export type SponsorTier = "infrastructure" | "community" | "national";

export interface Sponsor {
  id: string;
  name: string;
  tagline: string;
  tier: SponsorTier;
  initials: string;
  accent: string; // can be hex or tailwind utility for web
  url?: string;
  image_url?: string | null; // Optional image URL for sponsor logo
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

// Helper function to map hex colors to Tailwind utilities (simplified for the demo)
export const hexToTailwindAccent = (hex: string): string => {
  if (hex.includes("#FF8C42")) return "bg-warn/70 text-warn-foreground";
  if (hex.includes("#6C63FF")) return "bg-primary text-primary-foreground";
  if (hex.includes("#9B59B6")) return "bg-lavender text-lavender-foreground";
  if (hex.includes("#E67E22")) return "bg-peach text-peach-foreground";
  return "bg-primary text-primary-foreground";
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
