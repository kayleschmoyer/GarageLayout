import React, { useContext, useState, useMemo, useCallback, useRef } from 'react';
import { Modal, ModalDialog, Input, Button } from '@mui/joy';
import { AppContext } from '../App';
import ContactsSidebar from './ContactsSidebar';

const INPUT_SX = Object.freeze({
  fontSize: 14,
  color: '#fafafa',
  bgcolor: '#27272a',
  borderColor: '#3f3f46',
  '&:hover': { borderColor: '#52525b' },
  '&:focus-within': { borderColor: '#3b82f6' },
  '&::placeholder': { color: '#71717a' }
});

const LABEL_STYLE = Object.freeze({
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
  color: '#a1a1aa',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
});

const MODAL_SX = Object.freeze({
  borderRadius: '12px',
  p: 0,
  width: '100%',
  maxWidth: 480,
  bgcolor: '#18181b',
  border: '1px solid #3f3f46',
  overflow: 'hidden'
});

const DEFAULT_NEW_LEVEL = Object.freeze({
  name: '',
  totalSpots: 100,
  evSpots: 0,
  handicapSpots: 0
});

const LEVEL_GRADIENTS_DARK = Object.freeze([
  'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)',
  'linear-gradient(135deg, #1a365d 0%, #1e1e2e 100%)',
  'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
  'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
  'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
  'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
  'linear-gradient(135deg, #3f3f46 0%, #18181b 100%)',
]);

const LEVEL_GRADIENTS_LIGHT = Object.freeze([
  'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
  'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
  'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'linear-gradient(135deg, #64748b 0%, #475569 100%)',
]);

const safeArray = (arr) => (Array.isArray(arr) ? arr : []);

const safeString = (val) => (typeof val === 'string' ? val : '');

const safeNumber = (val, fallback = 0) => {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sanitizeString = (val) => safeString(val).trim();

const generateLevelId = (levels) => {
  const safelevels = safeArray(levels);
  if (safelevels.length === 0) return 1;
  const ids = safelevels
    .map(l => (l && typeof l.id === 'number' ? l.id : 0))
    .filter(id => id > 0);
  return ids.length > 0 ? Math.max(...ids) + 1 : 1;
};

const LevelSelector = () => {
  const context = useContext(AppContext);
  const mountedRef = useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const garages = safeArray(context?.garages);
  const setGarages = typeof context?.setGarages === 'function' ? context.setGarages : () => { };
  const selectedGarageId = context?.selectedGarageId;
  const selectLevel = typeof context?.selectLevel === 'function' ? context.selectLevel : () => { };
  const goBack = typeof context?.goBack === 'function' ? context.goBack : () => { };
  const mode = context?.mode === 'light' ? 'light' : 'dark';
  const setMode = typeof context?.setMode === 'function' ? context.setMode : () => { };

  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLevel, setEditingLevel] = useState(null);
  const [newLevel, setNewLevel] = useState({ ...DEFAULT_NEW_LEVEL });
  const [isProcessing, setIsProcessing] = useState(false);

  const garage = useMemo(() => {
    if (selectedGarageId == null) return null;
    return garages.find(g => g && g.id === selectedGarageId) || null;
  }, [garages, selectedGarageId]);

  const fullAddress = useMemo(() => {
    if (!garage) return 'No address configured';
    const parts = [
      sanitizeString(garage.address),
      sanitizeString(garage.city),
      sanitizeString(garage.state),
      sanitizeString(garage.zip)
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'No address configured';
  }, [garage]);

  const stats = useMemo(() => {
    if (!garage) return { levels: 0, spots: 0, devices: 0 };
    const levels = safeArray(garage.levels);
    let spots = 0;
    let devices = 0;
    for (let i = 0; i < levels.length; i++) {
      const l = levels[i];
      if (l) {
        spots += safeNumber(l.totalSpots, 0);
        devices += safeArray(l.devices).length;
      }
    }
    return { levels: levels.length, spots, devices };
  }, [garage]);

  const toggleMode = useCallback(() => {
    if (!mountedRef.current) return;
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const handleCloseModal = useCallback(() => {
    if (!mountedRef.current) return;
    setShowModal(false);
    setNewLevel({ ...DEFAULT_NEW_LEVEL });
    setIsProcessing(false);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    if (!mountedRef.current) return;
    setShowEditModal(false);
    setEditingLevel(null);
    setIsProcessing(false);
  }, []);

  const addLevel = useCallback(() => {
    if (isProcessing) return;
    const trimmedName = sanitizeString(newLevel.name);
    if (!trimmedName) return;

    setIsProcessing(true);

    try {
      const updatedGarages = garages.map(g => {
        if (!g || g.id !== selectedGarageId) return g;
        const newId = generateLevelId(g.levels);
        return {
          ...g,
          levels: [
            ...safeArray(g.levels),
            {
              id: newId,
              name: trimmedName,
              totalSpots: safeNumber(newLevel.totalSpots, 0),
              evSpots: safeNumber(newLevel.evSpots, 0),
              handicapSpots: safeNumber(newLevel.handicapSpots, 0),
              bgImage: null,
              devices: []
            }
          ]
        };
      });

      setGarages(updatedGarages);

      if (mountedRef.current) {
        handleCloseModal();
      }
    } catch {
      if (mountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [isProcessing, newLevel, garages, selectedGarageId, setGarages, handleCloseModal]);

  const updateLevel = useCallback(() => {
    if (isProcessing) return;
    if (!editingLevel || editingLevel.id == null) return;
    const trimmedName = sanitizeString(editingLevel.name);
    if (!trimmedName) return;

    setIsProcessing(true);

    try {
      const updatedGarages = garages.map(g => {
        if (!g || g.id !== selectedGarageId) return g;
        return {
          ...g,
          levels: safeArray(g.levels).map(l => {
            if (!l || l.id !== editingLevel.id) return l;
            return {
              ...l,
              name: trimmedName,
              totalSpots: safeNumber(editingLevel.totalSpots, 0),
              evSpots: safeNumber(editingLevel.evSpots, 0),
              handicapSpots: safeNumber(editingLevel.handicapSpots, 0)
            };
          })
        };
      });

      setGarages(updatedGarages);

      if (mountedRef.current) {
        handleCloseEditModal();
      }
    } catch {
      if (mountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [isProcessing, editingLevel, garages, selectedGarageId, setGarages, handleCloseEditModal]);

  const deleteLevel = useCallback((e, levelId) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (isProcessing) return;
    if (levelId == null) return;

    setIsProcessing(true);

    try {
      const updatedGarages = garages.map(g => {
        if (!g || g.id !== selectedGarageId) return g;
        return {
          ...g,
          levels: safeArray(g.levels).filter(l => l && l.id !== levelId)
        };
      });

      setGarages(updatedGarages);

      if (mountedRef.current) {
        handleCloseEditModal();
      }
    } catch {
      if (mountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [isProcessing, garages, selectedGarageId, setGarages, handleCloseEditModal]);

  const handleUpdateContacts = useCallback((newContacts) => {
    if (!mountedRef.current) return;
    const sanitizedContacts = safeArray(newContacts);
    const updatedGarages = garages.map(g => {
      if (!g || g.id !== selectedGarageId) return g;
      return { ...g, contacts: sanitizedContacts };
    });
    setGarages(updatedGarages);
  }, [garages, selectedGarageId, setGarages]);

  const handleNewLevelChange = useCallback((field) => (e) => {
    if (!mountedRef.current) return;
    const value = e?.target?.value ?? '';
    setNewLevel(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleEditLevelChange = useCallback((field) => (e) => {
    if (!mountedRef.current) return;
    const value = e?.target?.value ?? '';
    setEditingLevel(prev => (prev ? { ...prev, [field]: value } : prev));
  }, []);

  const handleOpenEditLevel = useCallback((e, level) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (!level || level.id == null) return;
    setEditingLevel({
      id: level.id,
      name: safeString(level.name),
      totalSpots: safeNumber(level.totalSpots, 0),
      evSpots: safeNumber(level.evSpots, 0),
      handicapSpots: safeNumber(level.handicapSpots, 0)
    });
    setShowEditModal(true);
  }, []);

  const handleSelectLevel = useCallback((levelId) => {
    if (levelId == null) return;
    selectLevel(levelId);
  }, [selectLevel]);

  const handleOpenAddModal = useCallback(() => {
    setNewLevel({ ...DEFAULT_NEW_LEVEL });
    setShowModal(true);
  }, []);

  if (!garage) {
    return null;
  }

  const isNewLevelValid = sanitizeString(newLevel.name).length > 0;
  const isEditLevelValid = editingLevel && sanitizeString(editingLevel.name).length > 0;
  const garageName = sanitizeString(garage.name) || 'Property';
  const garageLevels = safeArray(garage.levels);

  return (
    <div className="selector-view">
      <header className="selector-header-modern">
        <div className="brand-section">
          <button
            className="back-btn-modern"
            onClick={goBack}
            title="Back to Properties"
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <img
            src="https://portal.ensightful.io/assets/img/ensight-logo.png"
            alt="Ensight"
            className="brand-logo-img"
            style={{ height: 28, width: 'auto' }}
            onError={(e) => {
              if (e.target) e.target.style.display = 'none';
            }}
          />
          <span className="brand-title">Admin Console</span>
        </div>

        <div className="header-right-controls">
          <button
            className="icon-btn"
            onClick={toggleMode}
            title="Toggle Theme"
            type="button"
            style={{
              padding: 6,
              borderRadius: '4px',
              border: '1px solid var(--joy-palette-neutral-200)',
              cursor: 'pointer',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {mode === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <div className="view-wrapper">
        <ContactsSidebar
          contacts={safeArray(garage.contacts)}
          garageName={garageName}
          onUpdateContacts={handleUpdateContacts}
        />

        <div className="main-content-scroll">
          <div className="modern-layout-container">
            <div className="dashboard-header">
              <div className="dashboard-title">
                <h1>{garageName}</h1>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dashboard-address-link"
                  title="View on Google Maps"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {fullAddress}
                </a>
              </div>

              <div className="stats-row">
                <div className="status-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                  <span>{stats.levels} Levels</span>
                </div>

                <div className="status-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  </svg>
                  <span>{stats.spots} Total Spots</span>
                </div>

                <div className="status-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42m12.72-12.72l1.42-1.42" />
                  </svg>
                  <span>{stats.devices} Devices</span>
                </div>
              </div>
            </div>

            <div className="content-area">
              <div className="section-tools">
                <div className="section-label">All Levels</div>
              </div>

              <div className="levels-grid">
                {garageLevels.map((level, index) => {
                  if (!level || level.id == null) return null;
                  const deviceCount = safeArray(level.devices).length;
                  const gradients = mode === 'dark' ? LEVEL_GRADIENTS_DARK : LEVEL_GRADIENTS_LIGHT;
                  const gradientIndex = index % gradients.length;
                  const gradient = level.bgImage
                    ? `url(${level.bgImage})`
                    : gradients[gradientIndex];

                  return (
                    <div
                      key={level.id}
                      className="level-card-premium"
                      onClick={() => handleSelectLevel(level.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectLevel(level.id);
                        }
                      }}
                    >
                      <div
                        className="level-card-bg"
                        style={{ background: gradient, backgroundSize: 'cover', backgroundPosition: 'center' }}
                      />

                      <div className="level-card-glass" />

                      <div className="level-card-content">
                        <div className="level-card-actions">
                          <button
                            className="level-action-btn"
                            onClick={(e) => handleOpenEditLevel(e, level)}
                            title="Edit Level"
                            type="button"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        </div>

                        <div className="level-card-center">
                          <div className="level-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                              <line x1="12" y1="22.08" x2="12" y2="12" />
                            </svg>
                          </div>
                          <h3 className="level-name">{safeString(level.name) || 'Unnamed Level'}</h3>
                        </div>

                        <div className="level-card-stats">
                          <div className="level-stat">
                            <span className="level-stat-value">{safeNumber(level.totalSpots, 0)}</span>
                            <span className="level-stat-label">Spots</span>
                          </div>
                          <div className="level-stat-divider" />
                          <div className="level-stat">
                            <span className="level-stat-value">{safeNumber(level.evSpots, 0)}</span>
                            <span className="level-stat-label">EV</span>
                          </div>
                          <div className="level-stat-divider" />
                          <div className="level-stat">
                            <span className="level-stat-value">{safeNumber(level.handicapSpots, 0)}</span>
                            <span className="level-stat-label">ADA</span>
                          </div>
                          <div className="level-stat-divider" />
                          <div className="level-stat">
                            <span className="level-stat-value">{deviceCount}</span>
                            <span className="level-stat-label">Devices</span>
                          </div>
                        </div>

                        <div className="level-card-arrow">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div
                  className="level-card-add"
                  onClick={handleOpenAddModal}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenAddModal();
                    }
                  }}
                >
                  <div className="add-level-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                  <span>Add Level</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={showModal} onClose={handleCloseModal}>
        <ModalDialog sx={MODAL_SX}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #3f3f46', background: '#27272a' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fafafa' }}>Add New Level</h3>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={LABEL_STYLE}>Level Name</label>
              <Input
                size="sm"
                placeholder="e.g., Level 1, Basement, Rooftop"
                value={newLevel.name}
                onChange={handleNewLevelChange('name')}
                autoFocus
                sx={INPUT_SX}
              />
            </div>

            <div>
              <label style={LABEL_STYLE}>Total Parking Spots</label>
              <Input
                size="sm"
                type="number"
                value={newLevel.totalSpots}
                onChange={handleNewLevelChange('totalSpots')}
                slotProps={{ input: { min: 0 } }}
                sx={INPUT_SX}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL_STYLE}>EV Charging Spots</label>
                <Input
                  size="sm"
                  type="number"
                  value={newLevel.evSpots}
                  onChange={handleNewLevelChange('evSpots')}
                  slotProps={{ input: { min: 0 } }}
                  sx={INPUT_SX}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>ADA/Handicap Spots</label>
                <Input
                  size="sm"
                  type="number"
                  value={newLevel.handicapSpots}
                  onChange={handleNewLevelChange('handicapSpots')}
                  slotProps={{ input: { min: 0 } }}
                  sx={INPUT_SX}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid #3f3f46', background: '#27272a' }}>
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              onClick={handleCloseModal}
              disabled={isProcessing}
              sx={{ color: '#fafafa', borderColor: '#3f3f46', '&:hover': { bgcolor: '#3f3f46' } }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={addLevel}
              disabled={!isNewLevelValid || isProcessing}
              loading={isProcessing}
            >
              Add Level
            </Button>
          </div>
        </ModalDialog>
      </Modal>

      <Modal open={showEditModal} onClose={handleCloseEditModal}>
        <ModalDialog sx={MODAL_SX}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #3f3f46', background: '#27272a' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fafafa' }}>Edit Level</h3>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={LABEL_STYLE}>Level Name</label>
              <Input
                size="sm"
                placeholder="e.g., Level 1, Basement, Rooftop"
                value={editingLevel?.name || ''}
                onChange={handleEditLevelChange('name')}
                autoFocus
                sx={INPUT_SX}
              />
            </div>

            <div>
              <label style={LABEL_STYLE}>Total Parking Spots</label>
              <Input
                size="sm"
                type="number"
                value={editingLevel?.totalSpots ?? 0}
                onChange={handleEditLevelChange('totalSpots')}
                slotProps={{ input: { min: 0 } }}
                sx={INPUT_SX}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL_STYLE}>EV Charging Spots</label>
                <Input
                  size="sm"
                  type="number"
                  value={editingLevel?.evSpots ?? 0}
                  onChange={handleEditLevelChange('evSpots')}
                  slotProps={{ input: { min: 0 } }}
                  sx={INPUT_SX}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>ADA/Handicap Spots</label>
                <Input
                  size="sm"
                  type="number"
                  value={editingLevel?.handicapSpots ?? 0}
                  onChange={handleEditLevelChange('handicapSpots')}
                  slotProps={{ input: { min: 0 } }}
                  sx={INPUT_SX}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #3f3f46', background: '#27272a' }}>
            <Button
              size="sm"
              variant="soft"
              color="danger"
              onClick={(e) => editingLevel && deleteLevel(e, editingLevel.id)}
              disabled={isProcessing}
            >
              Delete Level
            </Button>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                size="sm"
                variant="outlined"
                color="neutral"
                onClick={handleCloseEditModal}
                disabled={isProcessing}
                sx={{ color: '#fafafa', borderColor: '#3f3f46', '&:hover': { bgcolor: '#3f3f46' } }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={updateLevel}
                disabled={!isEditLevelValid || isProcessing}
                loading={isProcessing}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </ModalDialog>
      </Modal>
    </div>
  );
};

export default LevelSelector;
