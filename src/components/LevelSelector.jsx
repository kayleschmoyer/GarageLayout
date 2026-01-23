import React, { useContext, useState } from 'react';
import { Modal, ModalDialog, Input, Button, FormLabel } from '@mui/joy';
import { AppContext } from '../App';
import ContactsSidebar from './ContactsSidebar';

const LevelSelector = () => {
  const {
    garages,
    setGarages,
    selectedGarageId,
    selectLevel,
    goBack,
    mode,
    setMode
  } = useContext(AppContext);

  const [showModal, setShowModal] = useState(false);
  const [newLevel, setNewLevel] = useState({
    name: '',
    totalSpots: 100,
    evSpots: 0,
    handicapSpots: 0
  });

  const garage = garages.find(g => g.id === selectedGarageId);

  if (!garage) {
    return null;
  }

  const addLevel = () => {
    if (!newLevel.name.trim()) return;

    const updatedGarages = garages.map(g => {
      if (g.id === selectedGarageId) {
        const newId = Math.max(...g.levels.map(l => l.id), 0) + 1;
        return {
          ...g,
          levels: [...g.levels, {
            id: newId,
            name: newLevel.name,
            totalSpots: parseInt(newLevel.totalSpots) || 0,
            evSpots: parseInt(newLevel.evSpots) || 0,
            handicapSpots: parseInt(newLevel.handicapSpots) || 0,
            bgImage: null,
            devices: []
          }]
        };
      }
      return g;
    });

    setGarages(updatedGarages);
    setNewLevel({ name: '', totalSpots: 100, evSpots: 0, handicapSpots: 0 });
    setShowModal(false);
  };

  const deleteLevel = (e, levelId) => {
    e.stopPropagation();
    const updatedGarages = garages.map(g => {
      if (g.id === selectedGarageId) {
        return {
          ...g,
          levels: g.levels.filter(l => l.id !== levelId)
        };
      }
      return g;
    });
    setGarages(updatedGarages);
  };

  // Logic: Update Contacts for specific garage
  const handleUpdateContacts = (newContacts) => {
    const updatedGarages = garages.map(g => {
      if (g.id === selectedGarageId) {
        return { ...g, contacts: newContacts };
      }
      return g;
    });
    setGarages(updatedGarages);
  };

  return (
    <div className="selector-view">
      {/* Header */}
      <header className="selector-header">
        <div className="selector-header-content">
          <div className="header-left">
            <button className="back-btn" onClick={goBack}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="logo">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 21h18" />
                <path d="M5 21V7l7-4 7 4v14" />
                <path d="M9 21v-6h6v6" />
              </svg>
              <span>Garage Layout Editor</span>
            </div>
          </div>
          <button
            className="icon-btn"
            onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          >
            {mode === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <div className="view-wrapper">
        <ContactsSidebar
          contacts={garage.contacts || []}
          garageName={garage.name}
          onUpdateContacts={handleUpdateContacts}
        />

        {/* Main Content */}
        <div className="main-content-scroll">
          <div className="selector-content">
            <div className="selector-intro">
              <h1>{garage.name}</h1>
              <p>{garage.address || 'Select a level to edit or create a new one'}</p>
            </div>

            <div className="level-grid">
              {garage.levels.map(level => (
                <div
                  key={level.id}
                  className="level-card"
                  onClick={() => selectLevel(level.id)}
                >
                  <div className="level-card-header">
                    <div className="level-number">{level.name}</div>
                    <button
                      className="level-card-delete"
                      onClick={(e) => deleteLevel(e, level.id)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                  <div className="level-card-stats">
                    <div className="stat">
                      <span className="stat-value">{level.totalSpots}</span>
                      <span className="stat-label">Total Spots</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{level.evSpots}</span>
                      <span className="stat-label">EV Spots</span>
                    </div>
                    <div className="stat">
                      <span className="stat-value">{level.handicapSpots}</span>
                      <span className="stat-label">ADA Spots</span>
                    </div>
                  </div>
                  <div className="level-card-footer">
                    <span>{level.devices?.length || 0} devices placed</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              ))}

              {/* Add New Level Card */}
              <div
                className="level-card add-new"
                onClick={() => setShowModal(true)}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span>Add New Level</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Level Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <ModalDialog sx={{ borderRadius: '12px', p: 3, maxWidth: 420, bgcolor: 'background.surface' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600 }}>Add Level</h3>
          <p style={{ margin: '0 0 20px', fontSize: '14px', opacity: 0.6 }}>
            Configure the new level for {garage.name}
          </p>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Level Name</label>
            <Input
              placeholder="e.g., Level 1, Basement, Rooftop"
              value={newLevel.name}
              onChange={(e) => setNewLevel({ ...newLevel, name: e.target.value })}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Total Parking Spots</label>
            <Input
              type="number"
              value={newLevel.totalSpots}
              onChange={(e) => setNewLevel({ ...newLevel, totalSpots: e.target.value })}
              slotProps={{ input: { min: 0 } }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div>
              <label className="form-label">EV Charging Spots</label>
              <Input
                type="number"
                value={newLevel.evSpots}
                onChange={(e) => setNewLevel({ ...newLevel, evSpots: e.target.value })}
                slotProps={{ input: { min: 0 } }}
              />
            </div>
            <div>
              <label className="form-label">ADA/Handicap Spots</label>
              <Input
                type="number"
                value={newLevel.handicapSpots}
                onChange={(e) => setNewLevel({ ...newLevel, handicapSpots: e.target.value })}
                slotProps={{ input: { min: 0 } }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="plain" color="neutral" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={addLevel} disabled={!newLevel.name.trim()}>
              Add Level
            </Button>
          </div>
        </ModalDialog>
      </Modal>
    </div>
  );
};

export default LevelSelector;
