/**
 * Mapbox token — ported from src/lib/mapbox.functions.ts
 *
 * Web version uses TanStack Start Server Function (createServerFn).
 * Mobile version reads the public token directly from environment variables
 * since Mapbox public tokens are safe to embed in client code.
 *
 * Environment variable:
 *   EXPO_PUBLIC_MAPBOX_TOKEN
 */

let _mapboxModule: any = null;

/**
 * Lazily import @rnmapbox/maps only when MapScreen is rendered.
 * In Expo Go, this module won't be available, so we return null gracefully.
 */
export async function getMapboxModule(): Promise<any> {
  if (_mapboxModule) return _mapboxModule;
  try {
    _mapboxModule = await import("@rnmapbox/maps");
    return _mapboxModule;
  } catch (e) {
    console.warn("[Mapbox] @rnmapbox/maps not available (Expo Go or missing native module)");
    return null;
  }
}

/**
 * Get the Mapbox access token.
 * Returns the public token from environment variables.
 */
export function getMapboxToken(): { token: string } {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
  if (!token) {
    console.warn("[Mapbox] EXPO_PUBLIC_MAPBOX_TOKEN is not set. Map will not render.");
  }
  return { token };
}

/**
 * Default map center (falls back to a generic center if user location is unavailable).
 */
export const MAP_DEFAULT_CENTER = { latitude: 0, longitude: 0 };
export const MAP_DEFAULT_ZOOM = 2;
