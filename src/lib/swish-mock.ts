export type Intensity = "calm" | "warn" | "danger";

export type SignalType = "observation" | "update" | "incident" | "verified";

export type SignalCategory = "crime" | "fire" | "flood" | "accident" | "sos" | "missing" | "other";
export type SignalState = "unverified" | "emerging" | "high_confidence" | "verified";

export interface Signal {
  id: string;
  type: SignalType;
  category: SignalCategory;
  state: SignalState;
  title: string;
  location: string;
  minutesAgo: number;
  distanceKm: number;
  trust: number;
  reports: number;
  media: number;
  description?: string;
  lat: number;
  lng: number;
  media_urls?: string[];
  confirms: number;
  userConfirmed: boolean;
}

export function trustToIntensity(score: number): Intensity {
  if (score >= 80) return "danger";
  if (score >= 60) return "warn";
  return "calm";
}