import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api';

/* --- COMPONENTE DE MODAL DETALLE EMPRESA --- */
function CompanyDetailModal({ isOpen, onClose, company, isAdded, onAdd, onRemove, isProcessing }) {
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);

  // Сброс и загрузка сервисов при открытии
  useEffect(() => {
    if (isOpen && company) {
      // Определяем реальный ID компании (учитывая структуру AccountCompany vs Company)
      const details = company.company_details || company;
      const companyId = details.id;

      setServices([]); // Очистка старых данных
      setLoadingServices(true);

      api.get(`/companies/${companyId}/services/`)
        .then(res => {
          setServices(res.data);
        })
        .catch(err => {
          console.error("Error loading services:", err);
        })
        .finally(() => {
          setLoadingServices(false);
        });
    }
  }, [isOpen, company]);

  if (!isOpen || !company) return null;

  const details = company.company_details || company;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3 style={{ margin: 0, color: '#3878b6' }}>{details.name}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>

          {/* Информация Principal (существующий блок) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
             <div>
                <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'bold' }}>Ubicación</label>
                <div style={{ fontSize: '14px' }}>
                   {details.province_name ? `${details.province_name}, ` : ''}
                   {details.country_name || '-'}
                </div>
             </div>
             <div>
                <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'bold' }}>Email</label>
                <div style={{ fontSize: '14px' }}>
                    {details.email ? <a href={`mailto:${details.email}`} style={{color:'#3878b6'}}>{details.email}</a> : '-'}
                </div>
             </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
             <div>
                <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'bold' }}>Teléfono</label>
                <div style={{ fontSize: '14px' }}>{details.phone || '-'}</div>
             </div>
             <div>
                <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'bold' }}>Web</label>
                <div style={{ fontSize: '14px' }}>
                     {details.website ? <a href={details.website} target="_blank" rel="noreferrer" style={{color:'#3878b6'}}>Visitar sitio</a> : '-'}
                </div>
             </div>
          </div>

          <div>
             <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'bold' }}>Dirección</label>
             <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{details.address || '-'}</div>
          </div>

          {/* --- БЛОК СЕРВИСОВ (НОВЫЙ) --- */}
          <div style={{ marginTop: '10px', paddingTop: '15px', borderTop: '1px solid #e5e7eb' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#374151' }}>Servicios Oficiales</h4>

            {loadingServices ? (
               <div style={{ fontSize: '13px', color: '#6b7280' }}>Cargando servicios...</div>
            ) : services.length > 0 ? (
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                  {services.map(srv => (
                    <div key={srv.id} style={{
                        background: '#f3f4f6',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        border: '1px solid #e5e7eb'
                    }}>
                        <div style={{ fontWeight: 'bold', color: '#1f2937' }}>{srv.service_name}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>{srv.espace_name}</div>
                    </div>
                  ))}
               </div>
            ) : (
               <div style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>
                  Esta empresa no tiene servicios registrados.
               </div>
            )}
          </div>

          {/* Nota personal (существующий блок) */}
          {company.notes && (
             <div style={{ background: '#f9fafb', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: 'bold' }}>Mis Notas</label>
                <div style={{ fontSize: '13px', fontStyle: 'italic' }}>{company.notes}</div>
             </div>
          )}

        </div>

        <div className="modal-footer" style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>

            {isAdded ? (
                <button
                    className="btn"
                    style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}
                    onClick={onRemove}
                    disabled={isProcessing}
                >
                    {isProcessing ? 'Procesando...' : 'Eliminar de Mis Empresas'}
                </button>
            ) : (
                <button
                    className="btn btn-primary"
                    onClick={onAdd}
                    disabled={isProcessing}
                >
                    {isProcessing ? 'Añadiendo...' : 'Añadir a Mis Empresas'}
                </button>
            )}
        </div>
      </div>
    </div>
  );
}

function TabEmpresas({ boatId }) {
  const [activeTab, setActiveTab] = useState('mis_empresas'); // 'mis_empresas' | 'todos'

  // Data
  const [globalCompanies, setGlobalCompanies] = useState([]);
  const [myCompanies, setMyCompanies] = useState([]);
  const [boatData, setBoatData] = useState(null);

  // UI State
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // Para loading de botones

  // --- CARGA INICIAL ---
  const loadData = useCallback(async () => {
    if (!boatId) return;
    setLoading(true);
    try {
        // 1. Obtener info del barco para saber el Account ID
        const boatRes = await api.get(`/boats/${boatId}/`);
        setBoatData(boatRes.data);

        // 2. Obtener Mis Empresas
        const myCompRes = await api.get('/my-companies/');
        setMyCompanies(myCompRes.data.results || myCompRes.data || []);

        // 3. Obtener Catálogo Global
        const globalRes = await api.get('/companies/');
        setGlobalCompanies(globalRes.data.results || globalRes.data || []);

    } catch (e) {
        console.error("Error loading companies:", e);
    } finally {
        setLoading(false);
    }
  }, [boatId]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  // --- HELPERS ---

  // Verifica si una compañía global ya está en mi lista
  const isCompanyInMyList = (globalCompanyId) => {
      return myCompanies.some(item => item.company === globalCompanyId);
  };

  // Obtener el ID de la relación (AccountCompany ID) dado un Company ID global
  const getRelationId = (globalCompanyId) => {
      const relation = myCompanies.find(item => item.company === globalCompanyId);
      return relation ? relation.id : null;
  };

  // --- ACTIONS ---

  const handleCardClick = (item) => {
    setSelectedCompany(item);
    setIsModalOpen(true);
  };

  const handleAddToMyCompanies = async () => {
      console.log("Datos a enviar:", {
          company: selectedCompany?.id,
          account: boatData?.account
      });

      if (!boatData || !selectedCompany) return;
      setIsProcessing(true);
      try {
          // Payload: company (ID), account (ID)
          await api.post('/my-companies/', {
              company: selectedCompany.id,
              account: boatData.account
          });

          // Recargar Mis Empresas
          const myCompRes = await api.get('/my-companies/');
          setMyCompanies(myCompRes.data.results || []);

          setIsModalOpen(false);
      } catch (e) {
          console.error("Error adding company:", e);
          alert("Error al añadir la empresa.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleRemoveFromMyCompanies = async () => {
      if (!selectedCompany) return;

      // Necesitamos el ID de la relación (AccountCompany.id), no el de la Company.id
      // Si estamos en el tab 'mis_empresas', selectedCompany ya es la relación.
      // Si estamos en 'todos', selectedCompany es la Company global, hay que buscar la relación.

      let relationId = null;
      if (activeTab === 'mis_empresas') {
          relationId = selectedCompany.id;
      } else {
          relationId = getRelationId(selectedCompany.id);
      }

      if (!relationId) return;

      setIsProcessing(true);
      try {
          await api.delete(`/my-companies/${relationId}/`);

          // Recargar Mis Empresas
          const myCompRes = await api.get('/my-companies/');
          setMyCompanies(myCompRes.data.results || []);

          setIsModalOpen(false);
      } catch (e) {
          console.error("Error removing company:", e);
          alert("Error al eliminar la empresa.");
      } finally {
          setIsProcessing(false);
      }
  };

  // --- FILTERING ---

  const getFilteredList = () => {
    const list = activeTab === 'mis_empresas' ? myCompanies : globalCompanies;

    if (!searchTerm) return list;

    const lowerTerm = searchTerm.toLowerCase();

    return list.filter(item => {
        // En 'mis_empresas', los datos están en item.company_details
        // En 'todos', los datos están en item root
        const details = item.company_details || item;
        return details.name.toLowerCase().includes(lowerTerm) ||
               (details.province_name || '').toLowerCase().includes(lowerTerm);
    });
  };

  const filteredList = getFilteredList();


  // --- RENDER ---
  if (loading) return <div>Cargando empresas...</div>;

  return (
    <div>
      {/* --- TOOLBAR --- */}
      <div className="documents-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '20px' }}>
        <h3 style={{ margin: 0, color: '#3878b6', fontSize: '28px' }}>Empresas</h3>

        {/* Buscador Centrado */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <input
                type="text"
                placeholder="Buscar empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {/* Botón placeholder o Acción futura */}
        <div style={{ width: '150px', textAlign: 'right' }}>
           {/* Aquí podrías poner un botón "Crear Empresa" si quisieras */}
        </div>
      </div>

      {/* --- TABS INTERNAS --- */}
      <div style={{ marginBottom: '25px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '20px' }}>
          <button
            onClick={() => { setActiveTab('todos'); setSearchTerm(''); }}
            style={{
                padding: '10px 0',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'todos' ? '2px solid #3878b6' : '2px solid transparent',
                color: activeTab === 'todos' ? '#3878b6' : '#6b7280',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '15px'
            }}
          >
            Todas ({globalCompanies.length})
          </button>

          <button
            onClick={() => { setActiveTab('mis_empresas'); setSearchTerm(''); }}
            style={{
                padding: '10px 0',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'mis_empresas' ? '2px solid #3878b6' : '2px solid transparent',
                color: activeTab === 'mis_empresas' ? '#3878b6' : '#6b7280',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '15px'
            }}
          >
            Mis Empresas ({myCompanies.length})
          </button>
      </div>

      {/* --- GRID DE CARDS --- */}
      {filteredList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', background: '#f9fafb', borderRadius: '8px' }}>
             {searchTerm ? 'No se encontraron empresas con ese nombre.' : (activeTab === 'mis_empresas' ? 'Aún no has añadido empresas. Ve a la pestaña "Todas" para buscar y añadir.' : 'No hay empresas disponibles.')}
          </div>
      ) : (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', // Responsivo: mínimo 350px por tarjeta
            gap: '20px'
        }}>
            {filteredList.map(item => {
                // Normalizar datos para visualización
                const details = item.company_details || item;
                // Saber si ya la tengo (solo relevante en tab 'todos', en 'mis_empresas' siempre es true)
                const alreadyAdded = activeTab === 'mis_empresas' ? true : isCompanyInMyList(item.id);

                return (
                    <div
                        key={item.id}
                        onClick={() => handleCardClick(item)}
                        style={{
                            background: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            padding: '20px',
                            border: '1px solid #e5e7eb',
                            cursor: 'pointer',
                            transition: 'transform 0.1s, box-shadow 0.1s',
                            position: 'relative'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; }}
                    >
                        {/* Indicador visual si ya está añadida (solo en tab Todos) */}
                        {activeTab === 'todos' && alreadyAdded && (
                            <div style={{
                                position: 'absolute', top: '10px', right: '10px',
                                background: '#dcfce7', color: '#166534',
                                fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: '600'
                            }}>
                                Añadida
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '15px', marginBottom: '10px', marginTop:'10px' }}>
                            <div style={{
                                minWidth: '48px', height: '48px',
                                background: '#e0f2fe', color: '#0369a1',
                                borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '20px', fontWeight: 'bold'
                            }}>
                                {details.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h4 style={{ margin: 0, color: '#111827', fontSize: '16px' }}>{details.name}</h4>
                                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                                    {details.province_name || 'Ubicación desconocida'}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '15px', fontSize: '13px', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                <span style={{opacity: 0.6}}>📞</span> {details.phone || 'Sin teléfono'}
                            </div>
                            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                <span style={{opacity: 0.6}}>✉️</span> {details.email || 'Sin email'}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      )}

      {/* --- MODAL DETALLE --- */}
      <CompanyDetailModal
         isOpen={isModalOpen}
         onClose={() => setIsModalOpen(false)}
         company={selectedCompany}
         // Determinamos si está añadida o no para mostrar el botón correcto
         isAdded={activeTab === 'mis_empresas' || (selectedCompany && isCompanyInMyList(selectedCompany.id))}
         onAdd={handleAddToMyCompanies}
         onRemove={handleRemoveFromMyCompanies}
         isProcessing={isProcessing}
      />

    </div>
  );
}

export default TabEmpresas;