import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import api from '../api';

import TabBarco from './dashboard_tabs/TabBarco';
import TabPerfil from './dashboard_tabs/TabPerfil';
import TabTareas from './dashboard_tabs/TabTareas';
import TabDocumentos from './dashboard_tabs/TabDocumentos';
import TabTrabajos from './dashboard_tabs/TabTrabajos';
import TabBitacora from './dashboard_tabs/TabBitacora';
import TabEmpresas from './dashboard_tabs/TabEmpresas';

const getOverdueDocsCount = (docs) => {
  if (!docs) return 0;
  const now = new Date();
  return docs.filter(doc => {
    if (doc.no_expiration || !doc.expiration_date) return false;
    return new Date(doc.expiration_date) < now;
  }).length;
};

// Helper para contar tareas completadas
const getCompletedTasksCount = (tasks) => {
  if (!tasks) return 0;
  return tasks.filter(task => {
    const code = task.status_details?.code;
    return code === 'completed' || code === 'completado' || code === 'done';
  }).length;
};

// Helper para contar trabajos terminados
const getCompletedWorksCount = (works) => {
  if (!works) return 0;
  return works.filter(work => {
    const code = work.status_details?.code;
    return code === 'done';
  }).length;
};

function Dashboard() {
  const { user } = useAuth();

  const [boatPhotoUrl, setBoatPhotoUrl] = useState(null);
  const [boatId, setBoatId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Estados para las estadísticas
  const [docStats, setDocStats] = useState({ total: 0, overdue: 0 });
  const [taskStats, setTaskStats] = useState({ total: 0, completed: 0 });
  const [trabajosStats, setTrabajosStats] = useState({ total: 0, completed: 0 });

  const fetchBoatData = useCallback(async () => {
    try {
      const response = await api.get('/boats/');
      if (response.data.results && response.data.results.length > 0) {
        const boat = response.data.results[0];
        setBoatId(boat.id);

        const attachments = boat.attachments || [];
        const photo = attachments.find(att => att.attachment_type === 'photo');
        if (photo) {
          setBoatPhotoUrl(photo.file);
        }
        return boat.id;
      }
      return null;
    } catch (e) {
      console.error("Failed to fetch boat data", e);
      return null;
    }
  }, []);

  const fetchStats = useCallback(async (currentBoatId) => {
    if (!currentBoatId) return;

    try {
      // Cargamos Documentos, Tareas y Trabajos en paralelo
      const [docResponse, taskResponse, workResponse] = await Promise.all([
        api.get(`/boats/${currentBoatId}/documents/`),
        api.get(`/boats/${currentBoatId}/tasks/`),
        api.get(`/boats/${currentBoatId}/works/`)
      ]);

      // 1. Estadísticas Documentos
      const docs = docResponse.data.results || docResponse.data || [];
      setDocStats({
        total: docs.length,
        overdue: getOverdueDocsCount(docs)
      });

      // 2. Estadísticas Tareas
      const tasks = taskResponse.data.results || taskResponse.data || [];
      setTaskStats({
        total: tasks.length,
        completed: getCompletedTasksCount(tasks)
      });

      // 3. Estadísticas Trabajos
      const works = workResponse.data.results || workResponse.data || [];
      setTrabajosStats({
        total: works.length,
        completed: getCompletedWorksCount(works)
      });

    } catch (e) {
      console.error("Failed to fetch stats", e);
    }
  }, []);

  // --- FUNCIÓN PARA ACTUALIZAR ESTADÍSTICAS DESDE LOS HIJOS ---
  const handleStatsUpdate = () => {
    if (boatId) {
      fetchStats(boatId);
    }
  };

  useEffect(() => {
    if (!user) {
      setBoatId(null);
      setBoatPhotoUrl(null);
      setDocStats({ total: 0, overdue: 0 });
      setTaskStats({ total: 0, completed: 0 });
      setTrabajosStats({ total: 0, completed: 0 });
      return;
    }

    const initialize = async () => {
      setLoading(true);
      const id = await fetchBoatData();
      if (id) {
        await fetchStats(id);
      }
      setLoading(false);
    };

    initialize();
  }, [user, fetchBoatData, fetchStats]);

  if (loading) {
    return <div style={{ padding: "30px" }}>Cargando panel...</div>;
  }

  return (
    <div>
      <Tabs>
        <TabList className="main-tab-list">
          <Tab className="photo-tab" selectedClassName="photo-tab react-tabs__tab--selected">
            {boatPhotoUrl ? (
              <img src={boatPhotoUrl} alt="Barco" />
            ) : (
              <div className="photo-tab-placeholder">Mi Barco</div>
            )}
          </Tab>

          <Tab className="text-tab" selectedClassName="text-tab react-tabs__tab--selected">
            Documentos
            <span style={{ display: 'block', fontSize: '10px' }}>
              {docStats.total} Total / {docStats.overdue} Vencidos
            </span>
          </Tab>

          <Tab className="text-tab" selectedClassName="text-tab react-tabs__tab--selected">
            Tareas
            <span style={{ display: 'block', fontSize: '10px' }}>
              {taskStats.total} Total / {taskStats.completed} Hechas
            </span>
          </Tab>

          <Tab className="text-tab" selectedClassName="text-tab react-tabs__tab--selected">
            Trabajos
            <span style={{ display: 'block', fontSize: '10px' }}>
              {trabajosStats.total} Total / {trabajosStats.completed} Hechos
            </span>
          </Tab>

          <Tab className="text-tab" selectedClassName="text-tab react-tabs__tab--selected">
              Bitacora
              <span style={{ display: 'block', fontSize: '10px' }}>Gestiona su rutas</span>
          </Tab>
          <Tab className="text-tab" selectedClassName="text-tab react-tabs__tab--selected">
              Empresas
            <span style={{ display: 'block', fontSize: '10px' }}>Todas empresas</span>
          </Tab>
          <Tab className="text-tab" selectedClassName="text-tab react-tabs__tab--selected">
              Perfil
              <span style={{ display: 'block', fontSize: '10px' }}>Ver su perfil</span>
          </Tab>
        </TabList>

        <TabPanel className="tab-panel-content">
            <TabBarco boatId={boatId} />
        </TabPanel>

        {/* Pasamos onUpdateStats a Documentos (opcional) */}
        <TabPanel className="tab-panel-content">
            <TabDocumentos boatId={boatId} onUpdateStats={handleStatsUpdate} />
        </TabPanel>

        {/* Pasamos onUpdateStats a Tareas */}
        <TabPanel className="tab-panel-content">
            <TabTareas boatId={boatId} onUpdateStats={handleStatsUpdate} />
        </TabPanel>

        {/* Pasamos onUpdateStats a Trabajos */}
        <TabPanel className="tab-panel-content">
            <TabTrabajos boatId={boatId} onUpdateStats={handleStatsUpdate} />
        </TabPanel>

        <TabPanel className="tab-panel-content"><TabBitacora boatId={boatId} /></TabPanel>
        <TabPanel className="tab-panel-content"><TabEmpresas boatId={boatId} /></TabPanel>
        <TabPanel className="tab-panel-content"><TabPerfil /></TabPanel>
      </Tabs>
    </div>
  );
}

export default Dashboard;