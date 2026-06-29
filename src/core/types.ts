/**
 * Shared type definitions — ported from swish-mock.ts
 * Platform-agnostic. Zero dependencies.
 */

export type Intensity = "calm" | "warn" | "danger";

export type SignalType = "observation" | "update" | "incident" | "verified";

export type SignalCategory = "crime" | "fire" | "flood" | "accident" | "sos" | "missing" | "other";

export type SignalState = "unverified" | "emerging" | "high_confidence" | "verified";

export interface MediaFile {
  id: string;
  storage_path: string;
  mime_type: string;
}

export interface Signal {
  id: string;
  author_id?: string;
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
  created_at: string;
  media_urls?: string[];
  media_files?: MediaFile[];
  // Computed fields
  likes?: number;
  comments?: number;
  views?: number;
  shares?: number;
  total_watch_time_seconds?: number;
  liked_by_user?: boolean;
  confirms: number;
  userConfirmed: boolean;
}

export type SponsorTier = "infrastructure" | "community" | "national";

export interface Sponsor {
  id: string;
  name: string;
  tagline: string;
  tier: SponsorTier;
  initials: string;
  accent: string;
  url?: string;
  image_url?: string | null;
}

export interface SignalCluster {
  id: string;
  signals: Signal[];
  primary: Signal;
  location: string;
  totalReports: number;
  avgTrust: number;
  minutesAgo: number;
}

export type SoundLevel = "calm" | "warn" | "danger" | "sos";

export type SoundLevelIntensity = SoundLevel;

export type AuthMode = "signin" | "signup";

/** Shape of app user from Supabase auth */
export interface AppUser {
  id: string;
  email: string;
  displayName?: string;
  location?: string;
  trustScore?: number;
}

/** Trust to intensity mapping */
export function trustToIntensity(score: number): Intensity {
  if (score >= 80) return "danger";
  if (score >= 60) return "warn";
  return "calm";
}

/** Circle member shape */
export interface CircleMember {
  id: string;
  name: string;
  role: string;
  location: string;
  status: Intensity;
  last_seen: string;
}

/** Circle request shape */
export interface CircleRequest {
  id: string;
  from_user: string;
  to_user: string;
  status: string;
  from_username?: string;
  from_name?: string;
}

/** Notification shape */
export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
  data?: {
    signal_id?: string;
    sos_id?: string;
    request_id?: string;
    from_user?: string;
  } | null;
}

// ========================================
// NEW DATABASE TYPES
// ========================================

export interface Profile {
  id: string;
  display_name?: string;
  avatar_url?: string;
  location?: string;
  trust_score: number;
  created_at: string;
  updated_at: string;
  username?: string;
}

export interface SignalLike {
  id: string;
  signal_id: string;
  user_id: string;
  created_at: string;
}

export interface SignalComment {
  id: string;
  signal_id: string;
  user_id: string;
  text: string;
  created_at: string;
  // Joined fields
  user?: Profile;
}

export interface SignalView {
  id: string;
  signal_id: string;
  user_id: string;
  watch_time_seconds: number;
  completion_rate?: number;
  created_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  category_interactions: Record<SignalCategory, number>;
  view_history: string[];
  updated_at: string;
}