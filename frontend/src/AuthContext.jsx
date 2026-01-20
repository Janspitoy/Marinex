import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const navigate = useNavigate();

  // ================================
  //  CHECK AUTH
  // ================================
  useEffect(() => {
    const checkUser = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/me/');
        setUser(response.data);
        setIsAuthenticated(true);
      } catch (e) {
        localStorage.clear();
        sessionStorage.clear();
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  // ================================
  // LOGIN
  // ================================
  const login = async (username, password) => {
    try {
      const response = await api.post('/token/', { username, password });

      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);

      const userResponse = await api.get('/me/');
      setUser(userResponse.data);
      setIsAuthenticated(true);

      navigate(userResponse.data.has_boats ? '/dashboard' : '/add-boat');
    } catch (error) {
      throw error.response?.data?.detail || "Failed to login";
    }
  };

  // ================================
  // CONFIRM LOGOUT
  // ================================
  const confirmLogout = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();

      delete api.defaults.headers.common["Authorization"];

      setUser(null);
      setIsAuthenticated(false);

      setLogoutModalOpen(false);

      window.location.href = "/login";
    } catch (e) {
      window.location.href = "/login";
    }
  };

  // ================================
  // Control modal
  // ================================
  const openLogoutModal = () => setLogoutModalOpen(true);
  const closeLogoutModal = () => setLogoutModalOpen(false);

  // ================================
  // PUBLIC logout() → opens modal
  // ================================
  const logout = () => {
    openLogoutModal();
  };

  const value = {
    user,
    setUser,
    isAuthenticated,
    loading,
    login,
    logout,
    openLogoutModal,
    closeLogoutModal,
    confirmLogout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}

      {/* MODAL */}
      {logoutModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={closeLogoutModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              padding: "30px",
              borderRadius: "12px",
              width: "90%",
              maxWidth: "420px",
              textAlign: "center",
              boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
            }}
          >
            <h3 style={{ marginTop: 0, color: "#d9534f" }}>
              Confirmar cierre de sesión
            </h3>

            <p style={{ marginTop: "10px" }}>
              ¿Seguro que deseas cerrar sesión?
              <br />
              Se eliminarán todos tus datos locales.
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: "15px", marginTop: "25px" }}>
              <button
                onClick={closeLogoutModal}
                className="btn btn-secondary"
                style={{ padding: "8px 14px" }}
              >
                Cancelar
              </button>

              <button
                onClick={confirmLogout}
                className="btn btn-error"
                style={{ padding: "8px 14px" }}
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};
