import { useEffect, useRef, useState } from "react";

export default function useGPS(onPoint = () => {}) {
  const [trackingPoint, setTrackingPoint] = useState(null);
  const [watching, setWatching] = useState(false);

  const watchIdRef = useRef(null);

  function stopGPS() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWatching(false);
  }

  function startGPS() {
    if (!("geolocation" in navigator)) {
      console.warn("GPS no soportado");
      return;
    }

    stopGPS();

    setWatching(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        // Защита от нулевых координат или ошибок браузера
        if (!pos.coords || typeof pos.coords.latitude !== 'number') return;

        const point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speed: pos.coords.speed ?? 0,
          accuracy: pos.coords.accuracy ?? null,
          heading: pos.coords.heading ?? null,
          timestamp: Date.now(),
          type: "gps" // Явно указываем тип
        };

        setTrackingPoint(point);
        onPoint(point);
      },
      (err) => {
        console.error("GPS error:", err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  useEffect(() => {
    return () => stopGPS();
  }, []);

  return { trackingPoint, watching, startGPS, stopGPS };
}