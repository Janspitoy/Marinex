import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import ReactDOM from "react-dom/client";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

// Token (Idealmente mover a .env)
mapboxgl.accessToken = "pk.eyJ1IjoiaXZhbmtsaXVjaHkiLCJhIjoiY21pbXlyMGZkMXJlMDNlcjRlaWM4c2oxNCJ9.jgdSXuD2E_Hs1i36MbS2Eg";

// Icono del barco
const BOAT_ICON_URL = "https://cdn-icons-png.flaticon.com/512/2950/2950666.png"; // O usa tu SVG base64

const PopupActions = ({ onSelect, placeName, lat, lng }) => (
  <div className="map-popup-actions">
    {placeName && <strong style={{ display: 'block', marginBottom: '5px', color: 'white' }}>{placeName}</strong>}
    <small style={{ color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
      {lat.toFixed(5)}, {lng.toFixed(5)}
    </small>
    <button onClick={() => onSelect("start")}>🏁 Punto A (Inicio)</button>
    <button onClick={() => onSelect("end")}>🏁 Punto B (Fin)</button>
    <button onClick={() => onSelect("stop")}>⚓ Parada / Waypoint</button>
  </div>
);

// Función matemática para calcular rotación del barco
function getBearing(startLat, startLng, destLat, destLng) {
  const startLatRad = (startLat * Math.PI) / 180;
  const startLngRad = (startLng * Math.PI) / 180;
  const destLatRad = (destLat * Math.PI) / 180;
  const destLngRad = (destLng * Math.PI) / 180;

  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
  const x =
    Math.cos(startLatRad) * Math.sin(destLatRad) -
    Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export default function Map({ mode, points = [], currentGpsPosition, playing, onUpdateFrame, follow, onAddPoint }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const userMarkerRef = useRef(null);
  const markersRef = useRef([]); // Para marcadores estáticos (Start, End, Stop)
  const boatMarkerRef = useRef(null); // Elemento DOM para el barco
  const animationRef = useRef(null);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);

  // Índices para animación
  const playbackIndexRef = useRef(0);

  // --- 1. Inicialización del Mapa ---
  useEffect(() => {
    if (mapRef.current) return;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/navigation-night-v1",
      center: [2.65, 39.55],
      zoom: 9,
    });
    mapRef.current = map;

    // Controles
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      marker: false,
      placeholder: "Buscar...",
      collapsed: false,
      language: 'es,en'
    });
    map.addControl(geocoder, "top-left");
    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    geocoder.on('result', (e) => {
      const coords = e.result.center;
      createPopup({ lng: coords[0], lat: coords[1] }, map, e.result.text);
    });

    map.on("style.load", () => {
      // Fuente para la línea de ruta
      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: [] } },
      });
      map.addLayer({
        id: "route-layer",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#38bdf8", "line-width": 4, "line-opacity": 0.8 },
      });
      setIsStyleLoaded(true);
    });

    map.on("click", (e) => createPopup(e.lngLat, map));

    // Crear elemento DOM para el barco (History Mode)
    const el = document.createElement('div');
    el.className = 'boat-marker';
    el.style.backgroundImage = `url(${BOAT_SVG_URI})`; // Usamos el SVG de abajo
    el.style.width = '40px';
    el.style.height = '40px';
    el.style.backgroundSize = 'contain';
    el.style.display = 'none'; // Oculto por defecto

    // Lo añadimos al mapa pero sin posición inicial
    boatMarkerRef.current = new mapboxgl.Marker({ element: el, rotationAlignment: 'map' })
        .setLngLat([0,0])
        .addTo(map);

    return () => {
        map.remove();
        mapRef.current = null;
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Helper popup
  const createPopup = (lngLat, map, placeName = null) => {
    const popupNode = document.createElement("div");
    const popup = new mapboxgl.Popup({ closeButton: false, className: 'custom-popup', maxWidth: '300px' })
      .setLngLat(lngLat)
      .setDOMContent(popupNode)
      .addTo(map);

    const root = ReactDOM.createRoot(popupNode);
    root.render(
      <PopupActions
        placeName={placeName}
        lat={lngLat.lat}
        lng={lngLat.lng}
        onSelect={(type) => {
          onAddPoint({ lat: lngLat.lat, lng: lngLat.lng, type });
          popup.remove();
        }}
      />
    );
    popup.on('close', () => setTimeout(() => { try { root.unmount(); } catch (e) { } }, 0));
  };

  // --- 2. Manejo de GPS en Vivo ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "live") return;

    if (currentGpsPosition && typeof currentGpsPosition.lat === 'number') {
      const coords = [currentGpsPosition.lng, currentGpsPosition.lat];

      // Actualizar marcador de usuario (círculo azul)
      if (!userMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "gps-user-marker";
        userMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat(coords).addTo(map);
      } else {
        userMarkerRef.current.setLngLat(coords);
      }

      if (follow) {
        map.easeTo({ center: coords, zoom: 15, duration: 1000 });
      }
    }
  }, [currentGpsPosition, mode, follow]);

  // --- 3. Dibujado de Ruta y Marcadores (Live & History) ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoaded || !map.getSource("route")) return;

    // Limpiar marcadores viejos
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Validar puntos
    const validPoints = Array.isArray(points) ? points.filter(p => p && typeof p.lat === 'number') : [];
    const coords = validPoints.map((p) => [p.lng, p.lat]);

    // Actualizar Línea Azul
    map.getSource("route").setData({
      type: "Feature", geometry: { type: "LineString", coordinates: coords },
    });

    // Agregar marcadores especiales (Inicio, Fin, Paradas)
    validPoints.forEach((p, index) => {
      let color = null;
      let element = null;

      // Lógica de colores/iconos
      if (index === 0) color = '#22c55e'; // Inicio Verde
      else if (index === validPoints.length - 1 && mode === 'history') color = '#ef4444'; // Fin Rojo
      else if (p.type === 'stop' || p.type === 'anchor') color = '#f59e0b'; // Parada Naranja

      if (color) {
        const marker = new mapboxgl.Marker({ color, scale: 0.8 })
          .setLngLat([p.lng, p.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }
    });

    // Ajustar cámara si es historial y no se está reproduciendo
    if (mode === "history" && coords.length > 1 && !playing && playbackIndexRef.current === 0) {
      const bounds = coords.reduce((bounds, coord) => bounds.extend(coord), new mapboxgl.LngLatBounds(coords[0], coords[0]));
      map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
    }
  }, [points, mode, isStyleLoaded]); // Quitamos 'playing' de deps para no resetear en pausa

  // --- 4. Lógica de Reproducción (Animation Loop) ---
  useEffect(() => {
    if (!playing) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const animate = () => {
      if (playbackIndexRef.current >= points.length - 1) {
        // Fin de la reproducción
        onUpdateFrame({ playing: false });
        playbackIndexRef.current = 0; // Resetear o dejar al final
        return;
      }

      const currentIndex = Math.floor(playbackIndexRef.current);
      const nextIndex = currentIndex + 1;

      const p1 = points[currentIndex];
      const p2 = points[nextIndex];

      if (p1 && p2) {
        // Actualizar Info al padre
        onUpdateFrame({
          playing: true,
          timestamp: p1.recorded_at || p1.timestamp,
          speed: p1.speed,
          currentPos: p1
        });

        // Mover marcador del barco
        const boatEl = boatMarkerRef.current.getElement();
        boatEl.style.display = 'block';

        boatMarkerRef.current.setLngLat([p1.lng, p1.lat]);

        // Calcular rotación
        const rotation = getBearing(p1.lat, p1.lng, p2.lat, p2.lng);
        boatMarkerRef.current.setRotation(rotation);

        // Seguir cámara
        if (follow && mapRef.current) {
            mapRef.current.easeTo({ center: [p1.lng, p1.lat], zoom: 14, duration: 0 });
        }
      }

      // Avanzar índice (velocidad variable)
      // Ajusta '0.2' para cambiar la velocidad de reproducción
      playbackIndexRef.current += 0.5;

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, [playing, points, follow]);

  // Resetear índice al cambiar de ruta
  useEffect(() => {
      playbackIndexRef.current = 0;
      if(boatMarkerRef.current) boatMarkerRef.current.getElement().style.display = 'none';
  }, [points]);

  return <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />;
}

// SVG del Barco para el marcador
const BOAT_SVG_URI = "data:image/svg+xml;base64," + btoa(`
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 2 L42 20 L32 58 L22 20 Z" fill="#38bdf8" stroke="white" stroke-width="2"/>
  <circle cx="32" cy="40" r="4" fill="white"/>
</svg>`);