// src/components/BoatHeader.jsx
import React from 'react';

function BoatHeader({ boatData, boatPhotoUrl }) {
    if (!boatData) {
        return (
            <div className="content-card" style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ width: '150px', height: '100px', borderRadius: '10px', backgroundColor: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#888' }}>
                    Нет фото лодки
                </div>
                <div>
                    <h3>Загрузка информации о лодке...</h3>
                    <p style={{ color: '#666' }}>Пожалуйста, подождите.</p>
                </div>
            </div>
        );
    }

    const displayName = boatData.name || 'Unnamed Boat';
    const displayModel = boatData.model_name || 'Modelo Desconocido';
    const displayBrand = boatData.brand_name || 'Marca Desconocida';

    return (
        <div className="content-card" style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '25px' }}>
            <div style={{ width: '200px', height: '120px', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#e0e6ed', flexShrink: 0 }}>
                {boatPhotoUrl ? (
                    <img src={boatPhotoUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#666' }}>
                        Нет фото
                    </div>
                )}
            </div>
            <div>
                <h3 style={{ margin: '0', fontSize: '24px', color: '#333' }}>
                    {displayName}. {displayBrand} {displayModel}
                </h3>
            </div>
        </div>
    );
}

export default BoatHeader;