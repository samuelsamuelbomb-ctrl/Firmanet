/**
 * haptics.ts — Cross-platform haptic feedback utility for Firmanet.
 *
 * Uses the Web Vibration API (navigator.vibrate) which works on:
 *   - Web browsers (Chrome, Firefox, Edge, Safari 17.4+)
 *   - React Native (when available via the same API)
 *
 * No native dependencies required, so it works seamlessly on Vercel/Expo.
 *
 * Usage:
 *   import { lightTap, mediumTap, heavyTap, successNotify, selectionTick } from "../core/haptics";
 *
 *   lightTap();    // Button press, tab switch, subtle UI action
 *   mediumTap();   // Significant action (card press, filter toggle)
 *   heavyTap();    // SOS, critical/emergency action
 *   successNotify(); // Operation succeeded (submit, confirm)
 *   warningNotify(); // Something needs attention
 *   errorNotify();   // Something went wrong
 *   selectionTick(); // Slider stop, toggle, selection change
 */

const canVibrate =
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

function vibrate(pattern: number | number[]) {
  if (canVibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* vibration not supported */
    }
  }
}

/** Light impact — button presses, tab switches, subtle interactions. */
export function lightTap() {
  vibrate(10);
}

/** Medium impact — significant actions (card press, filter toggle, navigation). */
export function mediumTap() {
  vibrate(20);
}

/** Heavy impact — critical/emergency actions (SOS, destructive confirmations). */
export function heavyTap() {
  vibrate(40);
}

/** Rigid impact — firm UI snaps (slider stops, toggle flips). */
export function rigidTap() {
  vibrate(15);
}

/** Soft impact — gentle confirmation (like marking read). */
export function softTap() {
  vibrate(8);
}

/** Success notification — operation completed successfully. */
export function successNotify() {
  vibrate([10, 30, 10]);
}

/** Warning notification — non-critical issue. */
export function warningNotify() {
  vibrate([20, 50, 20]);
}

/** Error notification — operation failed. */
export function errorNotify() {
  vibrate([40, 30, 40, 30, 40]);
}

/** Selection tick — for scroll-wheel / picker-like interactions. */
export function selectionTick() {
  vibrate(10);
}