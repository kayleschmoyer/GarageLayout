import React, { useContext, useState } from 'react';
import { Modal, ModalDialog, Input, Button } from '@mui/joy';
import { AppContext } from '../App';

const GarageSelector = () => {
  const { garages, setGarages, selectGarage, mode, setMode } = useContext(AppContext);
  const [showModal, setShowModal] = useState(false);
  const [newGarage, setNewGarage] = useState({ name: '', address: '' });
  const [showContacts, setShowContacts] = useState(true);

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

        {/* Contacts Section */}
        <div className="contacts-section-selector">
          <button
            className="contacts-header"
            onClick={() => setShowContacts(!showContacts)}
          >
            <div className="contacts-header-left">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>Emergency Contacts</span>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ transform: showContacts ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>

          {showContacts && (
            <div className="contacts-content">
              <div className="contact-item">
                <div className="contact-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </div>
                <div className="contact-info">
                  <div className="contact-label">Emergency</div>
                  <a href="tel:911" className="contact-value contact-link">911</a>
                </div>
              </div>

              <div className="contact-item">
                <div className="contact-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </div>
                <div className="contact-info">
                  <div className="contact-label">Maintenance</div>
                  <a href="tel:+15551234567" className="contact-value contact-link">(555) 123-4567</a>
                </div>
              </div>

              <div className="contact-item">
                <div className="contact-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div className="contact-info">
                  <div className="contact-label">Support Email</div>
                  <a href="mailto:support@garage.com" className="contact-value contact-link">support@garage.com</a>
                </div>
              </div>
            </div>
          )}
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
