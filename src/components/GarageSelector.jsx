import React, { useContext, useState, useCallback, useMemo } from 'react';
import { Modal, ModalDialog, Input, Button } from '@mui/joy';
import { AppContext } from '../App';
import Weather from './Weather';
import ContactsSidebar from './ContactsSidebar';

const DEFAULT_NEW_GARAGE = Object.freeze({
  name: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  image: '',
  contacts: []
});

const DEFAULT_NEW_LINK = Object.freeze({
  name: '',
  url: '',
  icon: 'link'
});

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
  maxWidth: 520,
  bgcolor: '#18181b',
  border: '1px solid #3f3f46',
  overflow: 'hidden'
});

const LINK_MODAL_SX = Object.freeze({
  ...MODAL_SX,
  maxWidth: 400
});

const sanitizeString = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const sanitizeUrl = (value) => {
  const trimmed = sanitizeString(value);
  if (!trimmed) return '';
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
};

const generateId = (items) => {
  if (!Array.isArray(items) || items.length === 0) return 1;
  const ids = items.map(item => (typeof item?.id === 'number' ? item.id : 0)).filter(id => id > 0);
  return ids.length > 0 ? Math.max(...ids) + 1 : 1;
};

const safeArray = (arr) => (Array.isArray(arr) ? arr : []);

const GarageSelector = () => {
  const context = useContext(AppContext);
  const garages = safeArray(context?.garages);
  const setGarages = typeof context?.setGarages === 'function' ? context.setGarages : () => { };
  const selectGarage = typeof context?.selectGarage === 'function' ? context.selectGarage : () => { };
  const mode = context?.mode || 'dark';
  const setMode = typeof context?.setMode === 'function' ? context.setMode : () => { };

  const [showModal, setShowModal] = useState(false);
  const [newGarage, setNewGarage] = useState({ ...DEFAULT_NEW_GARAGE });
  const [editingGarage, setEditingGarage] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [newLink, setNewLink] = useState({ ...DEFAULT_NEW_LINK });

  const primaryGarage = garages[0] || null;

  const primaryGarageAddress = useMemo(() => {
    if (!primaryGarage) return '';
    const parts = [
      primaryGarage.address,
      primaryGarage.city,
      primaryGarage.state,
      primaryGarage.zip
    ].filter(Boolean);
    return parts.join(', ');
  }, [primaryGarage]);

  const stats = useMemo(() => {
    let spots = 0;
    let levels = 0;
    garages.forEach(g => {
      const gLevels = safeArray(g?.levels);
      levels += gLevels.length;
      gLevels.forEach(l => {
        spots += typeof l?.totalSpots === 'number' ? l.totalSpots : 0;
      });
    });
    return { spots, levels, garages: garages.length };
  }, [garages]);

  const quickLinks = useMemo(() => {
    return safeArray(primaryGarage?.quickLinks);
  }, [primaryGarage]);

  const handleCloseAddModal = useCallback(() => {
    setShowModal(false);
    setNewGarage({ ...DEFAULT_NEW_GARAGE });
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false);
    setEditingGarage(null);
  }, []);

  const handleCloseLinkModal = useCallback(() => {
    setShowLinkModal(false);
    setEditingLink(null);
    setNewLink({ ...DEFAULT_NEW_LINK });
  }, []);

  const addGarage = useCallback(() => {
    const name = sanitizeString(newGarage.name);
    if (!name) return;

    const newId = generateId(garages);
    const garage = {
      id: newId,
      name,
      address: sanitizeString(newGarage.address),
      city: sanitizeString(newGarage.city),
      state: sanitizeString(newGarage.state),
      zip: sanitizeString(newGarage.zip),
      image: sanitizeString(newGarage.image),
      contacts: [],
      levels: []
    };

    setGarages([...garages, garage]);
    handleCloseAddModal();
  }, [newGarage, garages, setGarages, handleCloseAddModal]);

  const updateGarage = useCallback(() => {
    if (!editingGarage || !sanitizeString(editingGarage.name)) return;

    const updated = garages.map(g =>
      g.id === editingGarage.id ? {
        ...g,
        ...editingGarage,
        name: sanitizeString(editingGarage.name),
        address: sanitizeString(editingGarage.address),
        city: sanitizeString(editingGarage.city),
        state: sanitizeString(editingGarage.state),
        zip: sanitizeString(editingGarage.zip),
        image: sanitizeString(editingGarage.image)
      } : g
    );

    setGarages(updated);
    handleCloseEditModal();
  }, [editingGarage, garages, setGarages, handleCloseEditModal]);

  const deleteGarage = useCallback((e, garageId) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (garages.length <= 1 || garageId == null) return;
    setGarages(garages.filter(g => g.id !== garageId));
    handleCloseEditModal();
  }, [garages, setGarages, handleCloseEditModal]);

  const handleUpdateContacts = useCallback((newContacts) => {
    if (garages.length === 0) return;
    const sanitizedContacts = safeArray(newContacts);
    const updatedGarages = [...garages];
    updatedGarages[0] = { ...updatedGarages[0], contacts: sanitizedContacts };
    setGarages(updatedGarages);
  }, [garages, setGarages]);

  const handleAddLink = useCallback(() => {
    const name = sanitizeString(newLink.name);
    const url = sanitizeUrl(newLink.url);
    if (!name || !url) return;

    if (garages.length === 0) return;

    const link = {
      id: Date.now(),
      name,
      url,
      icon: newLink.icon || 'link'
    };

    const updatedGarages = [...garages];
    updatedGarages[0] = {
      ...updatedGarages[0],
      quickLinks: [...safeArray(updatedGarages[0]?.quickLinks), link]
    };

    setGarages(updatedGarages);
    handleCloseLinkModal();
  }, [newLink, garages, setGarages, handleCloseLinkModal]);

  const handleUpdateLink = useCallback(() => {
    if (!editingLink) return;
    const name = sanitizeString(editingLink.name);
    const url = sanitizeUrl(editingLink.url);
    if (!name || !url) return;

    if (garages.length === 0) return;

    const updatedGarages = [...garages];
    updatedGarages[0] = {
      ...updatedGarages[0],
      quickLinks: safeArray(updatedGarages[0]?.quickLinks).map(l =>
        l.id === editingLink.id ? { ...editingLink, name, url } : l
      )
    };

    setGarages(updatedGarages);
    handleCloseLinkModal();
  }, [editingLink, garages, setGarages, handleCloseLinkModal]);

  const handleDeleteLink = useCallback((linkId) => {
    if (linkId == null || garages.length === 0) return;

    const updatedGarages = [...garages];
    updatedGarages[0] = {
      ...updatedGarages[0],
      quickLinks: safeArray(updatedGarages[0]?.quickLinks).filter(l => l.id !== linkId)
    };

    setGarages(updatedGarages);
  }, [garages, setGarages]);

  const handleNewGarageChange = useCallback((field) => (e) => {
    const value = e?.target?.value ?? '';
    setNewGarage(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleEditGarageChange = useCallback((field) => (e) => {
    const value = e?.target?.value ?? '';
    setEditingGarage(prev => prev ? { ...prev, [field]: value } : prev);
  }, []);

  const handleNewLinkChange = useCallback((field) => (e) => {
    const value = e?.target?.value ?? '';
    setNewLink(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleEditLinkChange = useCallback((field) => (e) => {
    const value = e?.target?.value ?? '';
    setEditingLink(prev => prev ? { ...prev, [field]: value } : prev);
  }, []);

  const handleNewImageUpload = useCallback((e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setNewGarage(prev => ({ ...prev, image: reader.result }));
      }
    };
    reader.onerror = () => { };
    reader.readAsDataURL(file);

    if (e?.target) e.target.value = '';
  }, []);

  const handleEditImageUpload = useCallback((e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setEditingGarage(prev => prev ? { ...prev, image: reader.result } : prev);
      }
    };
    reader.onerror = () => { };
    reader.readAsDataURL(file);

    if (e?.target) e.target.value = '';
  }, []);

  const handleOpenAddLink = useCallback(() => {
    setEditingLink(null);
    setNewLink({ ...DEFAULT_NEW_LINK });
    setShowLinkModal(true);
  }, []);

  const handleOpenEditLink = useCallback((link) => {
    if (!link) return;
    setEditingLink({ ...link });
    setShowLinkModal(true);
  }, []);

  const handleOpenEditGarage = useCallback((garage) => {
    if (!garage) return;
    setEditingGarage({ ...garage });
    setShowEditModal(true);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const isNewGarageValid = sanitizeString(newGarage.name).length > 0;
  const isEditGarageValid = editingGarage && sanitizeString(editingGarage.name).length > 0;
  const isNewLinkValid = sanitizeString(newLink.name).length > 0 && sanitizeString(newLink.url).length > 0;
  const isEditLinkValid = editingLink && sanitizeString(editingLink.name).length > 0 && sanitizeString(editingLink.url).length > 0;

  return (
    <div className="selector-view">
      <header className="selector-header-modern">
        <div className="brand-section">
          <img
            src="https://portal.ensightful.io/assets/img/ensight-logo.png"
            alt="Ensight"
            className="brand-logo-img"
            style={{ height: 28, width: 'auto' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <span className="brand-title">Admin Console</span>
        </div>

        <div className="header-right-controls">
          <button
            className="icon-btn"
            onClick={toggleMode}
            title="Toggle Theme"
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
          contacts={safeArray(primaryGarage?.contacts)}
          garageName={primaryGarage?.name || "Portfolio"}
          onUpdateContacts={handleUpdateContacts}
        />

        <div className="main-content-scroll">
          <div className="modern-layout-container">
            <div className="dashboard-header">
              <div className="dashboard-title">
                <h1>Overview</h1>
                <div className="dashboard-subtitle">Manage parking facilities and IoT device configurations.</div>
              </div>

              <div className="stats-row">
                <Weather address={primaryGarageAddress} />

                <div className="status-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  <span>{stats.garages} Properties</span>
                </div>

                <div className="status-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                  <span>{stats.spots} Capacity</span>
                </div>
              </div>
            </div>

            <div className="quick-links-section">
              <div className="section-tools">
                <div className="section-label">Quick Links</div>
                <button className="add-link-btn" onClick={handleOpenAddLink}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add Link
                </button>
              </div>

              <div className="quick-links-grid">
                {quickLinks.length === 0 ? (
                  <div className="empty-links-message">
                    No links added yet. Add links to Google Sheets, config docs, or other resources.
                  </div>
                ) : (
                  quickLinks.map(link => {
                    if (!link || link.id == null) return null;
                    return (
                      <div key={link.id} className="quick-link-item">
                        <a
                          href={sanitizeUrl(link.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="quick-link-content"
                          title={link.url || ''}
                        >
                          <span className="quick-link-icon">
                            {link.icon === 'sheets' ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="3" y1="15" x2="21" y2="15" />
                                <line x1="9" y1="3" x2="9" y2="21" />
                              </svg>
                            ) : link.icon === 'doc' ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                              </svg>
                            )}
                          </span>
                          <span className="quick-link-name">{link.name || 'Untitled'}</span>
                        </a>
                        <div className="quick-link-actions">
                          <button
                            className="link-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditLink(link);
                            }}
                            title="Edit"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            className="link-action-btn link-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLink(link.id);
                            }}
                            title="Delete"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="content-area">
              <div className="section-tools">
                <div className="section-label">All Properties</div>
              </div>

              <div className="modern-grid">
                {garages.map(garage => {
                  if (!garage || garage.id == null) return null;

                  const garageLevels = safeArray(garage.levels);
                  const fullAddress = [garage.address, garage.city, garage.state, garage.zip]
                    .filter(Boolean)
                    .join(', ');

                  const deviceCounts = garageLevels.reduce((acc, level) => {
                    safeArray(level?.devices).forEach(device => {
                      const type = device?.type || '';
                      if (type.startsWith('cam-')) acc.cameras++;
                      else if (type.startsWith('sign-')) acc.signs++;
                      else if (type.startsWith('sensor-')) acc.sensors++;
                    });
                    return acc;
                  }, { cameras: 0, signs: 0, sensors: 0 });

                  const totalDevices = deviceCounts.cameras + deviceCounts.signs + deviceCounts.sensors;
                  const totalSpots = garageLevels.reduce((acc, l) => acc + (typeof l?.totalSpots === 'number' ? l.totalSpots : 0), 0);

                  return (
                    <div
                      key={garage.id}
                      className="garage-card-modern"
                      onClick={() => selectGarage(garage.id)}
                    >
                      <div className="card-image-area">
                        <div
                          className="card-bg-image"
                          style={{
                            backgroundImage: `url(${garage.image || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2670&auto=format&fit=crop'})`
                          }}
                        />
                        <button
                          className="garage-card-edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditGarage(garage);
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      </div>

                      <div className="card-content">
                        <div className="card-header-row">
                          <h3 className="card-title">{garage.name || 'Untitled Property'}</h3>
                        </div>

                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="card-address"
                          onClick={(e) => e.stopPropagation()}
                          title="View on Google Maps"
                        >
                          {fullAddress || 'No Address Set'}
                        </a>

                        <div className="card-meta">
                          <span>{garageLevels.length} Levels</span>
                          <span>•</span>
                          <span>{totalSpots} Spots</span>
                        </div>

                        <div className="card-meta card-devices">
                          <span title="Cameras" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M23 7l-7 5 7 5V7z" />
                              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                            </svg>
                            {deviceCounts.cameras}
                          </span>
                          <span title="Signs" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                              <line x1="9" y1="9" x2="15" y2="9" />
                              <line x1="9" y1="15" x2="15" y2="15" />
                            </svg>
                            {deviceCounts.signs}
                          </span>
                          <span title="Space Monitors" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="3" />
                              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                            {deviceCounts.sensors}
                          </span>
                          <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{totalDevices} devices</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="add-card-modern" onClick={() => setShowModal(true)}>
                  <div className="add-icon-circle">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                  <span>Add Property</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={showModal} onClose={handleCloseAddModal}>
        <ModalDialog sx={MODAL_SX}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #3f3f46', background: '#27272a' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fafafa' }}>Add New Property</h3>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{
              width: '100%',
              height: 140,
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: '#27272a',
              backgroundImage: `url(${newGarage.image || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2670&auto=format&fit=crop'})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '1px solid #3f3f46',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {!newGarage.image && (
                <span style={{ color: '#71717a', fontSize: 13 }}>No image set</span>
              )}
            </div>

            <div>
              <label style={LABEL_STYLE}>Property Name</label>
              <Input
                size="sm"
                value={newGarage.name}
                onChange={handleNewGarageChange('name')}
                placeholder="e.g. Downtown Garage"
                autoFocus
                sx={INPUT_SX}
              />
            </div>

            <div>
              <label style={LABEL_STYLE}>Cover Image</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="file"
                  id="new-cover-image-upload"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleNewImageUpload}
                />
                <Button
                  size="sm"
                  variant="solid"
                  color="primary"
                  onClick={() => document.getElementById('new-cover-image-upload')?.click()}
                  sx={{ flex: 1 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload Image
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  variant="soft"
                  onClick={() => setNewGarage(prev => ({ ...prev, image: '' }))}
                  disabled={!newGarage.image}
                  sx={{ minWidth: 70 }}
                >
                  Clear
                </Button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#3f3f46' }} />
                <span style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase' }}>or paste URL</span>
                <div style={{ flex: 1, height: 1, background: '#3f3f46' }} />
              </div>

              <Input
                size="sm"
                fullWidth
                value={newGarage.image?.startsWith('data:') ? '' : (newGarage.image || '')}
                onChange={handleNewGarageChange('image')}
                placeholder="https://example.com/image.jpg"
                sx={INPUT_SX}
              />
            </div>

            <div>
              <label style={LABEL_STYLE}>Street Address</label>
              <Input
                size="sm"
                value={newGarage.address}
                onChange={handleNewGarageChange('address')}
                placeholder="123 Main Street"
                sx={INPUT_SX}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 0.8fr) minmax(0, 1fr)', gap: 12 }}>
              <div>
                <label style={LABEL_STYLE}>City</label>
                <Input size="sm" value={newGarage.city} onChange={handleNewGarageChange('city')} placeholder="City" sx={INPUT_SX} />
              </div>
              <div>
                <label style={LABEL_STYLE}>State</label>
                <Input size="sm" value={newGarage.state} onChange={handleNewGarageChange('state')} placeholder="ST" sx={INPUT_SX} />
              </div>
              <div>
                <label style={LABEL_STYLE}>Zip</label>
                <Input size="sm" value={newGarage.zip} onChange={handleNewGarageChange('zip')} placeholder="12345" sx={INPUT_SX} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid #3f3f46', background: '#27272a' }}>
            <Button size="sm" variant="outlined" color="neutral" onClick={handleCloseAddModal} sx={{ color: '#fafafa', borderColor: '#3f3f46', '&:hover': { bgcolor: '#3f3f46' } }}>
              Cancel
            </Button>
            <Button size="sm" onClick={addGarage} disabled={!isNewGarageValid}>Create Property</Button>
          </div>
        </ModalDialog>
      </Modal>

      <Modal open={showEditModal} onClose={handleCloseEditModal}>
        <ModalDialog sx={MODAL_SX}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #3f3f46', background: '#27272a' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fafafa' }}>Edit Property</h3>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{
              width: '100%',
              height: 140,
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: '#27272a',
              backgroundImage: `url(${editingGarage?.image || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2670&auto=format&fit=crop'})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '1px solid #3f3f46',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {!editingGarage?.image && (
                <span style={{ color: '#71717a', fontSize: 13 }}>No image set</span>
              )}
            </div>

            <div>
              <label style={LABEL_STYLE}>Property Name</label>
              <Input size="sm" value={editingGarage?.name || ''} onChange={handleEditGarageChange('name')} sx={INPUT_SX} />
            </div>

            <div>
              <label style={LABEL_STYLE}>Cover Image</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="file"
                  id="cover-image-upload"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleEditImageUpload}
                />
                <Button
                  size="sm"
                  variant="solid"
                  color="primary"
                  onClick={() => document.getElementById('cover-image-upload')?.click()}
                  sx={{ flex: 1 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 6 }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload Image
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  variant="soft"
                  onClick={() => setEditingGarage(prev => prev ? { ...prev, image: '' } : prev)}
                  disabled={!editingGarage?.image}
                  sx={{ minWidth: 70 }}
                >
                  Clear
                </Button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#3f3f46' }} />
                <span style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase' }}>or paste URL</span>
                <div style={{ flex: 1, height: 1, background: '#3f3f46' }} />
              </div>

              <Input
                size="sm"
                fullWidth
                value={editingGarage?.image?.startsWith('data:') ? '' : (editingGarage?.image || '')}
                onChange={handleEditGarageChange('image')}
                placeholder="https://example.com/image.jpg"
                sx={INPUT_SX}
              />
            </div>

            <div>
              <label style={LABEL_STYLE}>Street Address</label>
              <Input size="sm" value={editingGarage?.address || ''} onChange={handleEditGarageChange('address')} sx={INPUT_SX} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 0.8fr) minmax(0, 1fr)', gap: 12 }}>
              <div>
                <label style={LABEL_STYLE}>City</label>
                <Input size="sm" value={editingGarage?.city || ''} onChange={handleEditGarageChange('city')} sx={INPUT_SX} />
              </div>
              <div>
                <label style={LABEL_STYLE}>State</label>
                <Input size="sm" value={editingGarage?.state || ''} onChange={handleEditGarageChange('state')} sx={INPUT_SX} />
              </div>
              <div>
                <label style={LABEL_STYLE}>Zip</label>
                <Input size="sm" value={editingGarage?.zip || ''} onChange={handleEditGarageChange('zip')} sx={INPUT_SX} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid #3f3f46', background: '#27272a' }}>
            {garages.length > 1 && editingGarage && (
              <Button size="sm" color="danger" variant="plain" onClick={(e) => deleteGarage(e, editingGarage.id)} sx={{ marginRight: 'auto' }}>Delete</Button>
            )}
            <Button size="sm" variant="outlined" color="neutral" onClick={handleCloseEditModal} sx={{ color: '#fafafa', borderColor: '#3f3f46', '&:hover': { bgcolor: '#3f3f46' } }}>
              Cancel
            </Button>
            <Button size="sm" onClick={updateGarage} disabled={!isEditGarageValid}>Save Changes</Button>
          </div>
        </ModalDialog>
      </Modal>

      <Modal open={showLinkModal} onClose={handleCloseLinkModal}>
        <ModalDialog sx={LINK_MODAL_SX}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #3f3f46', background: '#27272a' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fafafa' }}>
              {editingLink ? 'Edit Link' : 'Add Quick Link'}
            </h3>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={LABEL_STYLE}>Link Name</label>
              <Input
                size="sm"
                value={editingLink ? editingLink.name : newLink.name}
                onChange={editingLink ? handleEditLinkChange('name') : handleNewLinkChange('name')}
                placeholder="e.g. Config Sheet"
                sx={INPUT_SX}
              />
            </div>

            <div>
              <label style={LABEL_STYLE}>URL</label>
              <Input
                size="sm"
                value={editingLink ? editingLink.url : newLink.url}
                onChange={editingLink ? handleEditLinkChange('url') : handleNewLinkChange('url')}
                placeholder="https://docs.google.com/..."
                sx={INPUT_SX}
              />
            </div>

            <div>
              <label style={LABEL_STYLE}>Icon Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  {
                    id: 'link', label: 'Link', icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    )
                  },
                  {
                    id: 'sheets', label: 'Sheet', icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="3" y1="15" x2="21" y2="15" />
                        <line x1="9" y1="3" x2="9" y2="21" />
                      </svg>
                    )
                  },
                  {
                    id: 'doc', label: 'Doc', icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    )
                  }
                ].map(iconOption => (
                  <button
                    key={iconOption.id}
                    onClick={() => editingLink
                      ? setEditingLink(prev => prev ? { ...prev, icon: iconOption.id } : prev)
                      : setNewLink(prev => ({ ...prev, icon: iconOption.id }))
                    }
                    style={{
                      flex: 1,
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      background: (editingLink?.icon || newLink.icon) === iconOption.id ? '#3b82f6' : '#27272a',
                      border: '1px solid',
                      borderColor: (editingLink?.icon || newLink.icon) === iconOption.id ? '#3b82f6' : '#3f3f46',
                      borderRadius: 6,
                      color: '#fafafa',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {iconOption.icon}
                    <span style={{ fontSize: 11 }}>{iconOption.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid #3f3f46', background: '#27272a' }}>
            <Button size="sm" variant="outlined" color="neutral" onClick={handleCloseLinkModal} sx={{ color: '#fafafa', borderColor: '#3f3f46', '&:hover': { bgcolor: '#3f3f46' } }}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={editingLink ? handleUpdateLink : handleAddLink}
              disabled={editingLink ? !isEditLinkValid : !isNewLinkValid}
            >
              {editingLink ? 'Save Changes' : 'Add Link'}
            </Button>
          </div>
        </ModalDialog>
      </Modal>
    </div>
  );
};

export default React.memo(GarageSelector);
