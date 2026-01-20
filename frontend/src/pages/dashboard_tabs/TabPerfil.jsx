import { useAuth } from '../../AuthContext';
import { useState, useEffect } from 'react';
import api, { BACKEND_URL } from '../../api';

function TabPerfil() {
  const { user, setUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editableUser, setEditableUser] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const normalizePhotoUrl = (url) => {
    if (!url) return null;
    if (url.startsWith("blob:")) return url;
    if (url.startsWith("http")) return url;
    return `${BACKEND_URL}${url}`;
  };

  useEffect(() => {
    if (user) {
      setEditableUser(user);

      if (user.profile_photo_url) {
        setPhotoPreview(normalizePhotoUrl(user.profile_photo_url));
      } else {
        setPhotoPreview(null);
      }
    }
  }, [user]);

  const handleEditToggle = () => {
    if (isEditing) {
      setEditableUser(user);
      setProfilePhoto(null);

      setPhotoPreview(
        user.profile_photo_url ? normalizePhotoUrl(user.profile_photo_url) : null
      );
    }

    setIsEditing(!isEditing);
    setMessage(null);
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const updateData = {
        email: editableUser.email,
        dni: editableUser.dni || '',
        phone_number: editableUser.phone_number || '',
        first_name: editableUser.first_name || '',
        last_name: editableUser.last_name || '',
      };

      const profileResponse = await api.patch('/me/', updateData);

      let updatedPhotoUrl = photoPreview;

      if (profilePhoto) {
        const photoData = new FormData();
        photoData.append('profile_photo', profilePhoto);

        const photoResponse = await api.patch('/me/', photoData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        updatedPhotoUrl =
          normalizePhotoUrl(
            photoResponse.data.profile_photo_url ??
            photoResponse.data.profile_photo ??
            updatedPhotoUrl
          );

        setPhotoPreview(updatedPhotoUrl);
      }

      setUser({
        ...profileResponse.data,
        profile_photo_url: updatedPhotoUrl,
      });

      setMessage({ type: 'success', text: '¡Perfil actualizado correctamente!' });
      setIsEditing(false);
      setProfilePhoto(null);

    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Error al guardar el perfil',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditableUser(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setProfilePhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemovePhoto = () => {
    setProfilePhoto(null);
    setPhotoPreview(null);
  };

  if (!editableUser) return <div>Cargando perfil...</div>;

  return (
    <div style={{ display: 'flex', gap: '40px' }}>
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px'
        }}>
          <h3 style={{ margin: 0, color: '#3878b6', fontSize: '28px' }}>Mi Perfil</h3>

          {isEditing ? (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleSave} className="btn btn-success" disabled={loading}>
                {loading ? <span className="spinner"></span> : '✓'} Guardar
              </button>
              <button onClick={handleEditToggle} className="btn btn-danger" disabled={loading}>
                ✕ Cancelar
              </button>
            </div>
          ) : (
            <button onClick={handleEditToggle} className="btn btn-primary">
              Editar
            </button>
          )}
        </div>

        {message && (
          <div className={`alert alert-${message.type}`}>
            {message.type === 'success' ? '✓' : '⚠'} {message.text}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Usuario</label>
          <input type="text" value={editableUser.username} disabled className="form-input" />
        </div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            type="email"
            name="email"
            value={editableUser.email}
            onChange={handleChange}
            readOnly={!isEditing}
            className={`form-input ${isEditing ? 'form-input-edit' : ''}`}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Nombre</label>
            <input
              type="text"
              name="first_name"
              value={editableUser.first_name || ''}
              onChange={handleChange}
              readOnly={!isEditing}
              className={`form-input ${isEditing ? 'form-input-edit' : ''}`}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Apellido</label>
            <input
              type="text"
              name="last_name"
              value={editableUser.last_name || ''}
              onChange={handleChange}
              readOnly={!isEditing}
              className={`form-input ${isEditing ? 'form-input-edit' : ''}`}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">DNI/NIE</label>
          <input
            type="text"
            name="dni"
            value={editableUser.dni || ''}
            onChange={handleChange}
            readOnly={!isEditing}
            className={`form-input ${isEditing ? 'form-input-edit' : ''}`}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Teléfono</label>
          <input
            type="text"
            name="phone_number"
            value={editableUser.phone_number || ''}
            onChange={handleChange}
            readOnly={!isEditing}
            className={`form-input ${isEditing ? 'form-input-edit' : ''}`}
          />
        </div>
      </div>

      <div style={{ flexBasis: '400px' }}>
        <label className="form-label" style={{ marginBottom: '16px' }}>Foto de Perfil</label>

        {photoPreview ? (
          <div className="photo-preview">
            <img src={normalizePhotoUrl(photoPreview)} alt="Profile" />

            {isEditing && (
              <div className="photo-preview-overlay">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="photo-input"
                />
                <label htmlFor="photo-input" className="btn btn-primary" style={{ margin: '0 8px' }}>
                  Cambiar
                </label>
                <button onClick={handleRemovePhoto} className="btn btn-danger">
                  Eliminar
                </button>
              </div>
            )}
          </div>
        ) : (
          isEditing && (
            <div
              className={`photo-upload-zone ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('photo-input-new').click()}
            >
              <div className="photo-upload-icon">☁️</div>
              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#667eea' }}>
                Arrastra tu foto aquí
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>
                o haz clic para seleccionar
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="photo-input-new"
              />
            </div>
          )
        )}

        {!isEditing && !photoPreview && (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            background: '#f9fafb',
            borderRadius: '20px',
            color: '#9ca3af'
          }}>
            <p>Sin foto de perfil</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TabPerfil;
