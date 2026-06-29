/**
 * haptics.ts — Cross-platform haptic feedback utility for Firmanet.
 *
 * Uses expo-haptics (nicer feedback) for React Native, falls back to Web Vibration API for web.
 *
 * Respects user's vibration strength setting and quiet hours.
 */

import { useSettingsStore } from "./settingsStore";
import { isQuietHoursNow } from "./settingsStore";
import { Platform } from "react-native";

let Haptics: any = null;
let ImpactStyle: any = {
  Light: "light",
  Medium: "medium",
  Heavy: "heavy",
  Rigid: "rigid",
  Soft: "soft",
};
let NotificationType: any = {
  Success: "success",
  Warning: "warning",
  Error: "error",
};

if (Platform.OS !== "web") {
  try {
    const expoHaptics = require("expo-haptics");
    Haptics = expoHaptics.default || expoHaptics;
    if (expoHaptics.ImpactStyle) {
      ImpactStyle = expoHaptics.ImpactStyle;
    }
    if (expoHaptics.NotificationType) {
      NotificationType = expoHaptics.NotificationType;
    }
    console.log("[Haptics] expo-haptics loaded (nice haptics mode)");
  } catch (e) {
    console.log("[Haptics] expo-haptics not available", e);
  }
}

const canVibrateWeb =
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
const canVibrateNative = !!Haptics;

console.log("[Haptics] Platform:", Platform.OS, "canVibrateNative:", canVibrateNative);

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
  if (canVibrateNative) {
    const style = scale < 0.3 ? ImpactStyle.Light : scale < 0.7 ? ImpactStyle.Medium : ImpactStyle.Heavy;
    try {
      Haptics.impactAsync(style);
    } catch (e) {
      console.log("[Haptics] lightTap failed, falling back to web vibration", e);
      vibrateWeb(10);
    }
  } else {
    vibrateWeb(10);
  }
}

/** Medium tap (noticeable but gentle)
 */
export function mediumTap() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  if (canVibrateNative) {
    const style = scale < 0.3 ? ImpactStyle.Light : scale < 0.7 ? ImpactStyle.Medium : ImpactStyle.Heavy;
    try {
      Haptics.impactAsync(style);
    } catch (e) {
      console.log("[Haptics] mediumTap failed, falling back to web vibration", e);
      vibrateWeb(20);
    }
  } else {
    vibrateWeb(20);
  }
}

/** Heavy tap (strong but not aggressive)
 */
export function heavyTap() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  if (canVibrateNative) {
    const style = scale < 0.3 ? ImpactStyle.Medium : scale < 0.7 ? ImpactStyle.Heavy : ImpactStyle.Rigid;
    try {
      Haptics.impactAsync(style);
    } catch (e) {
      console.log("[Haptics] heavyTap failed, falling back to web vibration", e);
      vibrateWeb([30, 20, 30]);
    }
  } else {
    vibrateWeb([30, 20, 30]);
  }
}

export function rigidTap() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  if (canVibrateNative) {
    const style = scale < 0.3 ? ImpactStyle.Light : scale < 0.7 ? ImpactStyle.Medium : ImpactStyle.Rigid;
    try {
      Haptics.impactAsync(style);
    } catch (e) {
      console.log("[Haptics] rigidTap failed, falling back to web vibration", e);
      vibrateWeb(15);
    }
  } else {
    vibrateWeb(15);
  }
}

export function softTap() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  if (canVibrateNative) {
    const style = scale < 0.3 ? ImpactStyle.Soft : scale < 0.7 ? ImpactStyle.Light : ImpactStyle.Medium;
    try {
      Haptics.impactAsync(style);
    } catch (e) {
      console.log("[Haptics] softTap failed, falling back to web vibration", e);
      vibrateWeb(8);
    }
  } else {
    vibrateWeb(8);
  }
}

export function successNotify() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  if (canVibrateNative) {
    const type = scale < 0.3 ? NotificationType.Success : scale < 0.7 ? NotificationType.Warning : NotificationType.Error;
    try {
      Haptics.notificationAsync(type);
    } catch (e) {
      console.log("[Haptics] successNotify failed, falling back to web vibration", e);
      vibrateWeb([10, 30, 10]);
    }
  } else {
    vibrateWeb([10, 30, 10]);
  }
}

export function warningNotify() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  if (canVibrateNative) {
    const type = scale < 0.3 ? NotificationType.Success : scale < 0.7 ? NotificationType.Warning : NotificationType.Error;
    try {
      Haptics.notificationAsync(type);
    } catch (e) {
      console.log("[Haptics] warningNotify failed, falling back to web vibration", e);
      vibrateWeb([20, 50, 20]);
    }
  } else {
    vibrateWeb([20, 50, 20]);
  }
}

export function errorNotify() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  if (canVibrateNative) {
    const type = scale < 0.3 ? NotificationType.Warning : NotificationType.Error;
    try {
      Haptics.notificationAsync(type);
    } catch (e) {
      console.log("[Haptics] errorNotify failed, falling back to web vibration", e);
      vibrateWeb([40, 30, 40]);
    }
  } else {
    vibrateWeb([40, 30, 40]);
  }
}

export function selectionTick() {
  if (shouldSuppressHaptics()) return;
  const scale = getVibrationScale();
  if (scale === 0) return;
  if (canVibrateNative) {
    try {
      Haptics.selectionAsync();
    } catch (e) {
      console.log("[Haptics] selectionTick failed, falling back to web vibration", e);
      vibrateWeb(10);
    }
  } else {
    vibrateWeb(10);
  }
}
