import { useState, useEffect } from 'react';
import api from '../../api';
import TabKpi from './TabKpi';

function TabBarco() {
  const [boats, setBoats] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- STATE DASHBOARD ---
  const [showDashboard, setShowDashboard] = useState(false);

  // States для редактирования
  const [isEditing, setIsEditing] = useState(false);
  const [editableBoat, setEditableBoat] = useState(null);
  const [boatPhoto, setBoatPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [allPhotos, setAllPhotos] = useState([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchBoats();
  }, []);

  const fetchBoats = async () => {
    setLoading(true);
    try {
      const response = await api.get('/boats/');
      if (response.data.results && response.data.results.length > 0) {
        const boat = response.data.results[0];
        setBoats(response.data.results);
        setEditableBoat(boat);

        const photos = getBoatPhotos(boat.attachments);
        setAllPhotos(photos);
        setBoatPhoto(null);
        setCurrentPhotoIndex(0);

        if (photos.length > 0) {
          setPhotoPreview(photos[0].file);
        } else {
          setPhotoPreview(null);
        }
      }
    } catch (e) {
      console.error("Failed to fetch boats", e);
    } finally {
      setLoading(false);
    }
  };

  const getBoatPhotos = (attachments) => {
    if (!attachments || attachments.length === 0) return [];
    return attachments.filter(att => att.attachment_type === 'photo');
  };

  // --- ЛОГИКА ПЕРЕКЛЮЧЕНИЯ ---
  const toggleDashboard = () => {
    setShowDashboard(!showDashboard);
  };

  const handleEditToggle = () => {
    if (isEditing) {
      const originalBoat = boats[0];
      setEditableBoat(originalBoat);
      const photos = getBoatPhotos(originalBoat.attachments);
      setAllPhotos(photos);
      setBoatPhoto(null);
      setCurrentPhotoIndex(0);
      if (photos.length > 0) setPhotoPreview(photos[0].file);
      else setPhotoPreview(null);
    }
    setIsEditing(!isEditing);
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const updateData = {
        name: editableBoat.name,
        registration_number: editableBoat.registration_number,
        serial_number: editableBoat.serial_number,
        year: editableBoat.year,
        length: editableBoat.length,
        width: editableBoat.width,
        draft: editableBoat.draft,
        engine_type: editableBoat.engine_type,
        engine_power: editableBoat.engine_power,
      };

      await api.patch(`/boats/${editableBoat.id}/`, updateData);

      if (boatPhoto) {
        const photoData = new FormData();
        photoData.append('file', boatPhoto);
        photoData.append('attachment_type', 'photo');
        await api.post(`/boats/${editableBoat.id}/attachments/`, photoData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      await fetchBoats();
      setMessage({ type: 'success', text: '¡Barco actualizado correctamente!' });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving boat:', error);
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Error al guardar el barco' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditableBoat(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBoatPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setBoatPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemovePhoto = () => {
    setBoatPhoto(null);
    if (allPhotos.length > 0) setPhotoPreview(allPhotos[currentPhotoIndex].file);
    else setPhotoPreview(null);
  };

  const handleNextPhoto = () => {
    if (allPhotos.length === 0) return;
    const newIndex = (currentPhotoIndex + 1) % allPhotos.length;
    setCurrentPhotoIndex(newIndex);
    setPhotoPreview(allPhotos[newIndex].file);
    setBoatPhoto(null);
  };

  const handlePrevPhoto = () => {
    if (allPhotos.length === 0) return;
    const newIndex = (currentPhotoIndex - 1 + allPhotos.length) % allPhotos.length;
    setCurrentPhotoIndex(newIndex);
    setPhotoPreview(allPhotos[newIndex].file);
    setBoatPhoto(null);
  };

  const handleDotClick = (index) => {
    setCurrentPhotoIndex(index);
    setPhotoPreview(allPhotos[index].file);
    setBoatPhoto(null);
  };

  const handleDeletePhoto = async () => {
    if (!editableBoat || !editableBoat.id || allPhotos.length === 0 || boatPhoto) return;
    const photoToDelete = allPhotos[currentPhotoIndex];
    if (!photoToDelete || !photoToDelete.id) return;
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta foto?")) return;

    setSaving(true);
    setMessage(null);
    try {
      await api.delete(`/boats/${editableBoat.id}/attachments/${photoToDelete.id}/`);
      setMessage({ type: 'success', text: 'Foto eliminada.' });
      await fetchBoats();
    } catch (error) {
      console.error('Error deleting photo:', error);
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Error al eliminar la foto' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Cargando barco...</div>;

  if (boats.length === 0 || !editableBoat) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h3 style={{ color: '#3878b6' }}>No tienes barcos registrados</h3>
        <p style={{ color: '#9ca3af', marginBottom: '24px' }}>Añade tu primer barco para comenzar</p>
        <a href="/add-boat" className="btn btn-primary">+ Añadir Barco</a>
      </div>
    );
  }

  // --- РЕНДЕР DASHBOARD ---
  if (showDashboard) {
    return <TabKpi boatId={editableBoat.id} onBack={() => setShowDashboard(false)} />;
  }

  const boat = editableBoat;

  return (
    <div style={{ display: 'flex', gap: '40px' }}>
      <div style={{ flex: 1 }}>
        {/* --- ЗАГОЛОВОК (Header) --- */}
        {/* Добавили position: relative для корректного центрирования абсолютной кнопки */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', position: 'relative' }}>

          {/* СЛЕВА: Название */}
          <h3 style={{ margin: 0, color: '#3878b6', fontSize: '28px' }}>
            {isEditing ? 'Editando Barco' : boat.name}
          </h3>

          {/* ПО ЦЕНТРУ: Кнопка Dashboard */}
          {!isEditing && (
              <button
                  onClick={toggleDashboard}
                  className="btn"
                  style={{
                      background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd',
                      display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold',
                      // --- ЦЕНТРИРОВАНИЕ ---
                      position: 'absolute',
                      left: '50%',
                      transform: 'translateX(-50%)'
                  }}
              >
                  Ver Dashboard KPI
              </button>
          )}

          {/* СПРАВА: Кнопки действий */}
          {isEditing ? (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleSave} className="btn btn-success" disabled={saving}>
                {saving ? <span className="spinner"></span> : '✓'} Guardar
              </button>
              <button onClick={handleEditToggle} className="btn btn-danger" disabled={saving}>
                ✕ Cancelar
              </button>
            </div>
          ) : (
            <button onClick={handleEditToggle} className="btn btn-primary">
              Editar Datos
            </button>
          )}
        </div>

        {message && (
          <div className={`alert alert-${message.type}`}>
            {message.type === 'success' ? '✓' : '⚠'} {message.text}
          </div>
        )}

        {/* --- ФОРМА --- */}
        <div className="form-group">
          <label className="form-label">Nombre del Barco</label>
          <input type="text" name="name" value={boat.name || ''} onChange={handleChange} readOnly={!isEditing} className={`form-input ${isEditing ? 'form-input-edit' : ''}`} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group"><label className="form-label">Marca (Astillero)</label><input type="text" value={boat.brand_name || 'N/A'} readOnly disabled className="form-input" /></div>
          <div className="form-group"><label className="form-label">Modelo</label><input type="text" value={boat.model_name || 'N/A'} readOnly disabled className="form-input" /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          <div className="form-group"><label className="form-label">Matrícula</label><input type="text" name="registration_number" value={boat.registration_number || ''} onChange={handleChange} readOnly={!isEditing} className={`form-input ${isEditing ? 'form-input-edit' : ''}`} /></div>
          <div className="form-group"><label className="form-label">Serial Number</label><input type="text" name="serial_number" value={boat.serial_number || ''} onChange={handleChange} readOnly={!isEditing} className={`form-input ${isEditing ? 'form-input-edit' : ''}`} /></div>
          <div className="form-group"><label className="form-label">Año</label><input type="number" name="year" value={boat.year || ''} onChange={handleChange} readOnly={!isEditing} className={`form-input ${isEditing ? 'form-input-edit' : ''}`} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          <div className="form-group"><label className="form-label">Eslora (Length)</label><input type="number" name="length" value={boat.length || ''} onChange={handleChange} readOnly={!isEditing} className={`form-input ${isEditing ? 'form-input-edit' : ''}`} /></div>
          <div className="form-group"><label className="form-label">Manga (Width)</label><input type="number" name="width" value={boat.width || ''} onChange={handleChange} readOnly={!isEditing} className={`form-input ${isEditing ? 'form-input-edit' : ''}`} /></div>
          <div className="form-group"><label className="form-label">Calado (Draft)</label><input type="number" name="draft" value={boat.draft || ''} onChange={handleChange} readOnly={!isEditing} className={`form-input ${isEditing ? 'form-input-edit' : ''}`} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group"><label className="form-label">Tipo de Motor</label><input type="text" name="engine_type" value={boat.engine_type || ''} onChange={handleChange} readOnly={!isEditing} className={`form-input ${isEditing ? 'form-input-edit' : ''}`} /></div>
          <div className="form-group"><label className="form-label">Potencia Motor</label><input type="text" name="engine_power" value={boat.engine_power || ''} onChange={handleChange} readOnly={!isEditing} className={`form-input ${isEditing ? 'form-input-edit' : ''}`} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          <div className="form-group"><label className="form-label">Puerto Base</label><input type="text" value={boat.port_name || 'No especificado'} readOnly disabled className="form-input" /></div>
          <div className="form-group"><label className="form-label">Provincia</label><input type="text" value={boat.province_name || 'No especificada'} readOnly disabled className="form-input" /></div>
          <div className="form-group"><label className="form-label">País (Country)</label><input type="text" value={boat.country_name || 'No especificado'} readOnly disabled className="form-input" /></div>
        </div>
      </div>

      <div style={{ flexBasis: '600px' }}>
        <label className="form-label" style={{ marginBottom: '16px' }}>Foto del Barco</label>
        {photoPreview ? (
          <div className="photo-preview photo-preview1 carousel-container">
            <img src={photoPreview} alt={boat.name} />
            {!boatPhoto && allPhotos.length > 1 && (
              <>
                <button onClick={handlePrevPhoto} className="carousel-arrow left">&#10094;</button>
                <button onClick={handleNextPhoto} className="carousel-arrow right">&#10095;</button>
              </>
            )}
            {!boatPhoto && allPhotos.length > 1 && (
              <div className="carousel-dots">
                {allPhotos.map((photo, index) => (
                  <span key={index} className={`carousel-dot ${index === currentPhotoIndex ? 'active' : ''}`} onClick={() => handleDotClick(index)}></span>
                ))}
              </div>
            )}
            {isEditing && (
              <div className="photo-preview-overlay">
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} id="boat-photo-input" />
                <label htmlFor="boat-photo-input" className="btn btn-primary" style={{ margin: '0 8px' }}>Añadir</label>
                {!boatPhoto && allPhotos.length > 0 && <button onClick={handleDeletePhoto} className="btn btn-danger" disabled={saving}>Eliminar</button>}
                {boatPhoto && <button onClick={handleRemovePhoto} className="btn btn-warning" disabled={saving}>↶ Cancelar</button>}
              </div>
            )}
          </div>
        ) : (
          isEditing && (
            <div className={`photo-upload-zone ${isDragging ? 'dragging' : ''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => document.getElementById('boat-photo-new').click()}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#667eea' }}>Añadir foto del barco</p>
              <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} id="boat-photo-new" />
            </div>
          )
        )}
        {!isEditing && !photoPreview && (
          <div style={{ padding: '40px', textAlign: 'center', background: '#f9fafb', borderRadius: '20px', color: '#9ca3af', height: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>⛵</div>
            <p>Sin foto del barco</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TabBarco;