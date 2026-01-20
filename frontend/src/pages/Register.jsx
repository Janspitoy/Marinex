import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api_public } from '../api';

function Register() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    dni: '',
    account_name: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api_public.post('/register/', formData);

      console.log('Registration successful:', response.data);
      navigate('/login');
    } catch (err) {
      console.error('Registration failed:', err.response?.data);
      setError(JSON.stringify(err.response?.data) || 'Ocurrió un error al registrar la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: '700px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ margin: '0 0 8px 0', color: '#3878b6', fontSize: '32px' }}>
            Crear Cuenta
          </h2>
          <p style={{ color: '#9ca3af', margin: 0 }}>
            Completa tus datos para empezar
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Usuario*</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={loading}
                className="form-input"
                placeholder="Nombre de usuario"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña*</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                className="form-input"
                placeholder="Contraseña segura"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nombre*</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                disabled={loading}
                className="form-input"
                placeholder="Tu nombre"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Apellido*</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                disabled={loading}
                className="form-input"
                placeholder="Tu apellido"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email*</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
              className="form-input"
              placeholder="tu@email.com"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">DNI/NIE</label>
              <input
                type="text"
                name="dni"
                value={formData.dni}
                onChange={handleChange}
                disabled={loading}
                className="form-input"
                placeholder="12345678A"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input
                type="text"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                disabled={loading}
                className="form-input"
                placeholder="+34 600 000 000"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nombre de la Cuenta*</label>
            <input
              type="text"
              name="account_name"
              value={formData.account_name}
              onChange={handleChange}
              required
              disabled={loading}
              className="form-input"
              placeholder="Ej: Los Barcos de Juan"
            />
            <small style={{ color: '#9ca3af', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              Este será el nombre de tu cuenta principal
            </small>
          </div>

          <div style={{
            display: 'flex',
            gap: '16px',
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '2px solid #e5e7eb'
          }}>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="btn btn-secondary"
              disabled={loading}
              style={{ flex: 1 }}
            >
              ← Volver
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Registrando...
                </>
              ) : (
                '✓ Crear Cuenta'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;