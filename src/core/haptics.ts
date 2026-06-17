/**
 * haptics.ts — Centralised haptic feedback utility for Firmanet.
 *
 * Wraps expo-haptics with semantic gesture helpers so every screen
 * and interactive component can provide consistent, delightful tactile
 * feedback.
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

import * as Haptics from "expo-haptics";

/** Light impact — button presses, tab switches, subtle interactions. */
export function lightTap() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* haptics not available on this device */
  }
}

/** Medium impact — significant actions (card press, filter toggle, navigation). */
export function mediumTap() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    /* haptics not available on this device */
  }
}

/** Heavy impact — critical/emergency actions (SOS, destructive confirmations). */
export function heavyTap() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    /* haptics not available on this device */
  }
}

/** Rigid impact — firm UI snaps (slider stops, toggle flips). */
export function rigidTap() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
  } catch {
    /* haptics not available on this device */
  }
}

/** Soft impact — gentle confirmation (like marking read). */
export function softTap() {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  } catch {
    /* haptics not available on this device */
  }
}

/** Success notification — operation completed successfully. */
export function successNotify() {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    /* haptics not available on this device */
  }
}

/** Warning notification — non-critical issue. */
export function warningNotify() {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    /* haptics not available on this device */
  }
}

/** Error notification — operation failed. */
export function errorNotify() {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    /* haptics not available on this device */
  }
}

/** Selection tick — for scroll-wheel / picker-like interactions. */
export function selectionTick() {
  try {
    void Haptics.selectionAsync();
  } catch {
    /* haptics not available on this device */
  }
}