import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import logo from '../assets/logo_marinex.png';

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [boatName, setBoatName] = useState('Cargando Barco...');

  const userName = user
    ? (user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.username || user.email)
    : 'Invitado';

  useEffect(() => {
    const fetchBoatName = async () => {
      try {
        const response = await api.get('/boats/');
        if (response.data.results && response.data.results.length > 0) {
          setBoatName(response.data.results[0].name);
        } else {
          setBoatName('No hay barcos');
        }
      } catch (error) {
        console.error("Error al obtener el nombre del barco:", error);
        setBoatName('Error al cargar barco');
      }
    };

    if (user) {
      fetchBoatName();
    } else {
      setBoatName('');
    }
  }, [user]);

  const handleLogout = () => logout();

  return (
    <header
      className="dashboard-header"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "65px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 25px",
        backdropFilter: "blur(16px)",
        background: "rgba(255, 255, 255, 0.55)",
        zIndex: 999,
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)"
      }}
    >

      {/* Left — logo */}
      <div
        className="header-left"
        style={{ display: "flex", alignItems: "center", gap: "10px" }}
      >
        <img
          src={logo}
          alt="Marinex Logo"
          style={{
            height: "27px",
            cursor: "pointer",
            userSelect: "none",
            opacity: 0.95,
          }}
          onClick={() => navigate('/dashboard')}
        />

        <h1
          style={{
            margin: 0,
            fontSize: "20px",
            fontWeight: "700",
            color: "#0A3A62",
            letterSpacing: "0.5px",
            cursor: "pointer",
            userSelect: "none"
          }}
          onClick={() => navigate('/dashboard')}
        >
          MARINEX
        </h1>
      </div>

      {/* Center — boat name */}
      <div className="header-center" style={{ flex: 1, textAlign: "center" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "22px",
            fontWeight: "600",
            color: "#0A3A62",
            textShadow: "0 1px 1px rgba(255,255,255,0.5)"
          }}
        >
          {boatName}
        </h1>
      </div>

      {/* Right — logout */}
      <div className="header-right">
        <button
          onClick={handleLogout}
          className="btn btn-logout"
          style={{
            padding: "8px 16px",
            background: "#E94B4B",
            color: "#fff",
            border: "none",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
            transition: "0.2s",
            boxShadow: "0 2px 8px rgba(233,75,75,0.3)"
          }}
          onMouseOver={(e) => e.target.style.background = "#d14040"}
          onMouseOut={(e) => e.target.style.background = "#E94B4B"}
        >
          Salir
        </button>
      </div>
    </header>
  );
}

export default Header;
