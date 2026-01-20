import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

// Универсальный загрузчик всех страниц DRF
async function fetchAllPaginated(url) {
  let results = [];
  let nextUrl = url;

  while (nextUrl) {
    const res = await api.get(nextUrl);
    results = [...results, ...res.data.results];
    nextUrl = res.data.next;
  }

  return results;
}

function AddBoat() {
  const [formData, setFormData] = useState({
    name: '',
    registration_number: '',
    year: '',
    model: '',
    port: '',
  });

  const [boatPhoto, setBoatPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [ports, setPorts] = useState([]);

  const [brandSearch, setBrandSearch] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [portSearch, setPortSearch] = useState('');

  const [showBrandList, setShowBrandList] = useState(false);
  const [showModelList, setShowModelList] = useState(false);
  const [showPortList, setShowPortList] = useState(false);

  const [selectedBrand, setSelectedBrand] = useState('');

  const [isDragging, setIsDragging] = useState(false);
  const navigate = useNavigate();

  //
  // 📌 Грузим ВСЕ бренды и ВСЕ порты (в фоне)
  //
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const brandsAll = await fetchAllPaginated('/brands/?limit=200');
        const portsAll = await fetchAllPaginated('/ports/?limit=200');

        setBrands(brandsAll);
        setPorts(portsAll);
      } catch (e) {
        console.error("Error loading data:", e);
        setError("No se pudieron cargar los datos.");
      }
    };

    loadInitialData();
  }, []);

  //
  // 📌 Грузим ВСЕ модели выбранного бренда (полностью)
  //
  useEffect(() => {
    if (!selectedBrand) {
      setModels([]);
      return;
    }

    const loadModels = async () => {
      try {
        const modelsAll = await fetchAllPaginated(
          `/models/?brand_id=${selectedBrand}&limit=200`
        );
        setModels(modelsAll);
      } catch (e) {
        console.error("Error al cargar modelos", e);
      }
    };

    loadModels();
  }, [selectedBrand]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  useEffect(() => {
    return () => {
      if (photoPreview) {
        try {
          URL.revokeObjectURL(photoPreview);
        } catch (e) {}
      }
    };
  }, [photoPreview]);

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      if (photoPreview) {
        try { URL.revokeObjectURL(photoPreview); } catch {}
      }
      const objectUrl = URL.createObjectURL(file);
      setBoatPhoto(file);
      setPhotoPreview(objectUrl);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      if (photoPreview) {
        try { URL.revokeObjectURL(photoPreview); } catch {}
      }
      const objectUrl = URL.createObjectURL(file);
      setBoatPhoto(file);
      setPhotoPreview(objectUrl);
    }
  };

  const handleRemovePhoto = () => {
    if (photoPreview) {
      try { URL.revokeObjectURL(photoPreview); } catch {}
    }
    setBoatPhoto(null);
    setPhotoPreview(null);
    const input = document.getElementById('photo-input');
    if (input) input.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const boatResponse = await api.post('/boats/', formData);
      const newBoatId = boatResponse.data.id;

      if (boatPhoto) {
        const photoData = new FormData();
        photoData.append('file', boatPhoto);
        photoData.append('attachment_type', 'photo');

        await api.post(`/boats/${newBoatId}/attachments/`, photoData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      navigate('/dashboard');
    } catch (err) {
      console.error('Error al crear el barco:', err.response?.data);
      setError(JSON.stringify(err.response?.data) || 'Ocurrió un error al crear el barco.');
    } finally {
      setLoading(false);
    }
  };

  const filteredBrands = brands.filter(b =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  const filteredModels = models.filter(m =>
    m.name.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const filteredPorts = ports.filter(p =>
    p.name.toLowerCase().includes(portSearch.toLowerCase())
  );

  return (
    <div style={{
      minHeight: '100vh',
      padding: '40px 20px',
      background: '#d7e5f3'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#3878b6' }}>
          Añade Tu Primer Barco
        </h2>

        {error && (
          <div className="alert alert-error">⚠ {error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px'
          }}>

            {/* LEFT SIDE FIELDS */}
            <div>
              <div className="form-group">
                <label className="form-label">Nombre del Barco*</label>
                <input type="text" name="name" className="form-input"
                  value={formData.name} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label className="form-label">Matrícula*</label>
                <input type="text" name="registration_number" className="form-input"
                  value={formData.registration_number} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label className="form-label">Año*</label>
                <input type="number" name="year" className="form-input"
                  value={formData.year} onChange={handleChange} required />
              </div>

              {/* Brand autocomplete */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Fabricante*</label>
                <input type="text" className="form-input" placeholder="Buscar fabricante..."
                  value={brandSearch}
                  onFocus={() => setShowBrandList(true)}
                  onChange={(e) => {
                    setBrandSearch(e.target.value);
                    setShowBrandList(true);
                  }}
                />

                {showBrandList && (
                  <ul style={{
                    position: 'absolute', top: '72px', left: 0, right: 0,
                    background: 'white', border: '1px solid #ccc',
                    borderRadius: '8px', maxHeight: '200px', overflowY: 'auto',
                    zIndex: 10, padding: 0, margin: 0, listStyle: 'none'
                  }}>
                    {filteredBrands.map(brand => (
                      <li key={brand.id}
                        style={{ padding: '10px', cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedBrand(brand.id);
                          setBrandSearch(brand.name);
                          setShowBrandList(false);
                          setModelSearch('');
                          setFormData(prev => ({ ...prev, model: '' }));
                        }}
                      >
                        {brand.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Model autocomplete */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Modelo*</label>

                <input type="text" className="form-input" placeholder="Buscar modelo..."
                  disabled={!selectedBrand}
                  value={modelSearch}
                  onFocus={() => selectedBrand && setShowModelList(true)}
                  onChange={(e) => {
                    setModelSearch(e.target.value);
                    setShowModelList(true);
                  }}
                />

                {showModelList && selectedBrand && (
                  <ul style={{
                    position: 'absolute', top: '72px', left: 0, right: 0,
                    background: 'white', border: '1px solid #ccc',
                    borderRadius: '8px', maxHeight: '200px', overflowY: 'auto',
                    zIndex: 10, padding: 0, margin: 0, listStyle: 'none'
                  }}>
                    {filteredModels.map(model => (
                      <li key={model.id}
                        style={{ padding: '10px', cursor: 'pointer' }}
                        onClick={() => {
                          setModelSearch(model.name);
                          setFormData(prev => ({ ...prev, model: model.id }));
                          setShowModelList(false);
                        }}
                      >
                        {model.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Port autocomplete */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Puerto Base*</label>

                <input type="text" className="form-input" placeholder="Buscar puerto..."
                  value={portSearch}
                  onFocus={() => setShowPortList(true)}
                  onChange={(e) => {
                    setPortSearch(e.target.value);
                    setShowPortList(true);
                  }}
                />

                {showPortList && (
                  <ul style={{
                    position: 'absolute', top: '72px', left: 0, right: 0,
                    background: 'white', border: '1px solid #ccc',
                    borderRadius: '8px', maxHeight: '200px', overflowY: 'auto',
                    zIndex: 10, padding: 0, margin: 0, listStyle: 'none'
                  }}>
                    {filteredPorts.map(port => (
                      <li key={port.id}
                        style={{ padding: '10px', cursor: 'pointer' }}
                        onClick={() => {
                          setPortSearch(port.name);
                          setFormData(prev => ({ ...prev, port: port.id }));
                          setShowPortList(false);
                        }}
                      >
                        {port.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* RIGHT SIDE — FOTO */}
            <div>
              <label className="form-label">Foto del Barco (opcional)</label>

              {photoPreview ? (
                <div
                  className="photo-preview"
                  style={{
                    position: 'relative',
                    width: '100%',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer'
                  }}
                >
                  <img
                    src={photoPreview}
                    alt="Preview"
                    style={{
                      width: '100%',
                      display: 'block',
                      borderRadius: '12px'
                    }}
                  />

                  {/* Overlay */}
                  <div
                    className="photo-overlay"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0,0,0,0.55)',
                      color: 'white',
                      opacity: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      transition: '0.25s ease',
                      padding: '10px',
                      textAlign: 'center'
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        background: 'rgba(255,255,255,0.9)',
                        color: '#333',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontWeight: '600'
                      }}
                      onClick={() => document.getElementById('photo-input').click()}
                    >
                      Cambiar foto
                    </button>

                    <button
                      type="button"
                      className="btn btn-error"
                      style={{
                        background: 'rgba(255,50,50,0.9)',
                        color: 'white',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontWeight: '600'
                      }}
                      onClick={handleRemovePhoto}
                    >
                      Eliminar foto
                    </button>
                  </div>

                  <style>
                    {`
                      .photo-preview:hover .photo-overlay {
                        opacity: 1 !important;
                      }
                    `}
                  </style>
                </div>
              ) : (
                <div
                  className={`photo-upload-zone ${isDragging ? 'dragging' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => {
                    const input = document.getElementById('photo-input');
                    if (input) input.click();
                  }}
                  style={{
                    cursor: 'pointer',
                    border: '2px dashed #bcd6ef',
                    borderRadius: '12px',
                    textAlign: 'center'
                  }}
                >
                  <p>{isDragging ? 'Suelta la imagen aquí' : 'Añadir foto — haz click o arrastra y suelta'}</p>
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                id="photo-input"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '30px' }}>
            <button className="btn btn-secondary" type="button" onClick={() => navigate('/dashboard')}>
              ← Volver
            </button>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginLeft: '12px' }}>
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default AddBoat;
