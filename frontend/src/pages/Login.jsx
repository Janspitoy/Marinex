import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);

    } catch (err) {
      console.error('Login failed:', err);
      setError(err.toString() || 'Usuario o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '48px',
        maxWidth: '450px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ margin: '0 0 8px 0', color: '#3878b6', fontSize: '32px' }}>
            Bienvenido
          </h2>
          <p style={{ color: '#9ca3af', margin: 0 }}>
            Inicia sesión en tu cuenta
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
              className="form-input"
              placeholder="Tu nombre de usuario"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="form-input"
              placeholder="Tu contraseña"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Iniciando sesión...
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        <div style={{
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '2px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <p style={{ color: '#9ca3af', margin: '0 0 12px 0', fontSize: '14px' }}>
            ¿No tienes cuenta?
          </p>
          <button
            onClick={() => navigate('/register')}
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Crear nueva cuenta
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;