import React, { useEffect, useRef, useState } from "react";
import Map from "../../components/bitacora/Map.jsx";
import useGPS from "../../hooks/useGPS";
import "../../components/bitacora/mapbitacora.css";

// --- API HELPER ---
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("access_token") || localStorage.getItem("auth_token");
  const url = `http://127.0.0.1:8000/api${endpoint}`; // Asegúrate que esta URL es correcta para tu env

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body === "object") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, { method: options.method || "GET", headers, body });
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const contentType = res.headers.get("content-type");
    return contentType && contentType.includes("application/json") ? await res.json() : null;
  } catch (error) {
    console.error("Fetch Error:", error);
    throw error;
  }
}

/* --- CALENDAR MODAL (Glass KPI Style) --- */
function CalendarModal({ onClose, daysWithRoutes, onSelectDate }) {
  const [date, setDate] = useState(new Date());
  const year = date.getFullYear();
  const month = date.getMonth();

  const changeMonth = (val) => setDate(new Date(year, month + val, 1));
  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDay = (y, m) => {
    let day = new Date(y, m, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const days = [];
  const empty = getFirstDay(year, month);
  const total = getDaysInMonth(year, month);
  const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  for (let i = 0; i < empty; i++) days.push(null);
  for (let i = 1; i <= total; i++) days.push(i);

  return (
    <div className="bitacora-calendar-overlay" onClick={onClose}>
      <div className="bitacora-calendar glass" onClick={(e) => e.stopPropagation()}>
        <div className="calendar-header">
          <button onClick={() => changeMonth(-1)}>‹</button>
          <span>{monthNames[month]} {year}</span>
          <button onClick={() => changeMonth(1)}>›</button>
        </div>
        <div className="calendar-grid">
          {["LU","MA","MI","JU","VI","SA","DO"].map(d => <div key={d} className="calendar-weekday">{d}</div>)}
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const hasRoute = daysWithRoutes.includes(dayStr);
            return (
              <div
                key={i}
                className={`calendar-cell ${hasRoute ? "has-route" : ""}`}
                onClick={() => hasRoute && onSelectDate(dayStr)}
              >
                {d}
              </div>
            );
          })}
        </div>
        <button className="btn-close-calendar" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}

/* --- MAIN COMPONENT --- */
export default function TabBitacora({ boatId }) {
  const [mode, setMode] = useState("live");
  const [livePoints, setLivePoints] = useState([]);
  const [gpsPosition, setGpsPosition] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [saving, setSaving] = useState(false);

  // Hook GPS
  const { startGPS, stopGPS, watching, error: gpsError } = useGPS((point) => {
    setGpsPosition(point);
    if (isRecording) {
      setLivePoints((prev) => [...prev, point]);
    }
  });

  useEffect(() => {
    if (mode === "live") startGPS();
    else stopGPS();
  }, [mode]);

  // History State
  const [routes, setRoutes] = useState([]);
  const [filteredRoutes, setFilteredRoutes] = useState([]);
  const [daysWithRoutes, setDaysWithRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [historicPoints, setHistoricPoints] = useState([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState(null);

  // Playback State
  const [playing, setPlaying] = useState(false);
  const [follow, setFollow] = useState(true);
  const [frameInfo, setFrameInfo] = useState({});

  useEffect(() => {
    if (mode === "history") {
      loadRoutesList();
    } else {
      setPlaying(false);
    }
  }, [mode]);

  // --- API ACTIONS ---
  const loadRoutesList = async () => {
    try {
      const data = await apiFetch(`/boats/${boatId}/bitacora/`);

      // FIX CRASH: Aseguramos que data sea un array
      let routesArray = [];
      if (Array.isArray(data)) routesArray = data;
      else if (data && Array.isArray(data.results)) routesArray = data.results;

      setRoutes(routesArray);
      setFilteredRoutes(routesArray); // Inicialmente mostrar todas

      // Extraer fechas únicas para el calendario
      const dates = new Set(routesArray.map(r => r.start_time?.split("T")[0]));
      setDaysWithRoutes(Array.from(dates));

    } catch (e) { console.error("Error loading routes", e); setRoutes([]); }
  };

  const handleSelectDate = (dateStr) => {
    setSelectedDateFilter(dateStr);
    const filtered = routes.filter(r => r.start_time?.startsWith(dateStr));
    setFilteredRoutes(filtered);
    setShowCalendar(false);
    setSelectedRoute(null); // Resetear selección
  };

  const loadRouteDetails = async (route) => {
    try {
      setSelectedRoute(route);
      setPlaying(false);

      // Cargar puntos de la ruta
      // Nota: Si tu API ya devuelve los puntos en la lista, úsalos. Si no, fetch.
      // Asumimos que hay un endpoint detail
      let points = route.points;
      if (!points || points.length === 0) {
          // Si no vinieron en la lista, pedir detalle
          // Ajusta esta URL a tu API real si existe endpoint de detalle
          // const detail = await apiFetch(`/boats/${boatId}/bitacora/${route.id}/`);
          // points = detail.points;
      }

      // IMPORTANTE: navigationRouteViewSet en views.py devuelve 'points' en el serializador?
      // Si el NavigationRouteSerializer tiene 'points', ya los tenemos.
      if(!points) points = []; // Fallback

      setHistoricPoints(points);
    } catch (e) { console.error(e); }
  };

  const exportRoute = (format) => {
    if (!selectedRoute) return;
    const token = localStorage.getItem("access_token");
    const url = `http://127.0.0.1:8000/api/navigation/route/${selectedRoute.id}/export/${format}/?token=${token}`;
    window.open(url, '_blank');
  };

  const saveLiveRoute = async () => {
    if (livePoints.length < 2) return alert("Ruta demasiado corta.");
    const name = prompt("Nombre de la ruta:", `Ruta ${new Date().toLocaleDateString()}`);
    if (!name) return;

    setSaving(true);
    try {
      // 1. Crear Ruta
      const routeData = await apiFetch(`/boats/${boatId}/bitacora/`, {
        method: "POST",
        body: {
          name,
          start_time: new Date(livePoints[0].timestamp).toISOString(),
          end_time: new Date().toISOString()
        }
      });

      // 2. Guardar Puntos (En lotes o uno a uno, aquí uno a uno por simplicidad, idealmente bulk)
      for (const p of livePoints) {
        await apiFetch(`/navigation/route/${routeData.id}/point/`, {
          method: "POST",
          body: {
            lat: p.lat,
            lng: p.lng,
            speed: p.speed || 0,
            type: p.type || 'gps',
            recorded_at: new Date(p.timestamp).toISOString()
          }
        });
      }

      alert("¡Ruta guardada!");
      setLivePoints([]);
      setIsRecording(false);
      setMode("history"); // Ir al historial para verla
    } catch (e) {
      alert("Error guardando ruta: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (window.confirm("¿Detener grabación?")) setIsRecording(false);
    } else {
      if (livePoints.length > 0 && !window.confirm("¿Conservar puntos anteriores?")) {
        setLivePoints([]);
      }
      setIsRecording(true);
    }
  };

  return (
    <div className="bitacora-wrapper">
      <div className="bitacora-map-area">
        <div className="mode-switch glass">
          <span className={mode === "live" ? "active" : ""} onClick={() => setMode("live")}>EN VIVO</span>
          <span className={mode === "history" ? "active" : ""} onClick={() => setMode("history")}>HISTORIAL</span>
        </div>

        <Map
          mode={mode}
          points={mode === "live" ? livePoints : historicPoints}
          currentGpsPosition={gpsPosition}
          playing={playing}
          follow={follow}
          onUpdateFrame={(inf) => {
             if (inf.playing === false) setPlaying(false);
             else setFrameInfo(inf);
          }}
          onAddPoint={(p) => setLivePoints(prev => [...prev, { ...p, speed: 0, timestamp: Date.now() }])}
        />
      </div>

      <div className="bitacora-sidepanel glass">
        {mode === "live" ? (
          <>
            <h2 className="bitacora-title">Navegación en Vivo</h2>
            {gpsError && <div className="error-banner">⚠️ {gpsError}</div>}

            <div className="live-info-grid">
              <div className="info-card">
                  <label>Latitud</label>
                  <span>{gpsPosition ? gpsPosition.lat.toFixed(5) : "--"}</span>
              </div>
              <div className="info-card">
                  <label>Longitud</label>
                  <span>{gpsPosition ? gpsPosition.lng.toFixed(5) : "--"}</span>
              </div>
              <div className="info-card">
                  <label>Velocidad</label>
                  <span style={{color: '#38bdf8'}}>{gpsPosition ? `${(gpsPosition.speed * 1.94).toFixed(1)} kn` : "0.0"}</span>
              </div>
            </div>

            <div className="live-controls">
              {!isRecording ? (
                <button className="btn-primary" onClick={toggleRecording}>● INICIAR RUTA</button>
              ) : (
                <button className="btn-danger" onClick={toggleRecording}>⏸ PAUSAR</button>
              )}
              <button className="btn-success" onClick={saveLiveRoute} disabled={saving || livePoints.length === 0}>
                {saving ? "Guardando..." : "💾 GUARDAR"}
              </button>
            </div>

            <div className="live-table-container">
               {livePoints.slice().reverse().map((p, i) => (
                 <div key={i} className="log-item">
                   <div style={{display:'flex', flexDirection:'column'}}>
                      <span className={`badge ${p.type}`}>{p.type}</span>
                      <small>{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</small>
                   </div>
                   <span>{new Date(p.timestamp || p.recorded_at).toLocaleTimeString()}</span>
                 </div>
               ))}
            </div>
          </>
        ) : (
          /* --- MODO HISTORIAL --- */
          <>
            <div className="history-header">
              <h2 className="bitacora-title">Historial</h2>
              <button className="btn-icon" onClick={() => setShowCalendar(true)}>📅</button>
            </div>

            {selectedDateFilter && (
                <div className="filter-chip">
                    📅 {selectedDateFilter}
                    <span onClick={() => { setSelectedDateFilter(null); setFilteredRoutes(routes); }}>✕</span>
                </div>
            )}

            {selectedRoute ? (
              <div className="route-detail-view">
                <button className="btn-back" onClick={() => { setSelectedRoute(null); setHistoricPoints([]); setPlaying(false); }}>
                  ← Volver a la lista
                </button>

                <h3>{selectedRoute.name}</h3>
                <div className="playback-controls glass">
                   <div className="playback-buttons">
                       <button className="btn-play" onClick={() => setPlaying(!playing)}>
                           {playing ? "⏸" : "▶"}
                       </button>
                       <button className="btn-stop" onClick={() => { setPlaying(false); setFrameInfo({}); }}>⏹</button>
                   </div>
                   <label className="toggle-follow">
                       <input type="checkbox" checked={follow} onChange={e=>setFollow(e.target.checked)}/>
                       Seguir cámara
                   </label>

                   <div className="playback-info">
                       <p>🕒 {frameInfo.timestamp ? new Date(frameInfo.timestamp).toLocaleTimeString() : "--:--"}</p>
                       <p>🌊 {frameInfo.speed ? (frameInfo.speed * 1.94).toFixed(1) : 0} kn</p>
                   </div>
                </div>

                <div className="export-actions">
                    <button onClick={() => exportRoute('gpx')}>📄 GPX</button>
                    <button onClick={() => exportRoute('kml')}>🌎 KML</button>
                </div>
              </div>
            ) : (
              <div className="history-list">
                {filteredRoutes.length === 0 ? (
                    <p style={{color:'#64748b', textAlign:'center', marginTop:'20px'}}>No hay rutas para mostrar.</p>
                ) : (
                    filteredRoutes.map(r => (
                    <div key={r.id} className="route-item" onClick={() => loadRouteDetails(r)}>
                        <div className="route-icon">🗺️</div>
                        <div className="route-meta">
                            <strong>{r.name || "Sin nombre"}</strong>
                            <small>{new Date(r.start_time).toLocaleDateString()} - {new Date(r.start_time).toLocaleTimeString()}</small>
                        </div>
                        <div className="route-arrow">›</div>
                    </div>
                    ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showCalendar && (
        <CalendarModal
          onClose={() => setShowCalendar(false)}
          daysWithRoutes={daysWithRoutes}
          onSelectDate={handleSelectDate}
        />
      )}
    </div>
  );
}