import { useState, useEffect, useRef, useCallback } from "react";

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

/**
 * Shared hook that tracks the user's real GPS location.
 * Falls back to IP-based geolocation if GPS is unavailable or denied.
 * Attempts reverse geocoding via Mapbox if a token is available.
 */
export function useUserLocation(): UseUserLocationReturn {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Load Mapbox token once
  useEffect(() => {
    const t =
      process.env.EXPO_PUBLIC_MAPBOX_TOKEN ??
      process.env.MAPBOX_PUBLIC_TOKEN ??
      "";
    tokenRef.current = t || null;
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
      if (lat && lng) {
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
    if (!("geolocation" in navigator)) {
      setError("This device has no GPS / geolocation API.");
      void tryIpFallback().then(() => setLoading(false));
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const name = await resolveLocationName(lat, lng);
        setLocation({ latitude: lat, longitude: lng, locationName: name });
        setError(null);
        setLoading(false);
      },
      async (err) => {
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
  }, [resolveLocationName, tryIpFallback]);

  // Start watching on mount
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      void tryIpFallback().then(() => setLoading(false));
      return;
    }

    // Immediate one-shot
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const name = await resolveLocationName(lat, lng);
        setLocation({ latitude: lat, longitude: lng, locationName: name });
        setError(null);
        setLoading(false);
      },
      async (err) => {
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
  }, [resolveLocationName, tryIpFallback]);

  return { location, error, loading, refresh };
}