import React, { useContext, useState } from 'react';
import { Modal, ModalDialog, Input, Button } from '@mui/joy';
import { AppContext } from '../App';
import Weather from './Weather';
import ContactsSidebar from './ContactsSidebar';

const GarageSelector = () => {
  const { garages, setGarages, selectGarage, mode, setMode } = useContext(AppContext);

  // State for modals and forms
  const [showModal, setShowModal] = useState(false);
  const [newGarage, setNewGarage] = useState({ name: '', address: '', city: '', state: '', zip: '', image: '', contacts: [] });
  const [editingGarage, setEditingGarage] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // State for quick links
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [newLink, setNewLink] = useState({ name: '', url: '', icon: 'link' });

  // Logic: Add Garage
  const addGarage = () => {
    if (!newGarage.name.trim()) return;
    const newId = Math.max(...garages.map(g => g.id), 0) + 1;
    const garage = {
      id: newId,
      name: newGarage.name,
      address: newGarage.address,
      city: newGarage.city,
      state: newGarage.state,
      zip: newGarage.zip,
      image: newGarage.image,
      contacts: [],
      levels: []
    };
    setGarages([...garages, garage]);
    setNewGarage({ name: '', address: '', city: '', state: '', zip: '', image: '', contacts: [] });
    setShowModal(false);
  };

  // Logic: Update Garage
  const updateGarage = () => {
    if (!editingGarage || !editingGarage.name.trim()) return;
    setGarages(garages.map(g =>
      g.id === editingGarage.id ? editingGarage : g
    ));
    setShowEditModal(false);
    setEditingGarage(null);
  };

  // Logic: Delete Garage
  const deleteGarage = (e, garageId) => {
    e.stopPropagation();
    if (garages.length <= 1) return;
    setGarages(garages.filter(g => g.id !== garageId));
  };

  // Compute address for Weather component
  const primaryGarageAddress = garages[0]
    ? [garages[0].address, garages[0].city, garages[0].state, garages[0].zip].filter(Boolean).join(', ')
    : '';


  // Logic: Stats Calculation
  const getTotalStats = () => {
    let spots = 0;
    let levels = 0;
    garages.forEach(g => {
      levels += g.levels.length;
      g.levels.forEach(l => spots += (l.totalSpots || 0));
    });
    return { spots, levels, garages: garages.length };
  };

  const stats = getTotalStats();

  // Logic: Update Contacts
  const handleUpdateContacts = (newContacts) => {
    if (garages.length > 0) {
      const updatedGarages = [...garages];
      updatedGarages[0] = { ...updatedGarages[0], contacts: newContacts };
      setGarages(updatedGarages);
    }
  };

  // Logic: Quick Links Management
  const quickLinks = garages[0]?.quickLinks || [];

  const handleAddLink = () => {
    if (!newLink.name.trim() || !newLink.url.trim()) return;
    const link = {
      id: Date.now(),
      name: newLink.name,
      url: newLink.url.startsWith('http') ? newLink.url : `https://${newLink.url}`,
      icon: newLink.icon || 'link'
    };
    const updatedGarages = [...garages];
    updatedGarages[0] = {
      ...updatedGarages[0],
      quickLinks: [...(updatedGarages[0].quickLinks || []), link]
    };
    setGarages(updatedGarages);
    setNewLink({ name: '', url: '', icon: 'link' });
    setShowLinkModal(false);
  };

  const handleUpdateLink = () => {
    if (!editingLink || !editingLink.name.trim() || !editingLink.url.trim()) return;
    const updatedGarages = [...garages];
    updatedGarages[0] = {
      ...updatedGarages[0],
      quickLinks: (updatedGarages[0].quickLinks || []).map(l =>
        l.id === editingLink.id ? {
          ...editingLink,
          url: editingLink.url.startsWith('http') ? editingLink.url : `https://${editingLink.url}`
        } : l
      )
    };
    setGarages(updatedGarages);
    setEditingLink(null);
    setShowLinkModal(false);
  };

  const handleDeleteLink = (linkId) => {
    const updatedGarages = [...garages];
    updatedGarages[0] = {
      ...updatedGarages[0],
      quickLinks: (updatedGarages[0].quickLinks || []).filter(l => l.id !== linkId)
    };
    setGarages(updatedGarages);
  };

  return (
    <div className="selector-view">

      {/* Enterprise Header */}
      <header className="selector-header-modern">
        <div className="brand-section">
          <div className="brand-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 21h18" />
              <path d="M5 21V7l7-4 7 4v14" />
              <path d="M9 21v-6h6v6" />
            </svg>
          </div>
          <span className="brand-title">Ensight Console</span>
        </div>

        <div className="header-right-controls">
          {/* Dark Mode Toggle */}
          <button
            className="icon-btn"
            onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
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
        {/* Contacts Sidebar - Global/Overview Mode */}
        <ContactsSidebar
          contacts={garages[0]?.contacts || []}
          garageName={garages[0]?.name || "Portfolio"}
          onUpdateContacts={handleUpdateContacts}
        />

        {/* Main Content */}
        <div className="main-content-scroll">
          <div className="modern-layout-container">

            {/* Dashboard Tools/Header */}
            <div className="dashboard-header">
              <div className="dashboard-title">
                <h1>Overview</h1>
                <div className="dashboard-subtitle">Manage parking facilities and IoT device configurations.</div>
              </div>

              <div className="stats-row">
                {/* Weather Widget (from Component) */}
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

            {/* Quick Links Section */}
            <div className="quick-links-section">
              <div className="section-tools">
                <div className="section-label">Quick Links</div>
                <button
                  className="add-link-btn"
                  onClick={() => {
                    setEditingLink(null);
                    setNewLink({ name: '', url: '', icon: 'link' });
                    setShowLinkModal(true);
                  }}
                >
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
                  quickLinks.map(link => (
                    <div key={link.id} className="quick-link-item">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="quick-link-content"
                        title={link.url}
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
                        <span className="quick-link-name">{link.name}</span>
                      </a>
                      <div className="quick-link-actions">
                        <button
                          className="link-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingLink(link);
                            setShowLinkModal(true);
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
                  ))
                )}
              </div>
            </div>

            {/* Garage Grid Section */}
            <div className="content-area">
              <div className="section-tools">
                <div className="section-label">All Properties</div>
                {/* Add Filter/Search here if needed */}
              </div>

              <div className="modern-grid">
                {/* Garage Cards */}
                {garages.map(garage => {
                  const fullAddress = [garage.address, garage.city, garage.state, garage.zip].filter(Boolean).join(', ');

                  // Calculate device counts across all levels
                  const deviceCounts = garage.levels.reduce((acc, level) => {
                    (level.devices || []).forEach(device => {
                      if (device.type?.startsWith('cam-')) acc.cameras++;
                      else if (device.type?.startsWith('sign-')) acc.signs++;
                      else if (device.type?.startsWith('sensor-')) acc.sensors++;
                    });
                    return acc;
                  }, { cameras: 0, signs: 0, sensors: 0 });

                  const totalDevices = deviceCounts.cameras + deviceCounts.signs + deviceCounts.sensors;

                  return (
                    <div
                      key={garage.id}
                      className="garage-card-modern"
                      onClick={() => selectGarage(garage.id)}
                    >
                      {/* Card Image Area */}
                      <div className="card-image-area">
                        <div
                          className="card-bg-image"
                          style={{ backgroundImage: `url(${garage.image || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2670&auto=format&fit=crop'})` }}
                        />

                        {/* Edit Button */}
                        <button
                          className="garage-card-edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingGarage(garage);
                            setShowEditModal(true);
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      </div>

                      {/* Card Content (Enterprise Style) */}
                      <div className="card-content">
                        <div className="card-header-row">
                          <h3 className="card-title">{garage.name}</h3>
                        </div>

                        {/* Fixed Address Link */}
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
                          <span>{garage.levels.length} Levels</span>
                          <span>•</span>
                          <span>{garage.levels.reduce((acc, l) => acc + (l.totalSpots || 0), 0)} Spots</span>
                        </div>

                        {/* Device Counts Row */}
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
                          <span title="Sensors" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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

                {/* Add New Card (Dashed) */}
                <div
                  className="add-card-modern"
                  onClick={() => setShowModal(true)}
                >
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

      {/* Add New Property Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <ModalDialog sx={{
          borderRadius: '12px',
          p: 0,
          width: '100%',
          maxWidth: 520,
          bgcolor: '#18181b',
          border: '1px solid #3f3f46',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #3f3f46',
            background: '#27272a'
          }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fafafa' }}>Add New Property</h3>
          </div>

          {/* Form Content */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
            {/* Preview Image */}
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

            {/* Property Name */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Property Name</label>
              <Input
                size="sm"
                value={newGarage.name}
                onChange={(e) => setNewGarage({ ...newGarage, name: e.target.value })}
                placeholder="e.g. Downtown Garage"
                autoFocus
                sx={{
                  fontSize: 14,
                  color: '#fafafa',
                  bgcolor: '#27272a',
                  borderColor: '#3f3f46',
                  '&:hover': { borderColor: '#52525b' },
                  '&:focus-within': { borderColor: '#3b82f6' },
                  '&::placeholder': { color: '#71717a' }
                }}
              />
            </div>

            {/* Cover Image */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cover Image</label>

              {/* Upload Button Row */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="file"
                  id="new-cover-image-upload"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setNewGarage({ ...newGarage, image: reader.result });
                      };
                      reader.readAsDataURL(file);
                    }
                    e.target.value = '';
                  }}
                />
                <Button
                  size="sm"
                  variant="solid"
                  color="primary"
                  onClick={() => document.getElementById('new-cover-image-upload').click()}
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
                  onClick={() => setNewGarage({ ...newGarage, image: '' })}
                  disabled={!newGarage.image}
                  sx={{ minWidth: 70 }}
                >
                  Clear
                </Button>
              </div>

              {/* OR divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#3f3f46' }} />
                <span style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase' }}>or paste URL</span>
                <div style={{ flex: 1, height: 1, background: '#3f3f46' }} />
              </div>

              {/* URL Input */}
              <Input
                size="sm"
                fullWidth
                value={newGarage.image?.startsWith('data:') ? '' : (newGarage.image || '')}
                onChange={(e) => setNewGarage({ ...newGarage, image: e.target.value })}
                placeholder="https://example.com/image.jpg"
                sx={{
                  fontSize: 14,
                  color: '#fafafa',
                  bgcolor: '#27272a',
                  borderColor: '#3f3f46',
                  '&:hover': { borderColor: '#52525b' },
                  '&:focus-within': { borderColor: '#3b82f6' },
                  '&::placeholder': { color: '#71717a' }
                }}
              />
            </div>

            {/* Street Address */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Street Address</label>
              <Input
                size="sm"
                value={newGarage.address}
                onChange={(e) => setNewGarage({ ...newGarage, address: e.target.value })}
                placeholder="123 Main Street"
                sx={{
                  fontSize: 14,
                  color: '#fafafa',
                  bgcolor: '#27272a',
                  borderColor: '#3f3f46',
                  '&:hover': { borderColor: '#52525b' },
                  '&:focus-within': { borderColor: '#3b82f6' },
                  '&::placeholder': { color: '#71717a' }
                }}
              />
            </div>

            {/* City, State, Zip - Responsive Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 0.8fr) minmax(0, 1fr)', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>City</label>
                <Input
                  size="sm"
                  value={newGarage.city}
                  onChange={(e) => setNewGarage({ ...newGarage, city: e.target.value })}
                  placeholder="City"
                  sx={{ fontSize: 14, color: '#fafafa', bgcolor: '#27272a', borderColor: '#3f3f46', '&::placeholder': { color: '#71717a' } }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>State</label>
                <Input
                  size="sm"
                  value={newGarage.state}
                  onChange={(e) => setNewGarage({ ...newGarage, state: e.target.value })}
                  placeholder="ST"
                  sx={{ fontSize: 14, color: '#fafafa', bgcolor: '#27272a', borderColor: '#3f3f46', '&::placeholder': { color: '#71717a' } }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Zip</label>
                <Input
                  size="sm"
                  value={newGarage.zip}
                  onChange={(e) => setNewGarage({ ...newGarage, zip: e.target.value })}
                  placeholder="12345"
                  sx={{ fontSize: 14, color: '#fafafa', bgcolor: '#27272a', borderColor: '#3f3f46', '&::placeholder': { color: '#71717a' } }}
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            padding: '14px 20px',
            borderTop: '1px solid #3f3f46',
            background: '#27272a'
          }}>
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              onClick={() => setShowModal(false)}
              sx={{ color: '#fafafa', borderColor: '#3f3f46', '&:hover': { bgcolor: '#3f3f46' } }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={addGarage}>Create Property</Button>
          </div>
        </ModalDialog>
      </Modal>

      <Modal open={showEditModal} onClose={() => setShowEditModal(false)}>
        <ModalDialog sx={{
          borderRadius: '12px',
          p: 0,
          width: '100%',
          maxWidth: 520,
          bgcolor: '#18181b',
          border: '1px solid #3f3f46',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #3f3f46',
            background: '#27272a'
          }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fafafa' }}>Edit Property</h3>
          </div>

          {/* Form Content */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
            {/* Preview Image */}
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

            {/* Property Name */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Property Name</label>
              <Input
                size="sm"
                value={editingGarage?.name || ''}
                onChange={(e) => setEditingGarage({ ...editingGarage, name: e.target.value })}
                sx={{
                  fontSize: 14,
                  color: '#fafafa',
                  bgcolor: '#27272a',
                  borderColor: '#3f3f46',
                  '&:hover': { borderColor: '#52525b' },
                  '&:focus-within': { borderColor: '#3b82f6' }
                }}
              />
            </div>

            {/* Cover Image */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cover Image</label>

              {/* Upload Button Row */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="file"
                  id="cover-image-upload"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setEditingGarage({ ...editingGarage, image: reader.result });
                      };
                      reader.readAsDataURL(file);
                    }
                    e.target.value = ''; // Reset input
                  }}
                />
                <Button
                  size="sm"
                  variant="solid"
                  color="primary"
                  onClick={() => document.getElementById('cover-image-upload').click()}
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
                  onClick={() => setEditingGarage({ ...editingGarage, image: '' })}
                  disabled={!editingGarage?.image}
                  sx={{ minWidth: 70 }}
                >
                  Clear
                </Button>
              </div>

              {/* OR divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#3f3f46' }} />
                <span style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase' }}>or paste URL</span>
                <div style={{ flex: 1, height: 1, background: '#3f3f46' }} />
              </div>

              {/* URL Input */}
              <Input
                size="sm"
                fullWidth
                value={editingGarage?.image?.startsWith('data:') ? '' : (editingGarage?.image || '')}
                onChange={(e) => setEditingGarage({ ...editingGarage, image: e.target.value })}
                placeholder="https://example.com/image.jpg"
                sx={{
                  fontSize: 14,
                  color: '#fafafa',
                  bgcolor: '#27272a',
                  borderColor: '#3f3f46',
                  '&:hover': { borderColor: '#52525b' },
                  '&:focus-within': { borderColor: '#3b82f6' },
                  '&::placeholder': { color: '#71717a' }
                }}
              />
            </div>

            {/* Address */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Street Address</label>
              <Input
                size="sm"
                value={editingGarage?.address || ''}
                onChange={(e) => setEditingGarage({ ...editingGarage, address: e.target.value })}
                sx={{
                  fontSize: 14,
                  color: '#fafafa',
                  bgcolor: '#27272a',
                  borderColor: '#3f3f46',
                  '&:hover': { borderColor: '#52525b' },
                  '&:focus-within': { borderColor: '#3b82f6' }
                }}
              />
            </div>

            {/* City, State, Zip - Responsive Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 0.8fr) minmax(0, 1fr)', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>City</label>
                <Input
                  size="sm"
                  value={editingGarage?.city || ''}
                  onChange={(e) => setEditingGarage({ ...editingGarage, city: e.target.value })}
                  sx={{ fontSize: 14, color: '#fafafa', bgcolor: '#27272a', borderColor: '#3f3f46' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>State</label>
                <Input
                  size="sm"
                  value={editingGarage?.state || ''}
                  onChange={(e) => setEditingGarage({ ...editingGarage, state: e.target.value })}
                  sx={{ fontSize: 14, color: '#fafafa', bgcolor: '#27272a', borderColor: '#3f3f46' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Zip</label>
                <Input
                  size="sm"
                  value={editingGarage?.zip || ''}
                  onChange={(e) => setEditingGarage({ ...editingGarage, zip: e.target.value })}
                  sx={{ fontSize: 14, color: '#fafafa', bgcolor: '#27272a', borderColor: '#3f3f46' }}
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            padding: '14px 20px',
            borderTop: '1px solid #3f3f46',
            background: '#27272a'
          }}>
            {garages.length > 1 && (
              <Button size="sm" color="danger" variant="plain" onClick={(e) => deleteGarage(e, editingGarage.id)} sx={{ marginRight: 'auto' }}>Delete</Button>
            )}
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              onClick={() => setShowEditModal(false)}
              sx={{ color: '#fafafa', borderColor: '#3f3f46', '&:hover': { bgcolor: '#3f3f46' } }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={updateGarage}>Save Changes</Button>
          </div>
        </ModalDialog>
      </Modal>

      {/* Add/Edit Link Modal */}
      <Modal open={showLinkModal} onClose={() => { setShowLinkModal(false); setEditingLink(null); }}>
        <ModalDialog sx={{
          borderRadius: '12px',
          p: 0,
          width: '100%',
          maxWidth: 400,
          bgcolor: '#18181b',
          border: '1px solid #3f3f46',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #3f3f46',
            background: '#27272a'
          }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fafafa' }}>
              {editingLink ? 'Edit Link' : 'Add Quick Link'}
            </h3>
          </div>

          {/* Form Content */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Link Name */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Link Name</label>
              <Input
                size="sm"
                value={editingLink ? editingLink.name : newLink.name}
                onChange={(e) => editingLink
                  ? setEditingLink({ ...editingLink, name: e.target.value })
                  : setNewLink({ ...newLink, name: e.target.value })
                }
                placeholder="e.g. Config Sheet"
                sx={{
                  fontSize: 14,
                  color: '#fafafa',
                  bgcolor: '#27272a',
                  borderColor: '#3f3f46',
                  '&:hover': { borderColor: '#52525b' },
                  '&:focus-within': { borderColor: '#3b82f6' },
                  '&::placeholder': { color: '#71717a' }
                }}
              />
            </div>

            {/* Link URL */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>URL</label>
              <Input
                size="sm"
                value={editingLink ? editingLink.url : newLink.url}
                onChange={(e) => editingLink
                  ? setEditingLink({ ...editingLink, url: e.target.value })
                  : setNewLink({ ...newLink, url: e.target.value })
                }
                placeholder="https://docs.google.com/..."
                sx={{
                  fontSize: 14,
                  color: '#fafafa',
                  bgcolor: '#27272a',
                  borderColor: '#3f3f46',
                  '&:hover': { borderColor: '#52525b' },
                  '&:focus-within': { borderColor: '#3b82f6' },
                  '&::placeholder': { color: '#71717a' }
                }}
              />
            </div>

            {/* Icon Type */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Icon Type</label>
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
                      ? setEditingLink({ ...editingLink, icon: iconOption.id })
                      : setNewLink({ ...newLink, icon: iconOption.id })
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

          {/* Footer Actions */}
          <div style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            padding: '14px 20px',
            borderTop: '1px solid #3f3f46',
            background: '#27272a'
          }}>
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              onClick={() => { setShowLinkModal(false); setEditingLink(null); }}
              sx={{ color: '#fafafa', borderColor: '#3f3f46', '&:hover': { bgcolor: '#3f3f46' } }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={editingLink ? handleUpdateLink : handleAddLink}>
              {editingLink ? 'Save Changes' : 'Add Link'}
            </Button>
          </div>
        </ModalDialog>
      </Modal>
    </div>
  );
};

export default GarageSelector;

