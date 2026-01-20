// TabDocumentos.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api';

// --- HELPERS ---
const analyzeWithAI = async (file, setFormData, setAiLoading, categories, setSelectedParentId) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);

    try {
        if (setAiLoading) setAiLoading(true);
        const res = await api.post("/ai/analyze-document/", fd, {
            headers: { "Content-Type": "multipart/form-data" }
        });

        const ai = res.data || {};

        // Сначала обновляем текстовые поля
        setFormData(prev => ({
            ...prev,
            name: ai.name ?? prev.name,
            expiration_date: ai.expiration_date ?? prev.expiration_date,
            no_expiration: ai.no_expiration ?? prev.no_expiration,
            notes: ai.notes ?? prev.notes,
        }));

        // Теперь — категории
        applyAICategorySelection(ai, categories, setSelectedParentId, setFormData);

    } catch (e) {
        console.error("AI error:", e);
    } finally {
        if (setAiLoading) setAiLoading(false);
    }
};


// afterAnalyzeCategoriesForAI
const applyAICategorySelection = (ai, categories, setSelectedParentId, setFormData) => {
    if (!ai) return;

    const parentId = ai.category_id;
    const subId = ai.subcategory_id;

    // Если AI дал только подкатегорию → ищем ее родителя
    let realParent = parentId;

    if (subId) {
        const sub = categories.find(c => c.id === subId);
        if (sub && sub.parent) {
            realParent = sub.parent;
        }
    }

    setSelectedParentId(realParent || "");

    setFormData(prev => ({
        ...prev,
        category: subId || "",  // документ создаётся по subcategory_id
    }));
};



const groupDocsByCategory = (docs) => {
  if (!docs) return {};
  return docs.reduce((acc, doc) => {
    const category = doc.category_name || 'Sin categoría';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(doc);
    return acc;
  }, {});
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (e) {
    return 'Fecha inválida';
  }
};

const getStatusBadge = (doc) => {
  if (doc.no_expiration) {
    return <span className="status-badge en-vigor" style={{backgroundColor: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '10px', fontSize:'12px', fontWeight:'bold'}}>En Vigor</span>;
  }
  if (!doc.expiration_date) {
    return <span className="status-badge" style={{backgroundColor: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: '10px', fontSize:'12px'}}>N/A</span>;
  }
  const isExpired = new Date(doc.expiration_date) < new Date();
  if (isExpired) {
    return <span className="status-badge caducado" style={{backgroundColor: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '10px', fontSize:'12px', fontWeight:'bold'}}>Caducado</span>;
  } else {
    return <span className="status-badge en-vigor" style={{backgroundColor: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '10px', fontSize:'12px', fontWeight:'bold'}}>En Vigor</span>;
  }
};

// --- MODALES ---
function AddDocumentModal({ isOpen, onClose, onSave, boatId }) {
  const [formData, setFormData] = useState({
    name: '', category: '', expiration_date: '', no_expiration: false, notes: '',
  });

  const [file, setFile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedParentId, setSelectedParentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Dropzone
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // AI loading state (so UI can show spinner if desired)
  const [aiLoading, setAiLoading] = useState(false);

  // -------- AI FILE SELECT (MANUAL INPUT) -------------
  const handleManualFileSelect = async (e) => {
    if (!e.target.files[0]) return;
    const f = e.target.files[0];
    setFile(f);

    // call analyze helper (it will update formData)
    await analyzeWithAI(f, setFormData, setAiLoading, categories, setSelectedParentId);
  };

  // -------- AI FILE SELECT (DRAG & DROP) -------------
  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      setFile(f);

      await analyzeWithAI(f, setFormData, setAiLoading, categories, setSelectedParentId);  // <-- AI HERE
    }
  };

  const handleDragEnter = (e) => { e.preventDefault(); setIsDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragActive(false); };
  const handleDragOver = (e) => { e.preventDefault(); setIsDragActive(true); };

  // -------- LOAD CATEGORIES ON OPEN -------------
  useEffect(() => {
    if (isOpen) {
      const fetchCategories = async () => {
        try {
          const response = await api.get('/document-categories/');
          setCategories(response.data.results || []);
        } catch (e) {
          console.error('Error loading categories:', e);
          setError('Error al cargar categorías');
        }
      };

      fetchCategories();
      setError(null);
      setSelectedParentId('');
      setFile(null);
      setFormData({ name: '', category: '', expiration_date: '', no_expiration: false, notes: '' });
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleParentCategoryChange = (e) => {
    setSelectedParentId(e.target.value);
    setFormData(prev => ({ ...prev, category: '' }));
  };

  // -------- SUBMIT FORM -------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.category) {
      setError('Por favor, seleccione una subcategoría.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('category', formData.category);
      data.append('no_expiration', formData.no_expiration);

      if (!formData.no_expiration && formData.expiration_date) {
        data.append('expiration_date', formData.expiration_date);
      }

      if (formData.notes) data.append('notes', formData.notes);
      if (file) data.append('file', file);

      await api.post(`/boats/${boatId}/documents/`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onSave();
      onClose();

    } catch (err) {
      console.error('Error saving document:', err);
      setError(err.response?.data?.detail || 'Error al guardar el documento');
    } finally {
      setLoading(false);
    }
  };

  // FILTERS
  const parentCategories = categories.filter(cat => cat.level === 0);
  const subCategories = selectedParentId
    ? categories.filter(cat => cat.parent === selectedParentId)
    : [];

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Añadir Documento</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div className="alert alert-error"
               style={{backgroundColor:'#fde8e8',color:'#b71c1c',padding:'10px 15px',borderRadius:'8px',marginBottom:'15px'}}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* Name */}
          <div className="form-group">
            <label className="form-label">Nombre del Documento*</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="form-input"
              placeholder="Ej: Seguro del barco"
            />
          </div>

          {/* Categories */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px'}}>
            <div className="form-group">
              <label className="form-label">Categoría Principal*</label>
              <select value={selectedParentId} onChange={handleParentCategoryChange} required className="form-input">
                <option value="">Seleccionar...</option>
                {parentCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {selectedParentId && (
              <div className="form-group">
                <label className="form-label">Subcategoría*</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  className="form-input"
                  disabled={subCategories.length === 0}
                >
                  <option value="">{subCategories.length === 0 ? 'Vacío' : 'Seleccionar...'}</option>
                  {subCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Expiration */}
          <div className="checkbox-wrapper" style={{marginBottom:'20px'}}>
            <input
              type="checkbox"
              name="no_expiration"
              checked={formData.no_expiration}
              onChange={handleChange}
              id="no-expiration"
            />
            <label htmlFor="no-expiration" style={{cursor:'pointer'}}>Sin fecha de caducidad</label>
          </div>

          {!formData.no_expiration && (
            <div className="form-group">
              <label className="form-label">Fecha de Caducidad</label>
              <input type="date" name="expiration_date" value={formData.expiration_date} onChange={handleChange} className="form-input" />
            </div>
          )}

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notas</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} className="form-input" rows="2" placeholder="Notas adicionales..." />
          </div>

          {/* File Dropzone */}
          <div className="form-group">
            <label className="form-label">Archivo</label>

            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
              style={{
                border: `2px dashed ${isDragActive ? '#3878b6' : '#d1d5db'}`,
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center',
                backgroundColor: isDragActive ? '#f0f9ff' : '#f9fafb',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative'
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleManualFileSelect}
                style={{display:'none'}}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />

              {file ? (
                <div>
                  <div style={{color:'#0369a1',fontWeight:'600'}}>{file.name}</div>
                  <div style={{fontSize:'11px',color:'#6b7280'}}>Click para cambiar</div>
                </div>
              ) : (
                <div>
                  <div style={{color:'#4b5563',fontWeight:'500'}}>Click o arrastra el archivo aquí</div>
                  <div style={{fontSize:'12px',color:'#9ca3af',marginTop:'4px'}}>Formatos: PDF, JPG, PNG, DOC, DOCX</div>
                </div>
              )}
            </div>

            {aiLoading && (
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                Analizando con AI...
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}


function EditDocumentModal({ isOpen, onClose, onSave, boatId, documentData }) {
  const [formData, setFormData] = useState({
    name: '', category: '', expiration_date: '', no_expiration: false, notes: '',
  });

  const [newFile, setNewFile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [selectedParentId, setSelectedParentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Dropzone State
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // AI loading
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (isOpen && documentData) {
      setLoading(true);
      setError(null);
      setNewFile(null);

      setFormData({
        name: documentData.name || '',
        category: documentData.category || '',
        expiration_date: documentData.expiration_date ? documentData.expiration_date.split('T')[0] : '',
        no_expiration: documentData.no_expiration || false,
        notes: documentData.notes || '',
      });

      const fullUrl = documentData.file || null;
      setPreviewUrl(fullUrl);

      const fetchCategoriesAndSetParent = async () => {
        try {
          const response = await api.get('/document-categories/');
          const allCats = response.data.results || [];
          setCategories(allCats);
          const currentSubCategory = allCats.find(cat => cat.id === documentData.category);
          if (currentSubCategory) {
            setSelectedParentId(currentSubCategory.parent);
          }
        } catch (e) {
          console.error('Error loading categories:', e);
          setError('Error al cargar categorías');
        } finally {
          setLoading(false);
        }
      };
      fetchCategoriesAndSetParent();
    }
  }, [isOpen, documentData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleParentCategoryChange = (e) => {
    setSelectedParentId(e.target.value);
    setFormData(prev => ({ ...prev, category: '' }));
  };

  // --- DROPZONE HANDLERS EDIT ---
  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(false); };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragActive(true); };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      setNewFile(f);
      setPreviewUrl(URL.createObjectURL(f));
    }
  };

  // Manual file select for EDIT modal (and run AI analyze if desired)
  const handleManualFileSelect = async (e) => {
    if (!e.target.files[0]) return;
    const f = e.target.files[0];
    setNewFile(f);
    setPreviewUrl(URL.createObjectURL(f));

    // Optionally analyze with AI to pre-fill fields on edit
    // We want to keep existing form values and only replace if AI returns something
    await analyzeWithAI(f, setFormData, setAiLoading, categories, setSelectedParentId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.category) {
        setError('Por favor, seleccione una subcategoría.');
        return;
    }
    setLoading(true);
    setError(null);

    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('category', formData.category);
      data.append('no_expiration', formData.no_expiration);
      if (!formData.no_expiration && formData.expiration_date) {
        data.append('expiration_date', formData.expiration_date);
      }
      data.append('notes', formData.notes);
      if (newFile) {
        data.append('file', newFile);
      }

      await api.patch(`/boats/${boatId}/documents/${documentData.id}/`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSave();
      onClose();
    } catch (err) {
      console.error('Error updating document:', err);
      setError(err.response?.data?.detail || 'Error al actualizar el documento');
    } finally {
      setLoading(false);
    }
  };

  const parentCategories = categories.filter(cat => cat.level === 0);
  const subCategories = selectedParentId
    ? categories.filter(cat => cat.parent === selectedParentId)
    : [];

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
         <div className="modal-header">
          <h3>Editar Documento</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && (
          <div className="alert alert-error" style={{backgroundColor: '#fde8e8', color: '#b71c1c', padding: '10px 15px', borderRadius: '8px', marginBottom: '15px'}}>
            ⚠ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '30px' }}>

          <div style={{ flex: 1, borderRight: '1px solid #e5e7eb', paddingRight: '30px' }}>
            <h4 style={{marginTop: 0, color: '#3878b6'}}>Vista Previa</h4>

            {previewUrl ? (
              <iframe
                src={previewUrl}
                style={{ width: '100%', height: '400px', border: '1px solid #ccc', borderRadius: '8px', background: '#f9f9f9' }}
                title="Vista previa del archivo"
              ></iframe>
            ) : (
              <div style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9f9f9', borderRadius: '8px', color: '#9ca3af' }}>
                <span style={{ fontSize: '40px' }}>📄</span>
                No hay archivo para mostrar
              </div>
            )}

            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`btn btn-secondary ${!previewUrl ? 'disabled' : ''}`}
              style={{width: '90%', marginTop: '10px', pointerEvents: !previewUrl ? 'none' : 'auto', textDecoration: 'none', opacity: !previewUrl ? 0.5 : 1}}
            >
              Abrir en nueva pestaña
            </a>
            {aiLoading && (
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                Analizando con AI...
              </div>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <h4 style={{marginTop: 0, color: '#3878b6'}}>Editar Datos</h4>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required className="form-input" />
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                  <div className="form-group">
                    <label className="form-label">Cat. Principal</label>
                    <select value={selectedParentId} onChange={handleParentCategoryChange} required className="form-input">
                      <option value="">Seleccionar...</option>
                      {parentCategories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                    </select>
                  </div>
                  {selectedParentId && (
                    <div className="form-group">
                      <label className="form-label">Subcategoría</label>
                      <select name="category" value={formData.category} onChange={handleChange} required className="form-input" disabled={subCategories.length === 0}>
                        <option value="">{subCategories.length === 0 ? 'Vacío' : 'Seleccionar...'}</option>
                        {subCategories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                      </select>
                    </div>
                  )}
              </div>

              <div className="checkbox-wrapper" style={{ marginBottom: '15px' }}>
                <input type="checkbox" name="no_expiration" checked={formData.no_expiration} onChange={handleChange} id="edit-no-expiration" />
                <label htmlFor="edit-no-expiration" style={{ cursor: 'pointer' }}>Sin fecha de caducidad</label>
              </div>
              {!formData.no_expiration && (
                <div className="form-group">
                  <label className="form-label">Fecha de Caducidad</label>
                  <input type="date" name="expiration_date" value={formData.expiration_date} onChange={handleChange} className="form-input" />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Notas</label>
                <textarea name="notes" value={formData.notes} onChange={handleChange} className="form-input" rows="2" />
              </div>

              {/* --- DROPZONE EDITAR --- */}
              <div className="form-group">
                <label className="form-label">Reemplazar Archivo</label>
                <div
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current.click()}
                    style={{
                        border: `2px dashed ${isDragActive ? '#3878b6' : '#d1d5db'}`,
                        borderRadius: '8px',
                        padding: '15px',
                        textAlign: 'center',
                        backgroundColor: isDragActive ? '#f0f9ff' : '#f9fafb',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative'
                    }}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleManualFileSelect}
                        style={{display: 'none'}}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    />

                    {newFile ? (
                        <div>
                            <div style={{color: '#0369a1', fontWeight: '600', fontSize:'13px'}}>{newFile.name}</div>
                            <div style={{fontSize: '11px', color: '#6b7280'}}>Listo para subir</div>
                        </div>
                    ) : (
                        <div>
                             <div style={{color: '#4b5563', fontWeight: '500', fontSize:'13px'}}>Click o arrastra para reemplazar</div>
                             <div style={{fontSize: '11px', color: '#9ca3af', marginTop: '4px'}}>Formatos: PDF, JPG, PNG, DOC, DOCX</div>
                        </div>
                    )}
                </div>
              </div>

              <div className="modal-footer" style={{paddingTop: '20px', borderTop: '1px solid #e5e7eb'}}>
                <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Actualizando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}


function DeleteConfirmModal({ isOpen, onCancel, onConfirm, documentItem }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', textAlign: 'center' }}>
        <div className="modal-header">
          <h3 style={{ color: '#d9534f', margin: 0 }}>Confirmar eliminación</h3>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        <p style={{ marginTop: '15px' }}>
          ¿Seguro que deseas eliminar este documento?
          <br />
          <strong>{documentItem ? documentItem.name : ''}</strong>
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


function TabDocumentos({ boatId, initialEditId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [hasOpenedInitial, setHasOpenedInitial] = useState(false);

  // delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);

  const fetchDocuments = useCallback(async () => {
    if (!boatId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const docResponse = await api.get(`/boats/${boatId}/documents/`);
      const docs = docResponse.data?.results ?? docResponse.data ?? [];
      setDocuments(docs || []);
    } catch (e) {
      console.error("Failed to fetch documents", e);
      setError('No se pudieron cargar los documentos.');
    } finally {
      setLoading(false);
    }
  }, [boatId]);

  // --- NAVEGACIÓN DESDE EL CALENDARIO ---
  useEffect(() => {
    if (!loading && initialEditId && documents.length > 0 && !hasOpenedInitial) {
        const docToEdit = documents.find(d => d.id === parseInt(initialEditId));
        if (docToEdit) {
            handleOpenEditModal(docToEdit);
            setHasOpenedInitial(true);
            const tableElement = document.querySelector('.data-table');
            if(tableElement) tableElement.scrollIntoView({ behavior: 'smooth' });
        }
    }
  }, [loading, documents, initialEditId, hasOpenedInitial]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleOpenAddModal = () => setIsAddModalOpen(true);
  const handleCloseAddModal = () => setIsAddModalOpen(false);
  const handleSaveAddModal = () => {
    fetchDocuments();
    setIsAddModalOpen(false);
  };

  const handleOpenEditModal = (doc) => {
    setSelectedDoc(doc);
    setIsEditModalOpen(true);
  };
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedDoc(null);
  };
  const handleSaveEditModal = () => {
    fetchDocuments();
    setIsEditModalOpen(false);
    setSelectedDoc(null);
  };

  const openDeleteModal = (doc) => {
    setDocToDelete(doc);
    setIsDeleteModalOpen(true);
  };
  const cancelDelete = () => {
    setIsDeleteModalOpen(false);
    setDocToDelete(null);
  };
  const confirmDelete = async () => {
    if (!docToDelete) return;
    try {
      await api.delete(`/boats/${boatId}/documents/${docToDelete.id}/`);
      await fetchDocuments();
      setIsDeleteModalOpen(false);
      setDocToDelete(null);
    } catch (err) {
      console.error('Error deleting document:', err);
      setError('No se pudo eliminar el documento.');
    }
  };

  if (loading) return <div>Cargando documentos...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  const filteredDocs = documents.filter(doc =>
    (doc.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    ((doc.category_name || '')).toLowerCase().includes(searchTerm.toLowerCase())
  );
  const groupedDocs = groupDocsByCategory(filteredDocs);
  const categories = Object.keys(groupedDocs).sort();

  return (
    <div>
      {/* --- BARRA DE HERRAMIENTAS --- */}
      <div className="documents-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '20px' }}>
        <h3 style={{ margin: 0, color: '#3878b6', fontSize: '28px' }}>Documentos</h3>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <input
                type="text"
                placeholder="Buscar documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        <div>
          <button className="btn btn-primary" onClick={handleOpenAddModal}>
              + Añadir Documento
          </button>
        </div>
      </div>

      {filteredDocs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <h3 style={{ color: '#3878b6' }}>
            {documents.length === 0 ? 'No hay documentos' : 'No se encontraron documentos'}
          </h3>
          <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
            {documents.length === 0
              ? 'Añade tu primer documento para este barco'
              : 'Intenta con otro término de búsqueda'
            }
          </p>
          {documents.length === 0 && (
            <button className="btn btn-primary" onClick={handleOpenAddModal}>
              + Añadir Documento
            </button>
          )}
        </div>
      ) : (
        categories.map(category => (
          <div key={category} style={{ marginBottom: '22px' }}>
            <h4 className="documents-category-title" style={{ marginBottom: '8px' }}>{category}</h4>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '12px' }}>Documento</th>
                  <th style={{ padding: '12px' }}>Estado</th>
                  <th style={{ padding: '12px' }}>Caducidad</th>
                  <th style={{ padding: '12px' }}>Fichero</th>
                  <th style={{ padding: '12px', width: '86px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {groupedDocs[category].map(doc => (
                  <tr
                    key={doc.id}
                    onClick={() => handleOpenEditModal(doc)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                  >
                    <td style={{ padding: '12px' }}>
                      <strong>{doc.name}</strong>
                      {doc.notes && (
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>
                          {doc.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>{getStatusBadge(doc)}</td>
                    <td style={{ padding: '12px'}}>{doc.no_expiration ? 'Sin caducidad' : formatDate(doc.expiration_date)}</td>
                    <td style={{ padding: '12px'}}>
                      {doc.file ? (
                        <a
                          href={doc.file}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '12px', textDecoration: 'none' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Ver
                        </a>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>Sin archivo</span>
                      )}
                    </td>

                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); openDeleteModal(doc); }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '18px',
                          color: '#d9534f',
                        }}
                        title="Eliminar documento"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#d9534f"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
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
        ))
      )}

      <AddDocumentModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        onSave={handleSaveAddModal}
        boatId={boatId}
      />

      <EditDocumentModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onSave={handleSaveEditModal}
        boatId={boatId}
        documentData={selectedDoc}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
        documentItem={docToDelete}
      />
    </div>
  );
}

export default TabDocumentos;
