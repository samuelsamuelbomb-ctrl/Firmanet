/**
 * haptics.ts — Web-only haptic feedback utility for Firmanet.
 *
 * Uses Web Vibration API for web.
 *
 * Respects user's vibration strength setting and quiet hours.
 */

import { useSettingsStore } from "./settingsStore";
import { isQuietHoursNow } from "./settingsStore";

const canVibrateWeb =
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

function shouldSuppressHaptics(): boolean {
  try {
    const state = useSettingsStore.getState();
    if (state.loaded && state.quietHours) {
      return isQuietHoursNow();
    }
  } catch (e) {
    console.log("[Haptics] store not ready", e);
  }
  return false;
}

function getVibrationScale(): number {
  try {
    const state = useSettingsStore.getState();
    if (state.loaded) {
      return Math.max(0, Math.min(1, state.vibration / 100));
    }
  } catch (e) {
    console.log("[Haptics] store not ready", e);
  }
  return 1;
}

function applyScaleToPattern(pattern: number | number[], scale: number): number | number[] {
  if (scale <= 0) return 0;
  if (scale >= 1) return pattern;

  if (typeof pattern === "number") {
    return Math.round(pattern * scale);
  }

  return pattern.map((v) => Math.round(v * scale));
}

function vibrateWeb(pattern: number | number[]) {
  if (canVibrateWeb) {
    try {
      const scale = getVibrationScale();
      const scaledPattern = applyScaleToPattern(pattern, scale);
      if (scaledPattern === 0 || (Array.isArray(scaledPattern) && scaledPattern.length === 0)) return;
      console.log("[Haptics] Web vibrate", scaledPattern);
      navigator.vibrate(scaledPattern);
    } catch (e) {
      console.log("[Haptics] Web vibrate failed", e);
    }
  }
}

/** Light tap (subtle)
 */
export function lightTap() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  vibrateWeb(10);
}

/** Medium tap (noticeable but gentle)
 */
export function mediumTap() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  vibrateWeb(20);
}

/** Heavy tap (strong but not aggressive)
 */
export function heavyTap() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  vibrateWeb([30, 20, 30]);
}

export function rigidTap() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  vibrateWeb(15);
}

export function softTap() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  vibrateWeb(8);
}

export function successNotify() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  vibrateWeb([10, 30, 10]);
}

export function warningNotify() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  vibrateWeb([20, 50, 20]);
}

export function errorNotify() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  vibrateWeb([40, 30, 40]);
}

export function selectionTick() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  vibrateWeb(10);
}
