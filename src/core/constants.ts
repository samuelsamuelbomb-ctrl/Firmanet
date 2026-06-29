/**
 * Application constants.
 * Platform-agnostic.
 */

export const SIGNAL_STATE_LABELS = {
  unverified: { label: "Unverified", tone: "muted" },
  emerging: { label: "Emerging", tone: "warn" },
  high_confidence: { label: "High confidence", tone: "danger" },
  verified: { label: "Verified", tone: "success" },
} as const;

export const SOS_CIRCLE_SIZE = 12;
export const VERIFIED_THRESHOLD = 20;
export const HIGH_CONFIDENCE_TRUST = 80;
export const EMERGING_REPORT_THRESHOLD = 3;

export const INTENSITY_CYCLE: Intensity[] = ["calm", "warn", "danger"];

/**
 * Default map center for Ikeja, Lagos, Nigeria.
 * Used as fallback when user location is unavailable.
 */
export const IKEJA_CENTER = { lat: 6.6018, lng: 3.3515 };

// Re-export type needed for the array above
import type { Intensity } from "./types";
