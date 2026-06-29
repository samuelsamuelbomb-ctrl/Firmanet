/**
 * Mapbox token — ported from src/lib/mapbox.functions.ts
 *
 * Web version uses TanStack Start Server Function (createServerFn).
 * Mobile version reads the public token directly from environment variables
 * since Mapbox public tokens are safe to embed in client code.
 *
 * Environment variable:
 *   EXPO_PUBLIC_MAPBOX_TOKEN
 *
 * FIXED: Default center uses Ikeja, Lagos (Nigeria) coordinates.
 */

let _mapboxModule: any = null;

/**
 * Check if we're running in Expo Go (since it doesn't support custom native modules
 */
function isExpoGo(): boolean {
  try {
    const Constants = require('expo-constants');
    return Constants.executionEnvironment === 'standalone' ? false : true;
  } catch (e) {
    return true;
  }
}

/**
 * Lazily import @rnmapbox/maps only when MapScreen is rendered.
 * In Expo Go, this module won't be available, so we return null gracefully.
 */
export async function getMapboxModule(): Promise<any> {
  if (_mapboxModule) return _mapboxModule;
  
  // Check if we're in Expo Go first, if yes, skip trying to import
  if (isExpoGo()) {
    console.warn("[Mapbox] Running in Expo Go - skipping native map import");
    return null;
  }
  
  try {
    // Use a try-catch around dynamic import
    _mapboxModule = await import(/* @vite-ignore */ "@rnmapbox/maps");
    return _mapboxModule;
  } catch (e) {
    console.warn("[Mapbox] @rnmapbox/maps not available (Expo Go or missing native module");
    return null;
  }
}

/**
 * Get the Mapbox access token.
 * Returns the public token from environment variables.
 *
 * Tries (in order):
 *   1. process.env.EXPO_PUBLIC_MAPBOX_TOKEN (web / dev builds)
 *   2. process.env.MAPBOX_PUBLIC_TOKEN (fallback)
 *   3. expo-constants manifest.extra (Expo Go)
 */
function getConstantsValue(key: string): string | undefined {
  try {
    const Constants = require("expo-constants");
    return Constants?.expoConfig?.extra?.[key] ?? undefined;
  } catch {
    return undefined;
  }
}

export function getMapboxToken(): { token: string } {
  const token =
    process.env.EXPO_PUBLIC_MAPBOX_TOKEN ??
    process.env.MAPBOX_PUBLIC_TOKEN ??
    getConstantsValue("EXPO_PUBLIC_MAPBOX_TOKEN") ??
    "";
  if (!token) {
    console.warn("[Mapbox] No Mapbox token found. Set EXPO_PUBLIC_MAPBOX_TOKEN in .env");
  }
  return { token };
}

/**
 * Default map center (Ikeja, Lagos, Nigeria).
 */
export const MAP_DEFAULT_CENTER = { latitude: 6.6018, longitude: 3.3515 };
export const MAP_DEFAULT_ZOOM = 12;

/**
 * Clean up mapbox module (for reset/testing).
 */
export function resetMapboxModule() {
  _mapboxModule = null;
}