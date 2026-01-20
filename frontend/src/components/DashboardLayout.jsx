// src/components/DashboardLayout.jsx
import React from 'react';
import { useAuth } from '../AuthContext';
import BoatHeader from './BoatHeader'; // Создадим этот компонент далее

function DashboardLayout({ children, currentTab, boatData, onTabChange, boatPhotoUrl }) {
    const { user } = useAuth();
    const userName = user?.first_name || user?.username || 'Usuario'; // 'Peter Stanton'

    const tabs = [
        { id: 'documentos', title: 'Documentos', icon: '📄', docsCount: 15, alarmsCount: 2 },
        { id: 'tareas', title: 'Tareas', icon: '✅', docsCount: 15, alarmsCount: 2 },
        { id: 'empresas', title: 'Empresas', icon: '🏢', docsCount: 15, alarmsCount: 2 },
        { id: 'gastos', title: 'Gastos', icon: '💰', docsCount: 15, alarmsCount: 2 },
        { id: 'bitacora', title: 'Bitacora', icon: '📖', docsCount: 15, alarmsCount: 2 },
        { id: 'barco', title: 'Barco', icon: '🛥️' }, // TabBarco, без счетчиков
        { id: 'perfil', title: 'Perfil', icon: '👤' }, // TabPerfil, без счетчиков
    ];

    return (
        <div className="dashboard-container">
            {/* --- Верхний хедер (Control Boat, Peter Stanton) --- */}
            <header className="app-header">
                <div className="logo">
                    {/* <img src="/path/to/your/logo.svg" alt="Control Boat" /> */}
                    CB Control Boat
                </div>
                <div className="user-info">
                    <span>{userName.toUpperCase()}</span>
                    <div className="user-avatar">
                        {user?.profile_picture ? (
                            <img src={user.profile_picture} alt="User Avatar" />
                        ) : (
                            userName.charAt(0).toUpperCase()
                        )}
                    </div>
                </div>
            </header>

            {/* --- Секция информации о лодке --- */}
            <BoatHeader boatData={boatData} boatPhotoUrl={boatPhotoUrl} />

            {/* --- Карточки-вкладки (Documentos, Tareas, etc.) --- */}
            <div className="dashboard-tabs">
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        className={`dashboard-tab-card ${currentTab === tab.id ? 'active' : ''}`}
                        onClick={() => onTabChange(tab.id)}
                    >
                        <div className="icon">{tab.icon}</div>
                        <div className="title">{tab.title}</div>
                        {tab.docsCount !== undefined && (
                            <div className="info">
                                {tab.docsCount} Documentos <br />
                                {tab.alarmsCount} Alarmas
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* --- Область основного контента для выбранной вкладки --- */}
            <div className="tab-content-area">
                {children} {/* Здесь будет отображаться содержимое текущей вкладки */}
            </div>
        </div>
    );
}

export default DashboardLayout;