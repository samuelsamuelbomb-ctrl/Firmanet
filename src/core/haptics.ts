/**
 * haptics.ts — Cross-platform haptic feedback utility for Firmanet.
 *
 * Works on ALL platforms without requiring expo-haptics to be installed:
 *   - Web: uses navigator.vibrate()
 *   - React Native: uses expo-haptics (imported dynamically, graceful fallback if missing)
 *
 * Usage:
 *   import { lightTap, mediumTap, heavyTap, successNotify, warningNotify, errorNotify, selectionTick } from "../core/haptics";
 *
 *   lightTap();   // Button press, tab switch, subtle UI action
 *   mediumTap();  // Significant action (card press, filter toggle)
 *   heavyTap();   // SOS, critical/emergency action
 *   successNotify(); // Operation succeeded (submit, confirm)
 *   warningNotify(); // Something needs attention
 *   errorNotify();   // Something went wrong
 *   selectionTick(); // Slider stop, toggle, selection change
 */

// ─── Platform detection ───

const isReactNative =
  typeof navigator !== "undefined" && navigator.product === "ReactNative";

const canVibrate =
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

// ─── Web Vibration API helpers ───

function webVibrate(pattern: number | number[]) {
  if (canVibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* vibration not supported */
    }
  }
}

// ─── Native helpers via expo-haptics (lazy loaded, never blocks) ───

let nativeHaptics: typeof import("expo-haptics") | null = null;
let nativeLoadAttempted = false;

async function getNativeHaptics() {
  if (nativeLoadAttempted) return nativeHaptics;
  nativeLoadAttempted = true;
  try {
    nativeHaptics = await import("expo-haptics");
  } catch {
    nativeHaptics = null;
  }
  return nativeHaptics;
}

// ─── Entry point: dispatch haptics on best available platform ───

async function dispatchImpact(style: string) {
  if (isReactNative) {
    const h = await getNativeHaptics();
    if (h) {
      try {
        const map: Record<string, any> = {
          light: h.ImpactFeedbackStyle.Light,
          medium: h.ImpactFeedbackStyle.Medium,
          heavy: h.ImpactFeedbackStyle.Heavy,
          rigid: h.ImpactFeedbackStyle.Rigid,
          soft: h.ImpactFeedbackStyle.Soft,
        };
        void h.impactAsync(map[style] ?? h.ImpactFeedbackStyle.Light);
      } catch {
        /* native haptics failed */
      }
      return;
    }
    // expo-haptics not available, fall through to web
  }
  // Web / fallback: use Vibration API
  const durations: Record<string, number> = {
    light: 10,
    medium: 20,
    heavy: 40,
    rigid: 15,
    soft: 8,
  };
  webVibrate(durations[style] ?? 10);
}

async function dispatchNotification(type: string) {
  if (isReactNative) {
    const h = await getNativeHaptics();
    if (h) {
      try {
        const map: Record<string, any> = {
          success: h.NotificationFeedbackType.Success,
          warning: h.NotificationFeedbackType.Warning,
          error: h.NotificationFeedbackType.Error,
        };
        void h.notificationAsync(map[type] ?? h.NotificationFeedbackType.Success);
      } catch {
        /* native notification failed */
      }
      return;
    }
  }
  // Web fallback: pattern mimicking notification types
  const patterns: Record<string, number[]> = {
    success: [10, 30, 10],
    warning: [20, 50, 20],
    error: [40, 30, 40, 30, 40],
  };
  webVibrate(patterns[type] ?? [10]);
}

// ─── Public API ───

/** Light impact — button presses, tab switches, subtle interactions. */
export function lightTap() {
  void dispatchImpact("light");
}

/** Medium impact — significant actions (card press, filter toggle, navigation). */
export function mediumTap() {
  void dispatchImpact("medium");
}

/** Heavy impact — critical/emergency actions (SOS, destructive confirmations). */
export function heavyTap() {
  void dispatchImpact("heavy");
}

/** Rigid impact — firm UI snaps (slider stops, toggle flips). */
export function rigidTap() {
  void dispatchImpact("rigid");
}

/** Soft impact — gentle confirmation (like marking read). */
export function softTap() {
  void dispatchImpact("soft");
}

/** Success notification — operation completed successfully. */
export function successNotify() {
  void dispatchNotification("success");
}

/** Warning notification — non-critical issue. */
export function warningNotify() {
  void dispatchNotification("warning");
}

/** Error notification — operation failed. */
export function errorNotify() {
  void dispatchNotification("error");
}

/** Selection tick — for scroll-wheel / picker-like interactions. */
export function selectionTick() {
  void dispatchImpact("light");
}