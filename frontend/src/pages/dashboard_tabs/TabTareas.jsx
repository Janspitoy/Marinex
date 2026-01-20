import React, { useState, useEffect, useCallback } from "react";
import api from "../../api";

// --- КОНФИГУРАЦИЯ ЦВЕТОВ ---

// Цвета для ПРИОРИТЕТОВ
const PRIORITY_CONFIG = {
  high: { label: "Alta", bg: "#fee2e2", color: "#991b1b" },     // Красный
  medium: { label: "Media", bg: "#fef3c7", color: "#92400e" },  // Желтый
  low: { label: "Baja", bg: "#dcfce7", color: "#166534" }       // Зеленый
};

// Цвета для СТАТУСОВ
const STATUS_COLORS = {
  "pendiente": { bg: "#f3f4f6", color: "#374151" },   // Серый
  "pending": { bg: "#f3f4f6", color: "#374151" },

  "en-curso": { bg: "#e0f2fe", color: "#0369a1" },    // Синий
  "in-progress": { bg: "#e0f2fe", color: "#0369a1" },

  "bloqueado": { bg: "#fee2e2", color: "#991b1b" },   // Красный
  "blocked": { bg: "#fee2e2", color: "#991b1b" },
  "suspendido": { bg: "#fee2e2", color: "#991b1b" },

  "completado": { bg: "#dcfce7", color: "#166534" },  // Зеленый
  "completed": { bg: "#dcfce7", color: "#166534" },
  "done": { bg: "#dcfce7", color: "#166534" }
};

/* --- MODAL DE BORRADO --- */
function DeleteTaskModal({ isOpen, onCancel, onConfirm, taskItem }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', textAlign: 'center' }}>
        <div className="modal-header">
          <h3 style={{ color: '#d9534f', margin: 0 }}>Confirmar eliminación</h3>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        <p style={{ marginTop: '15px' }}>
          ¿Seguro que deseas eliminar esta tarea?
          <br />
          <strong>{taskItem ? taskItem.title : ''}</strong>
        </p>

        <p style={{ color: '#9ca3af', fontSize: '13px' }}>
          Esta acción no se puede deshacer.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '18px' }}>
          <button className="btn btn-secondary" onClick={onCancel} style={{ padding: '8px 14px' }}>Cancelar</button>
          <button className="btn btn-error" onClick={onConfirm} style={{ padding: '8px 14px' }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// Aceptamos boatId y onUpdateStats
export default function TabTareas({ boatId, onUpdateStats, initialEditId }) {

  // --- STATES ---
  const [tasks, setTasks] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState('all');

  // Modals
  const [isModalOpen, setModalOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);

  // Logic Parent/Child Category
  const [selectedParentId, setSelectedParentId] = useState('');

  // Form Data
  const emptyForm = {
    title: "",
    description: "",
    priority: "",
    due_date: "",
    status: "",
    category: "",
    assigned_user: "",
  };
  const [formData, setFormData] = useState(emptyForm);

  const [hasOpenedInitial, setHasOpenedInitial] = useState(false);

  // --- LOAD DATA ---
  const loadData = useCallback(async () => {
    if (!boatId) return;
    setLoading(true);
    try {
      const endpoints = [
        api.get(`/boats/${boatId}/tasks/`),
        api.get(`/task-statuses/`),
        api.get(`/task-categories/`),
      ];
      const [resTasks, resStatuses, resCats] = await Promise.all(endpoints);

      setTasks(resTasks.data?.results ?? resTasks.data ?? []);
      setStatuses(resStatuses.data?.results ?? resStatuses.data ?? []);
      setCategories(resCats.data?.results ?? resCats.data ?? []);

    } catch (e) {
      console.error("Error cargando datos:", e);
    } finally {
      setLoading(false);
    }
  }, [boatId]);

  useEffect(() => {
    if (!loading && initialEditId && tasks.length > 0 && !hasOpenedInitial) {
        const taskToEdit = tasks.find(t => t.id === parseInt(initialEditId));
        if (taskToEdit) {
            openEditModal(taskToEdit);
            setHasOpenedInitial(true);
            // Скролл к таблице для удобства
            const tableElement = document.querySelector('.data-table');
            if(tableElement) tableElement.scrollIntoView({ behavior: 'smooth' });
        }
    }
  }, [loading, tasks, initialEditId, hasOpenedInitial]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  // --- MODAL HANDLERS ---
  const openAddModal = () => {
    setSelectedTask(null);
    const defaultStatus = statuses.length > 0 ? statuses[0].id : "";
    setFormData({ ...emptyForm, status: defaultStatus });
    setSelectedParentId('');
    setModalOpen(true);
  };

  const openEditModal = (task) => {
    setSelectedTask(task);
    setFormData({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority ?? "",
      due_date: task.due_date ? task.due_date.slice(0, 16) : "",
      status: task.status ?? "",
      category: task.category ?? "",
      assigned_user: task.assigned_user ?? "",
    });

    if (task.category && categories.length > 0) {
        const currentCat = categories.find(c => c.id === task.category);
        if (currentCat && currentCat.parent) {
            setSelectedParentId(currentCat.parent);
        } else {
            setSelectedParentId('');
        }
    } else {
        setSelectedParentId('');
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedTask(null);
    setFormData(emptyForm);
    setSelectedParentId('');
  };

  // Category Logic
  const handleParentCategoryChange = (e) => {
    const val = e.target.value;
    setSelectedParentId(val);
    setFormData({ ...formData, category: "" });
  };

  const parentCategories = categories.filter(c => !c.parent);
  const subCategories = selectedParentId
    ? categories.filter(c => c.parent == selectedParentId)
    : [];

  // --- ACTIONS ---
  const saveTask = async (e) => {
    e.preventDefault();
    if (subCategories.length > 0 && !formData.category) {
        alert("Por favor selecciona una subcategoría.");
        return;
    }
    try {
      const payload = { ...formData };
      ['category', 'assigned_user', 'status'].forEach(k => {
        if (!payload[k]) payload[k] = null;
      });
      if (!payload.due_date) payload.due_date = null;

      if (selectedTask) {
        await api.patch(`/boats/${boatId}/tasks/${selectedTask.id}/`, payload);
      } else {
        await api.post(`/boats/${boatId}/tasks/`, payload);
      }
      closeModal();
      loadData();

      // ACTUALIZAR ESTADÍSTICAS
      if (onUpdateStats) onUpdateStats();

    } catch (e) {
      console.error("Error saving:", e);
      alert("Error al guardar la tarea.");
    }
  };

  const openDeleteModal = (task) => {
    setTaskToDelete(task);
    setDeleteModalOpen(true);
  };

  const deleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await api.delete(`/boats/${boatId}/tasks/${taskToDelete.id}/`);
      setDeleteModalOpen(false);
      setTaskToDelete(null);
      loadData();

      // ACTUALIZAR ESTADÍSTICAS
      if (onUpdateStats) onUpdateStats();

    } catch (e) {
      console.error("Error deleting:", e);
      alert("No se pudo eliminar.");
    }
  };

  // --- FILTERING ---
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.description ?? "").toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = true;
    if (filterStatus !== 'all') {
        const statusCode = t.status_details?.code;
        matchesStatus = statusCode === filterStatus;
    }
    return matchesSearch && matchesStatus;
  });

  // --- HELPERS (BADGES) ---
  const getStatusBadge = (statusObj) => {
    if (!statusObj) return <span className="status-badge">N/A</span>;
    const { name, code } = statusObj;

    const style = STATUS_COLORS[code] || { bg: '#f3f4f6', color: '#374151' };

    return (
      <span style={{
        backgroundColor: style.bg,
        color: style.color,
        padding: '2px 10px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
        display: 'inline-block'
      }}>
        {name}
      </span>
    );
  };

  const getPriorityBadge = (priority) => {
    if (!priority) return '-';
    const config = PRIORITY_CONFIG[priority] || { label: priority, bg: '#f3f4f6', color: '#374151' };

    return (
      <span style={{
        backgroundColor: config.bg,
        color: config.color,
        padding: '2px 10px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
        display: 'inline-block'
      }}>
        {config.label}
      </span>
    );
  };

  if (loading) return <div>Cargando tareas...</div>;

  return (
    <div>
      {/* --- TOOLBAR --- */}
      <div className="documents-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '20px' }}>
        <h3 style={{ margin: 0, color: "#3878b6", fontSize: "24px" }}>Tareas</h3>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        <button className="btn btn-primary" onClick={openAddModal}>
          + Añadir Tarea
        </button>
      </div>

      {/* --- FILTROS DE ESTADOS --- */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', paddingBottom: '10px', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
        <button
            onClick={() => setFilterStatus('all')}
            style={{
                padding: '6px 16px', borderRadius: '20px', border: '1px solid #d1d5db', cursor: 'pointer',
                backgroundColor: filterStatus === 'all' ? '#374151' : 'white',
                color: filterStatus === 'all' ? 'white' : '#374151',
                fontWeight: '500'
            }}
        >
            Todos
        </button>

        {statuses.map(status => {
            const isActive = filterStatus === status.code;
            const colorConfig = STATUS_COLORS[status.code] || { bg: '#e0f2fe', color: '#0369a1' };

            return (
                <button
                    key={status.id}
                    onClick={() => setFilterStatus(status.code)}
                    style={{
                        padding: '6px 16px', borderRadius: '20px', border: '1px solid', cursor: 'pointer',
                        borderColor: isActive ? colorConfig.color : '#d1d5db',
                        backgroundColor: isActive ? colorConfig.bg : 'white',
                        color: isActive ? colorConfig.color : '#6b7280',
                        fontWeight: '500'
                    }}
                >
                    {status.name}
                </button>
            );
        })}
      </div>

      {/* --- ТАБЛИЦА --- */}
      {filteredTasks.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: '#9ca3af', background: '#f9fafb', borderRadius: '8px' }}>
          No hay tareas para mostrar con estos filtros.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
                <tr>
                <th>Título / Descripción</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Categoría</th>
                <th>Fecha Límite</th>
                <th style={{ width: "86px", textAlign: "center" }}>Acciones</th>
                </tr>
            </thead>

            <tbody>
                {filteredTasks.map((task) => (
                <tr
                    key={task.id}
                    onClick={() => openEditModal(task)}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                    <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                        <div>{task.title}</div>
                        {task.description && (
                            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {task.description}
                            </div>
                        )}
                    </td>

                    <td>{getStatusBadge(task.status_details)}</td>

                    <td>{getPriorityBadge(task.priority)}</td>

                    <td>{task.category_details?.name || '-'}</td>

                    <td>
                        {task.due_date ? task.due_date.slice(0, 10) : "—"}
                    </td>

                    <td style={{ textAlign: "center", padding: '12px 16px' }}>
                        <button
                            onClick={(e) => {
                            e.stopPropagation();
                            openDeleteModal(task);
                            }}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#d9534f' }}
                            title="Eliminar tarea"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d9534f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                                <path d="M9 6V4h6v2" />
                            </svg>
                        </button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      )}

      {/* --- MODAL (ADD / EDIT) --- */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "700px" }}>
            <div className="modal-header">
              <h3>{selectedTask ? "Editar Tarea" : "Nueva Tarea"}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <form onSubmit={saveTask}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                        <label className="form-label">Título*</label>
                        <input
                            className="form-input"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Estado</label>
                        <select
                            className="form-input"
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        >
                            <option value="">-- Seleccionar --</option>
                            {statuses.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Descripción</label>
                    <textarea
                        className="form-input"
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>

                {/* --- CATEGORY SELECTORS --- */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '15px' }}>
                    <div className="form-group">
                        <label className="form-label">Categoría Principal</label>
                        <select
                            className="form-input"
                            value={selectedParentId}
                            onChange={handleParentCategoryChange}
                        >
                            <option value="">-- Seleccionar --</option>
                            {parentCategories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Subcategoría*</label>
                        <select
                            className="form-input"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            disabled={!selectedParentId || subCategories.length === 0}
                        >
                            <option value="">
                                {(!selectedParentId)
                                    ? '-- Selecciona principal primero --'
                                    : (subCategories.length === 0 ? 'No hay subcategorías' : '-- Seleccionar subcategoría --')}
                            </option>
                            {subCategories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                        <label className="form-label">Prioridad</label>
                        <select
                            className="form-input"
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        >
                            <option value="">-- Seleccionar --</option>
                            <option value="high">Alta</option>
                            <option value="medium">Media</option>
                            <option value="low">Baja</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Fecha Límite</label>
                        <input
                            type="datetime-local"
                            className="form-input"
                            value={formData.due_date}
                            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancelar</button>
                    <button type="submit" className="btn btn-primary">Guardar</button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DELETE MODAL --- */}
      <DeleteTaskModal
        isOpen={isDeleteModalOpen}
        onCancel={() => setDeleteModalOpen(false)}
        onConfirm={deleteTask}
        taskItem={taskToDelete}
      />
    </div>
  );
}