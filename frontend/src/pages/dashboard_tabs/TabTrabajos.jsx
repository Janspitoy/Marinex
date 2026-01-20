import React, { useState, useEffect } from "react";
import axios from "../../api";

// Etiquetas para mostrar en los botones
const STATUS_LABELS = {
  "planned": "Planificado",
  "en-curso": "En Curso",
  "suspendido": "Suspendido",
  "done": "Terminado"
};

// Orden de los botones de filtro
const FILTER_BUTTONS = ["planned", "en-curso", "suspendido", "done"];

/* --- COMPONENTE DE MODAL DE BORRADO --- */
function DeleteWorkModal({ isOpen, onCancel, onConfirm, workItem }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', textAlign: 'center' }}>
        <div className="modal-header">
          <h3 style={{ color: '#d9534f', margin: 0 }}>Confirmar eliminación</h3>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        <p style={{ marginTop: '15px' }}>
          ¿Seguro que deseas eliminar este trabajo?
          <br />
          <strong>{workItem ? workItem.title : ''}</strong>
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

export default function TabTrabajos({ boat, initialEditId }) {
  // --- ESTADOS ---
  const [localBoat, setLocalBoat] = useState(null);
  const activeBoat = boat || localBoat;

  // Datos
  const [works, setWorks] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [hasOpenedInitial, setHasOpenedInitial] = useState(false);

  // AHORA ESTO GUARDARÁ "MIS EMPRESAS" (AccountCompany)
  const [myCompanies, setMyCompanies] = useState([]);

  const [users, setUsers] = useState([]);

  // UI
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modal Edición/Creación
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editWork, setEditWork] = useState(null);

  // Lógica Padre/Hijo (Categorías)
  const [selectedParentId, setSelectedParentId] = useState('');

  // Modal Borrado
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [workToDelete, setWorkToDelete] = useState(null);

  // Formulario
  const [form, setForm] = useState({
    id: null, category: "", service_company: "", assigned_user: "",
    title: "", description: "", status: "", cost_estimate: "",
    cost_final: "", start_date: "", end_date: "", notes: "",
  });

  useEffect(() => {
    if (!loading && initialEditId && works.length > 0 && !hasOpenedInitial) {
        const workToEdit = works.find(w => w.id === parseInt(initialEditId));
        if (workToEdit) {
            openModal(workToEdit); // Функция открытия модалки в TabTrabajos
            setHasOpenedInitial(true);
             const tableElement = document.querySelector('.data-table');
            if(tableElement) tableElement.scrollIntoView({ behavior: 'smooth' });
        }
    }
  }, [loading, works, initialEditId, hasOpenedInitial]);

  // --- CARGA DE DATOS ---
  useEffect(() => {
    if (!boat && !localBoat) {
      axios.get('/boats/').then(res => {
        if (res.data.results?.length > 0) setLocalBoat(res.data.results[0]);
      }).catch(console.error);
    }
  }, [boat, localBoat]);

  const loadData = async () => {
    if (!activeBoat?.id) return;
    setLoading(true);
    try {
      const endpoints = [
        axios.get(`/boats/${activeBoat.id}/works/`),
        axios.get(`/work-statuses/`),
        axios.get(`/work-categories/`),

        // --- CAMBIO AQUÍ: Cargamos MIS empresas, no todas ---
        axios.get(`/my-companies/`),
      ];

      if (activeBoat.account) {
        endpoints.push(axios.get(`/accounts/${activeBoat.account}/users/`));
      }

      const [wRes, stRes, catRes, compRes, usrRes] = await Promise.all(endpoints);

      setWorks(wRes.data.results || wRes.data);
      setStatuses(stRes.data.results || stRes.data);
      setCategories(catRes.data.results || catRes.data);

      // Guardamos la lista de mis empresas
      setMyCompanies(compRes.data.results || compRes.data);

      if (usrRes) setUsers(usrRes.data.results || usrRes.data);

    } catch (e) {
      console.error("Error al cargar datos:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeBoat?.id) loadData();
  }, [activeBoat]);


  // --- MANEJO DEL MODAL DE EDICIÓN ---
  const openModal = (work = null) => {
    setEditWork(work);

    if (work) {
      // --- MODO EDICIÓN ---
      setForm({
        id: work.id,
        title: work.title || "",
        description: work.description || "",
        status: work.status || "",
        category: work.category || "",
        service_company: work.service_company || "",
        assigned_user: work.assigned_user || "",
        cost_estimate: work.cost_estimate || "",
        cost_final: work.cost_final || "",
        start_date: work.start_date ? work.start_date.slice(0, 16) : "",
        end_date: work.end_date ? work.end_date.slice(0, 16) : "",
        notes: work.notes || "",
      });

      if (work.category && categories.length > 0) {
        const currentCat = categories.find(c => c.id === work.category);
        if (currentCat && currentCat.parent) {
            setSelectedParentId(currentCat.parent);
        } else {
            setSelectedParentId('');
        }
      } else {
        setSelectedParentId('');
      }

    } else {
      // --- MODO CREACIÓN ---
      const defaultStatus = statuses.find(s => s.code === 'planned');
      setForm({
        id: null, title: "", description: "",
        status: defaultStatus ? defaultStatus.id : "",
        category: "", service_company: "", assigned_user: "",
        cost_estimate: "", cost_final: "", start_date: "", end_date: "", notes: "",
      });
      setSelectedParentId('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditWork(null);
    setSelectedParentId('');
  };

  const handleParentCategoryChange = (e) => {
    const newParentId = e.target.value;
    setSelectedParentId(newParentId);
    setForm({ ...form, category: "" });
  };

  const saveWork = async (e) => {
    e.preventDefault();

    if (subCategories.length > 0 && !form.category) {
        alert("Por favor selecciona una subcategoría.");
        return;
    }

    try {
      const payload = { ...form };
      delete payload.id;

      ['category', 'service_company', 'assigned_user', 'status'].forEach(k => {
        if (!payload[k]) payload[k] = null;
      });
      ['start_date', 'end_date'].forEach(k => {
        if (!payload[k]) payload[k] = null;
      });

      if (editWork) {
        await axios.patch(`/boats/${activeBoat.id}/works/${editWork.id}/`, payload);
      } else {
        await axios.post(`/boats/${activeBoat.id}/works/`, payload);
      }

      closeModal();
      loadData();
    } catch (err) {
      console.error("Error al guardar:", err);
      alert("Error al guardar el trabajo. Revisa los datos.");
    }
  };

  // --- BORRADO ---
  const openDeleteModal = (work) => {
    setWorkToDelete(work);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setWorkToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!workToDelete) return;
    try {
      await axios.delete(`/boats/${activeBoat.id}/works/${workToDelete.id}/`);
      loadData();
      closeDeleteModal();
    } catch (err) {
      console.error("Error al eliminar:", err);
      alert("No se pudo eliminar el trabajo.");
    }
  };

  // --- FILTROS ---
  const filteredWorks = works.filter(w => {
    const matchesSearch = w.title.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesStatus = true;
    if (filterStatus !== 'all') {
        matchesStatus = w.status_details?.code === filterStatus;
    }
    return matchesSearch && matchesStatus;
  });

  const parentCategories = categories.filter(c => !c.parent);
  const subCategories = selectedParentId
    ? categories.filter(c => c.parent == selectedParentId)
    : [];

  if (!activeBoat || !activeBoat.id) return <div>Cargando datos...</div>;

  return (
    <div>
      {/* --- BARRA SUPERIOR --- */}
      <div className="documents-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '20px' }}>
        <h3 style={{ margin: 0, color: '#3878b6', fontSize: '24px' }}>Trabajos</h3>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          + Añadir Trabajo
        </button>
      </div>

      {/* --- FILTROS --- */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', paddingBottom: '10px', borderBottom: '1px solid #e5e7eb' }}>
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
        {FILTER_BUTTONS.map(code => (
            <button
                key={code}
                onClick={() => setFilterStatus(code)}
                style={{
                    padding: '6px 16px', borderRadius: '20px', border: '1px solid #d1d5db', cursor: 'pointer',
                    backgroundColor: filterStatus === code ? '#e0f2fe' : 'white',
                    color: filterStatus === code ? '#0369a1' : '#6b7280',
                    borderColor: filterStatus === code ? '#0369a1' : '#e5e7eb',
                    fontWeight: '500'
                }}
            >
                {STATUS_LABELS[code] || code}
            </button>
        ))}
      </div>

      {/* --- TABLA --- */}
      {loading ? (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px' }}>Cargando trabajos...</div>
      ) : filteredWorks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', background: '#f9fafb', borderRadius: '8px' }}>
             No hay trabajos para mostrar con estos filtros.
          </div>
      ) : (
        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
                <tr>
                    <th>Título / Descripción</th>
                    <th>Estado</th>
                    <th>Categoría</th>
                    <th>Empresa</th>
                    <th>Fechas</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                {filteredWorks.map(w => (
                    <tr
                        key={w.id}
                        onClick={() => openModal(w)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                            <div>{w.title}</div>
                            {w.description && (
                                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {w.description}
                                </div>
                            )}
                        </td>
                        <td>
                            <span className={`status-badge ${w.status_details?.code || ''}`}>
                                {w.status_details?.name || 'Sin estado'}
                            </span>
                        </td>
                        <td>
                            {w.category_details?.name || '-'}
                        </td>
                        <td>
                            {w.service_company_details?.name || '-'}
                        </td>
                        <td>
                            {w.start_date ? w.start_date.slice(0, 10) : '-'} <br/>
                            <span style={{fontSize:'11px'}}>hasta</span> {w.end_date ? w.end_date.slice(0, 10) : '-'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDeleteModal(w);
                                }}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#d9534f' }}
                                title="Eliminar trabajo"
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

      {/* --- MODAL (FORMULARIO) --- */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editWork ? "Editar Trabajo" : "Nuevo Trabajo"}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <form onSubmit={saveWork}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div className="form-group">
                    <label className="form-label">Título*</label>
                    <input
                        className="form-input"
                        required
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select
                        className="form-input"
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                    >
                        <option value="">-- Seleccionar --</option>
                        {statuses.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                  </div>
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea className="form-input" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

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
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
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
                    <label className="form-label">Empresa (Mis Empresas)</label>

                    {/* --- AQUÍ ESTÁ EL CAMBIO CLAVE --- */}
                    <select className="form-input" value={form.service_company} onChange={(e) => setForm({ ...form, service_company: e.target.value })}>
                        <option value="">-- Ninguna --</option>
                        {myCompanies.map(rel => (
                            // rel.company es el ID de la empresa real
                            // rel.company_details tiene el nombre
                            <option key={rel.id} value={rel.company}>
                                {rel.company_details.name}
                            </option>
                        ))}
                    </select>

                </div>
                <div className="form-group">
                    <label className="form-label">Asignado a</label>
                    <select className="form-input" value={form.assigned_user} onChange={(e) => setForm({ ...form, assigned_user: e.target.value })}>
                        <option value="">-- Nadie --</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.first_name || u.email}</option>)}
                    </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '15px' }}>
                 <div className="form-group">
                    <label className="form-label">Coste Estimado (€)</label>
                    <input type="number" className="form-input" value={form.cost_estimate} onChange={(e) => setForm({ ...form, cost_estimate: e.target.value })} />
                 </div>
                 <div className="form-group">
                    <label className="form-label">Coste Final (€)</label>
                    <input type="number" className="form-input" value={form.cost_final} onChange={(e) => setForm({ ...form, cost_final: e.target.value })} />
                 </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                 <div className="form-group">
                    <label className="form-label">Fecha Inicio</label>
                    <input type="datetime-local" className="form-input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                 </div>
                 <div className="form-group">
                    <label className="form-label">Fecha Fin</label>
                    <input type="datetime-local" className="form-input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                 </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={closeModal} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL (CONFIRMACIÓN DE BORRADO) --- */}
      <DeleteWorkModal
        isOpen={isDeleteModalOpen}
        onCancel={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        workItem={workToDelete}
      />
    </div>
  );
}