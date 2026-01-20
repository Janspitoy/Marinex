import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import AddBoat from './pages/AddBoat';
import Dashboard from './pages/Dashboard';
import Header from './components/Header';
import './index.css';

const ProtectedLayout = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div>
      <Header />
      <div style={{ padding: '20px' }}>
        <Outlet />
      </div>
    </div>
  );
};


function App() {
  const { isAuthenticated } = useAuth();

  return (
    <div>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/add-boat" element={<AddBoat />} />
        </Route>

        <Route
          path="/"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/login" />}
        />
      </Routes>
    </div>
  );
}

export default App;