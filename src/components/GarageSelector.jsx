import React, { useContext, useState } from 'react';
import { Modal, ModalDialog, Input, Button } from '@mui/joy';
import { AppContext } from '../App';

const GarageSelector = () => {
  const { garages, setGarages, selectGarage, mode, setMode } = useContext(AppContext);
  const [showModal, setShowModal] = useState(false);
  const [newGarage, setNewGarage] = useState({ name: '', address: '' });

  const addGarage = () => {
    if (!newGarage.name.trim()) return;
    const newId = Math.max(...garages.map(g => g.id), 0) + 1;
    const garage = {
      id: newId,
      name: newGarage.name,
      address: newGarage.address,
      levels: []
    };
    setGarages([...garages, garage]);
    setNewGarage({ name: '', address: '' });
    setShowModal(false);
    selectGarage(newId);
  };

  const deleteGarage = (e, garageId) => {
    e.stopPropagation();
    if (garages.length <= 1) return;
    setGarages(garages.filter(g => g.id !== garageId));
  };

  return (
    <div className="selector-view">
      {/* Header */}
      <header className="selector-header">
        <div className="selector-header-content">
          <div className="logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18" />
              <path d="M5 21V7l7-4 7 4v14" />
              <path d="M9 21v-6h6v6" />
            </svg>
            <span>Garage Layout Editor</span>
          </div>
          <button 
            className="icon-btn"
            onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          >
            {mode === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="selector-content">
        <div className="selector-intro">
          <h1>Select a Garage</h1>
          <p>Choose an existing garage to edit or create a new one</p>
        </div>

        <div className="garage-grid">
          {garages.map(garage => (
            <div 
              key={garage.id} 
              className="garage-card"
              onClick={() => selectGarage(garage.id)}
            >
              <div className="garage-card-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 21h18" />
                  <path d="M5 21V7l7-4 7 4v14" />
                  <path d="M9 21v-6h6v6" />
                </svg>
              </div>
              <div className="garage-card-info">
                <h3>{garage.name}</h3>
                {garage.address && <p className="address">{garage.address}</p>}
                <p className="stats">
                  {garage.levels.length} level{garage.levels.length !== 1 ? 's' : ''}
                  {garage.levels.length > 0 && (
                    <span> · {garage.levels.reduce((sum, l) => sum + (l.totalSpots || 0), 0)} spots</span>
                  )}
                </p>
              </div>
              {garages.length > 1 && (
                <button 
                  className="garage-card-delete"
                  onClick={(e) => deleteGarage(e, garage.id)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                </button>
              )}
            </div>
          ))}

          {/* Add New Card */}
          <div 
            className="garage-card add-new"
            onClick={() => setShowModal(true)}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>Add New Garage</span>
          </div>
        </div>
      </div>

      {/* Add Garage Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <ModalDialog sx={{ borderRadius: '12px', p: 3, maxWidth: 400, bgcolor: 'background.surface' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600 }}>New Garage</h3>
          <p style={{ margin: '0 0 20px', fontSize: '14px', opacity: 0.6 }}>
            Enter the details for your new garage
          </p>
          
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Garage Name</label>
            <Input
              placeholder="e.g., Downtown Parking"
              value={newGarage.name}
              onChange={(e) => setNewGarage({ ...newGarage, name: e.target.value })}
              autoFocus
            />
          </div>
          
          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Address (optional)</label>
            <Input
              placeholder="e.g., 123 Main Street"
              value={newGarage.address}
              onChange={(e) => setNewGarage({ ...newGarage, address: e.target.value })}
            />
          </div>
          
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="plain" color="neutral" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={addGarage} disabled={!newGarage.name.trim()}>
              Create Garage
            </Button>
          </div>
        </ModalDialog>
      </Modal>
    </div>
  );
};

export default GarageSelector;
