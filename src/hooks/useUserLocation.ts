import { useState, useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";

export interface UserLocation {
  latitude: number;
  longitude: number;
  /** Human-readable location name, e.g. "Surulere, Lagos" or "Current Location" */
  locationName: string;
}

interface UseUserLocationReturn {
  location: UserLocation | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

// Lazy-load expo-location on native platforms (Expo Go / dev builds)
type ExpoLocationModule = {
  requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
  getCurrentPositionAsync: (opts: {}) => Promise<{ coords: { latitude: number; longitude: number } }>;
  watchPositionAsync: (opts: {}, callback: (pos: { coords: { latitude: number; longitude: number } }) => void) => Promise<{ remove: () => void }>;
};

let _expoLocation: ExpoLocationModule | null = null;
async function getExpoLocation(): Promise<ExpoLocationModule | null> {
  if (_expoLocation) return _expoLocation;
  try {
    _expoLocation = await import("expo-location");
    return _expoLocation;
  } catch {
    return null;
  }
}

// Lazy-load Constants to read env vars in Expo Go
let _Constants: any = null;
function getConstantsEnv(key: string): string | undefined {
  // expo-constants has the environment variables in manifest.extra
  if (!_Constants) {
    try {
      _Constants = require("expo-constants");
    } catch {
      return undefined;
    }
  }
  return _Constants?.expoConfig?.extra?.[key] ?? undefined;
}

/**
 * Shared hook that tracks the user's real GPS location.
 *
 * On native (Expo Go / dev builds): uses expo-location
 * On web: uses navigator.geolocation
 * Falls back to IP-based geolocation if both are unavailable or denied.
 * Attempts reverse geocoding via Mapbox if a token is available.
 */
export function useUserLocation(): UseUserLocationReturn {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const watchSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const tokenRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  // Load Mapbox token via chain: process.env (web) -> Constants.manifest.extra (Expo Go)
  useEffect(() => {
    const t =
      process.env.EXPO_PUBLIC_MAPBOX_TOKEN ??
      process.env.MAPBOX_PUBLIC_TOKEN ??
      getConstantsEnv("EXPO_PUBLIC_MAPBOX_TOKEN") ??
      "";
    tokenRef.current = t || null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Reverse geocode via Mapbox
  const resolveLocationName = useCallback(
    async (lat: number, lng: number): Promise<string> => {
      const token = tokenRef.current;
      if (!token) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=locality,place,neighborhood,address&limit=1`,
        );
        if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        const data = await res.json();
        if (data?.features?.[0]?.place_name) {
          return data.features[0].place_name;
        }
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      } catch {
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
    },
    [],
  );

  // IP-based geolocation fallback
  const tryIpFallback = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("https://ipinfo.io/json");
      if (!res.ok) return false;
      const data = await res.json();
      const [lat, lng] = (data.loc as string)?.split(",") ?? [];
      if (lat && lng && mountedRef.current) {
        const name = data.city
          ? `${data.city}, ${data.region || data.country}`
          : `${lat.trim()}, ${lng.trim()}`;
        setLocation({
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
          locationName: name,
        });
        setError(null);
        return true;
      }
    } catch {
      // IP fallback failed silently
    }
    return false;
  }, []);

  // Manual refresh
  const refresh = useCallback(() => {
    setLoading(true);
    if (Platform.OS === "web" && "geolocation" in navigator) {
      // Web path
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (!mountedRef.current) return;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const name = await resolveLocationName(lat, lng);
          setLocation({ latitude: lat, longitude: lng, locationName: name });
          setError(null);
          setLoading(false);
        },
        async (err) => {
          if (!mountedRef.current) return;
          const ipOk = await tryIpFallback();
          if (!ipOk) {
            setError(
              err.code === err.PERMISSION_DENIED
                ? "Location permission denied. Enable it in your browser settings."
                : err.message || "Couldn't get location.",
            );
          }
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
      );
    } else {
      // Native path — use expo-location
      void (async () => {
        try {
          const loc = await getExpoLocation();
          if (!loc) {
            // expo-location not available, try IP fallback
            const ipOk = await tryIpFallback();
            if (!ipOk && mountedRef.current) {
              setError("Location services not available on this device.");
            }
            setLoading(false);
            return;
          }
          const { status } = await loc.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            if (mountedRef.current) setError("Location permission denied. Enable it in your device settings.");
            setLoading(false);
            return;
          }
          const pos = await loc.getCurrentPositionAsync({});
          if (!mountedRef.current) return;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const name = await resolveLocationName(lat, lng);
          setLocation({ latitude: lat, longitude: lng, locationName: name });
          setError(null);
          setLoading(false);
        } catch {
          if (mountedRef.current) {
            const ipOk = await tryIpFallback();
            if (!ipOk) setError("Couldn't get location. Check GPS and permissions.");
          }
          setLoading(false);
        }
      })();
    }
  }, [resolveLocationName, tryIpFallback]);

  // Start watching on mount
  useEffect(() => {
    setLoading(true);

    if (Platform.OS === "web" && "geolocation" in navigator) {
      // ── Web: navigator.geolocation ──
      // Immediate one-shot
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (!mountedRef.current) return;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const name = await resolveLocationName(lat, lng);
          setLocation({ latitude: lat, longitude: lng, locationName: name });
          setError(null);
          setLoading(false);
        },
        async (err) => {
          if (!mountedRef.current) return;
          const ipOk = await tryIpFallback();
          if (!ipOk) {
            setError(
              err.code === err.PERMISSION_DENIED
                ? "Location permission denied."
                : err.message || "Couldn't get location.",
            );
          }
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
      );

      // Continuous watch
      const watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          if (!mountedRef.current) return;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const name = await resolveLocationName(lat, lng);
          setLocation({ latitude: lat, longitude: lng, locationName: name });
          setError(null);
          setLoading(false);
        },
        () => {
          // Watch errors are expected (timeout etc.), keep last known coords
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
      );
      watchIdRef.current = watchId;

      return () => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
      };
    } else {
      // ── Native: expo-location ──
      void (async () => {
        try {
          const loc = await getExpoLocation();
          if (!loc) {
            const ipOk = await tryIpFallback();
            if (!ipOk && mountedRef.current) {
              setError("Location services not available on this device.");
            }
            setLoading(false);
            return;
          }

          const { status } = await loc.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            if (mountedRef.current) setError("Location permission denied. Enable it in your device settings.");
            setLoading(false);
            return;
          }

          // One-shot
          const pos = await loc.getCurrentPositionAsync({});
          if (mountedRef.current) {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const name = await resolveLocationName(lat, lng);
            setLocation({ latitude: lat, longitude: lng, locationName: name });
            setError(null);
            setLoading(false);
          }

          // Continuous watch (expo-location returns a subscription object)
          const sub = await loc.watchPositionAsync(
            { enableHighAccuracy: true, timeInterval: 5_000, distanceInterval: 10 },
            (p: any) => {
              if (!mountedRef.current) return;
              const lat = p.coords.latitude;
              const lng = p.coords.longitude;
              resolveLocationName(lat, lng).then((name) => {
                if (mountedRef.current) {
                  setLocation({ latitude: lat, longitude: lng, locationName: name });
                  setError(null);
                }
              });
            },
          );
          watchSubscriptionRef.current = sub;
        } catch {
          if (mountedRef.current) {
            const ipOk = await tryIpFallback();
            if (!ipOk) setError("Couldn't get location. Check GPS and permissions.");
          }
          setLoading(false);
        }
      })();

      return () => {
        if (watchSubscriptionRef.current) {
          watchSubscriptionRef.current.remove();
          watchSubscriptionRef.current = null;
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { location, error, loading, refresh };
}