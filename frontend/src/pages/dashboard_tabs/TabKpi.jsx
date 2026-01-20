import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api';

/* --- 1. MODAL PARA AÑADIR RÁPIDO (MEJORADO) --- */
function QuickAddModal({ isOpen, onClose, date, boatId, onSave }) {
  const [type, setType] = useState('task'); // 'task' | 'work'
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);

  // Opciones cargadas del servidor
  const [statusOptions, setStatusOptions] = useState({ tasks: [], works: [] });

  // Formulario
  const [formData, setFormData] = useState({
    title: '',
    time: '09:00',
    priority: 'medium', // Solo para tareas
    statusId: '',       // ID del estado seleccionado
  });

  // Al abrir, reseteamos y cargamos estados
  useEffect(() => {
    if (isOpen) {
      setFormData({ title: '', time: '09:00', priority: 'medium', statusId: '' });
      setType('task');
      fetchStatuses();
    }
  }, [isOpen]);

  const fetchStatuses = async () => {
    setInitializing(true);
    try {
      const [resTaskStatus, resWorkStatus] = await Promise.all([
        api.get('/task-statuses/'),
        api.get('/work-statuses/')
      ]);
      const tasks = resTaskStatus.data.results || resTaskStatus.data || [];
      const works = resWorkStatus.data.results || resWorkStatus.data || [];

      setStatusOptions({ tasks, works });

      // Pre-seleccionar un estado por defecto (Pending / Planned)
      const defaultTaskStatus = tasks.find(s => ['pending','pendiente','new'].includes(s.code))?.id || (tasks[0]?.id);
      setFormData(prev => ({ ...prev, statusId: defaultTaskStatus }));

    } catch (e) {
      console.error("Error fetching statuses:", e);
    } finally {
      setInitializing(false);
    }
  };

  // Al cambiar de Tarea a Trabajo, actualizamos el estado por defecto
  const handleTypeChange = (newType) => {
      setType(newType);
      const list = newType === 'task' ? statusOptions.tasks : statusOptions.works;
      // Buscamos un estado default lógico
      const codeTarget = newType === 'task' ? ['pending','pendiente'] : ['planned','planificado'];
      const defaultStatus = list.find(s => codeTarget.includes(s.code))?.id || (list[0]?.id) || '';

      setFormData(prev => ({ ...prev, statusId: defaultStatus }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !date) return;
    setLoading(true);

    try {
      // Combinar Fecha seleccionada + Hora seleccionada
      const dateTime = `${date}T${formData.time}:00`;

      if (type === 'task') {
        await api.post(`/boats/${boatId}/tasks/`, {
          title: formData.title,
          due_date: dateTime,
          priority: formData.priority,
          status: formData.statusId,
          description: 'Creado desde Calendario KPI'
        });
      } else {
        await api.post(`/boats/${boatId}/works/`, {
          title: formData.title,
          start_date: dateTime,
          end_date: dateTime, // Mismo inicio y fin por defecto
          status: formData.statusId,
          cost_estimate: 0,
          description: 'Trabajo planificado desde Calendario KPI'
        });
      }
      onSave(); // Recargar datos
      onClose();
    } catch (error) {
      console.error("Error creating item:", error);
      alert("Error al crear el evento.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const activeStatusList = type === 'task' ? statusOptions.tasks : statusOptions.works;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{maxWidth: '450px'}}>
        <div className="modal-header">
            <h3>Nuevo Evento: {date}</h3>
            <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {initializing ? (
          <div style={{padding: '20px', textAlign: 'center', color: '#6b7280'}}>Cargando opciones...</div>
        ) : (
          <form onSubmit={handleSubmit}>
              {/* SELECTOR TIPO */}
              <div className="form-group">
                  <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
                      <button
                        type="button"
                        className={`btn ${type === 'task' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleTypeChange('task')}
                        style={{flex: 1}}
                      >
                        Tarea
                      </button>
                      <button
                        type="button"
                        className={`btn ${type === 'work' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => handleTypeChange('work')}
                        style={{flex: 1}}
                      >
                        Trabajo
                      </button>
                  </div>
              </div>

              {/* TÍTULO */}
              <div className="form-group">
                  <label className="form-label">Título</label>
                  <input
                    className="form-input"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder={type === 'task' ? "Ej: Comprar defensas" : "Ej: Revisión motor"}
                    required
                    autoFocus
                  />
              </div>

              {/* HORA Y PRIORIDAD (Grid) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                      <label className="form-label">Hora</label>
                      <input
                        type="time"
                        className="form-input"
                        value={formData.time}
                        onChange={(e) => setFormData({...formData, time: e.target.value})}
                        required
                      />
                  </div>

                  {type === 'task' && (
                    <div className="form-group">
                        <label className="form-label">Prioridad</label>
                        <select
                            className="form-input"
                            value={formData.priority}
                            onChange={(e) => setFormData({...formData, priority: e.target.value})}
                        >
                            <option value="low">Baja</option>
                            <option value="medium">Media</option>
                            <option value="high">Alta</option>
                        </select>
                    </div>
                  )}
              </div>

              {/* ESTADO DINÁMICO */}
              <div className="form-group">
                  <label className="form-label">Estado Inicial</label>
                  <select
                    className="form-input"
                    value={formData.statusId}
                    onChange={(e) => setFormData({...formData, statusId: e.target.value})}
                    required
                  >
                      {activeStatusList.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                  </select>
              </div>

              <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? 'Guardando...' : 'Crear Evento'}
                  </button>
              </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* --- 2. COMPONENTE CALENDARIO --- */
const SimpleCalendar = ({ events, onDateClick, onEventClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach(ev => {
      const dateStr = ev.date ? ev.date.slice(0, 10) : null;
      if (dateStr) {
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(ev);
      }
    });
    return map;
  }, [events]);

  const changeMonth = (delta) => {
    setCurrentDate(new Date(year, month + delta, 1));
    setSelectedDate(null);
  };

  const handleDayClick = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate({ dateStr, events: eventsByDate[dateStr] || [] });
  };

  return (
    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>

      {/* A) GRID DEL CALENDARIO */}
      <div style={{ flex: 1, minWidth: '350px', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <button onClick={() => changeMonth(-1)} className="btn btn-secondary" style={{padding: '5px 10px'}}>&lt;</button>
          <h4 style={{ margin: 0, color: '#3878b6' }}>{monthNames[month]} {year}</h4>
          <button onClick={() => changeMonth(1)} className="btn btn-secondary" style={{padding: '5px 10px'}}>&gt;</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', textAlign: 'center' }}>
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
            <div key={d} style={{ fontWeight: 'bold', fontSize: '12px', color: '#9ca3af', paddingBottom: '5px' }}>{d}</div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`}></div>)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = eventsByDate[dateStr] || [];
            const hasEvents = dayEvents.length > 0;
            const isSelected = selectedDate?.dateStr === dateStr;

            return (
              <div
                key={day}
                onClick={() => handleDayClick(day)}
                style={{
                  height: '45px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', borderRadius: '8px', position: 'relative',
                  backgroundColor: isSelected ? '#e0f2fe' : 'transparent',
                  border: isSelected ? '1px solid #3878b6' : '1px solid transparent',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {if(!isSelected) e.currentTarget.style.backgroundColor = '#f3f4f6'}}
                onMouseLeave={(e) => {if(!isSelected) e.currentTarget.style.backgroundColor = 'transparent'}}
              >
                <span style={{ fontSize: '14px', fontWeight: hasEvents ? 'bold' : 'normal' }}>{day}</span>
                {hasEvents && (
                  <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                    {dayEvents.slice(0, 3).map((ev, idx) => (
                      <div key={idx} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: ev.color }} title={ev.title}></div>
                    ))}
                    {dayEvents.length > 3 && <div style={{width: '6px', height: '6px', fontSize: '8px', lineHeight:'4px'}}>+</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* B) DETALLES DEL DÍA SELECCIONADO */}
      <div style={{ width: '300px', background: '#f9fafb', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ marginTop: 0, color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
            {selectedDate ? formatDateHeader(selectedDate.dateStr) : 'Selecciona un día'}
        </h4>

        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '15px' }}>
            {selectedDate ? (
                selectedDate.events.length > 0 ? (
                    selectedDate.events.map((ev, idx) => (
                        <div
                            key={idx}
                            onClick={() => onEventClick(ev)}
                            style={{
                                background: 'white', padding: '12px', borderRadius: '8px',
                                borderLeft: `4px solid ${ev.color}`,
                                marginBottom: '10px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                cursor: 'pointer', transition: 'transform 0.1s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(2px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                            title="Haz clic para ver detalles"
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '11px', fontWeight: 'bold', color: ev.color, textTransform: 'uppercase' }}>{ev.type_label}</span>
                                <span style={{ fontSize: '14px' }}>➔</span>
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', margin: '4px 0' }}>{ev.title}</div>
                            {ev.meta && <div style={{ fontSize: '12px', color: '#6b7280' }}>{ev.meta}</div>}
                        </div>
                    ))
                ) : (
                    <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
                        No hay eventos programados.
                    </p>
                )
            ) : (
                <p style={{ color: '#9ca3af', fontSize: '13px' }}>
                    Haz clic en un día del calendario para ver los detalles o añadir eventos.
                </p>
            )}
        </div>

        {selectedDate && (
            <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => onDateClick(selectedDate.dateStr)}
            >
                + Añadir Evento
            </button>
        )}
      </div>
    </div>
  );
};

// Helper para fecha bonita
function formatDateHeader(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}


/* --- 3. COMPONENTE PRINCIPAL (TAB KPI) --- */
export default function TabKpi({ boatId, onBack, onNavigate }) {
  const [stats, setStats] = useState({
    tasks: { total: 0, completed: 0, highPriority: 0 },
    works: { total: 0, realCost: 0, estimatedCost: 0, planned: 0 },
    docs: { total: 0, expired: 0 }
  });
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados del Quick Add Modal
  const [isQuickAddOpen, setQuickAddOpen] = useState(false);
  const [selectedDateForAdd, setSelectedDateForAdd] = useState(null);

  const fetchData = async () => {
    if (!boatId) return;
    try {
      setLoading(true);
      const [resTasks, resWorks, resDocs] = await Promise.all([
          api.get(`/boats/${boatId}/tasks/`),
          api.get(`/boats/${boatId}/works/`),
          api.get(`/boats/${boatId}/documents/`)
      ]);

      const tasks = resTasks.data.results || resTasks.data || [];
      const works = resWorks.data.results || resWorks.data || [];
      const docs = resDocs.data.results || resDocs.data || [];

      // 1. STATS TAREAS
      const taskStats = {
          total: tasks.length,
          completed: tasks.filter(t => ['done', 'completed', 'completado'].includes(t.status_details?.code)).length,
          highPriority: tasks.filter(t => t.priority === 'high').length
      };

      // 2. STATS TRABAJOS (Costes Reales vs Estimados)
      let sumReal = 0;
      let sumEstimated = 0;
      works.forEach(w => {
          const estimate = parseFloat(w.cost_estimate) || 0;
          const final = parseFloat(w.cost_final) || 0;
          sumEstimated += estimate; // Siempre sumamos al estimado

          // Solo sumamos al real si está terminado
          if (w.status_details?.code === 'done') {
              sumReal += final;
          }
      });

      const workStats = {
          total: works.length,
          realCost: sumReal,
          estimatedCost: sumEstimated,
          planned: works.filter(w => w.status_details?.code === 'planned').length
      };

      // 3. STATS DOCUMENTOS
      const now = new Date();
      const docStats = {
          total: docs.length,
          expired: docs.filter(d => !d.no_expiration && d.expiration_date && new Date(d.expiration_date) < now).length
      };

      setStats({ tasks: taskStats, works: workStats, docs: docStats });

      // 4. MAPEO DE EVENTOS PARA EL CALENDARIO
      const events = [];

      // Tareas
      tasks.forEach(t => {
          if (t.due_date) {
              events.push({
                  id: t.id,
                  category: 'tasks', // Para navegación
                  date: t.due_date,
                  type_label: 'Tarea',
                  title: t.title,
                  color: t.priority === 'high' ? '#ef4444' : '#3b82f6',
                  meta: t.status_details?.name
              });
          }
      });

      // Trabajos
      works.forEach(w => {
          if (w.start_date) {
              events.push({
                  id: w.id,
                  category: 'works', // Para navegación
                  date: w.start_date,
                  type_label: 'Trabajo',
                  title: w.title,
                  color: '#f59e0b',
                  meta: `${w.status_details?.name} (${w.cost_estimate || 0}€)`
              });
          }
      });

      // Documentos
      docs.forEach(d => {
          if (!d.no_expiration && d.expiration_date) {
              const isExpired = new Date(d.expiration_date) < now;
              events.push({
                  id: d.id,
                  category: 'documents', // Para navegación
                  date: d.expiration_date,
                  type_label: isExpired ? 'Caducado' : 'Vence Doc',
                  title: d.name,
                  color: isExpired ? '#ef4444' : '#10b981',
                  meta: isExpired ? 'Requiere atención' : 'Renovar'
              });
          }
      });

      setCalendarEvents(events);

    } catch (e) {
      console.error("Error loading KPI data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [boatId]);


  // --- MANEJADORES ---

  const handleDateClick = (dateStr) => {
    setSelectedDateForAdd(dateStr);
    setQuickAddOpen(true);
  };

  const handleEventClick = (event) => {
      // Navegación hacia la pestaña correspondiente
      if (onNavigate) {
          onNavigate(event.category, event.id);
      } else {
          console.warn("Falta prop onNavigate en TabKpi");
      }
  };

  const handleQuickAddSave = () => {
    fetchData(); // Refrescar el dashboard
  };


  if (loading) return <div style={{padding: '40px', textAlign: 'center'}}>Cargando Dashboard...</div>;

  return (
    <div className="fade-in">
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
            <h2 style={{ margin: 0, color: '#3878b6' }}>Dashboard & KPIs</h2>
            <button onClick={onBack} className="btn btn-secondary">
                ← Volver a Detalles
            </button>
        </div>

        {/* METRICS CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>

            {/* Card Tareas */}
            <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(59, 130, 246, 0.2)' }}>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>Tareas Pendientes</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '5px 0' }}>{stats.tasks.total - stats.tasks.completed}</div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                    {stats.tasks.completed} completadas • {stats.tasks.highPriority} alta prioridad
                </div>
            </div>

            {/* Card Costes (Dividido Real vs Estimado) */}
            <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', color: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(245, 158, 11, 0.2)' }}>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>Control de Costes (Trabajos)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: '10px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.works.realCost.toLocaleString()} €</span>
                        <span style={{ fontSize: '13px', opacity: 0.9, fontWeight: '500' }}>Reales</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', opacity: 0.9 }}>
                         <span style={{ fontSize: '20px', fontWeight: '600' }}>{stats.works.estimatedCost.toLocaleString()} €</span>
                         <span style={{ fontSize: '12px' }}>Estimados</span>
                    </div>
                </div>
            </div>

            {/* Card Documentos */}
            <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)' }}>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>Documentos</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', margin: '5px 0' }}>{stats.docs.total}</div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                    {stats.docs.expired > 0 ? `⚠ ${stats.docs.expired} caducados` : 'Todos en vigor'}
                </div>
            </div>
        </div>

        {/* CALENDAR */}
        <h3 style={{ color: '#374151', marginBottom: '15px' }}>Calendario de Eventos</h3>
        <SimpleCalendar
            events={calendarEvents}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
        />

        {/* QUICK ADD MODAL */}
        <QuickAddModal
            isOpen={isQuickAddOpen}
            onClose={() => setQuickAddOpen(false)}
            date={selectedDateForAdd}
            boatId={boatId}
            onSave={handleQuickAddSave}
        />

    </div>
  );
}