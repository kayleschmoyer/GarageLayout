import React, { useContext, useState, useEffect } from 'react';
import { Modal, ModalDialog, Input, Button } from '@mui/joy';
import { AppContext } from '../App';

const GarageSelector = () => {
  const { garages, setGarages, selectGarage, mode, setMode } = useContext(AppContext);
  const [showModal, setShowModal] = useState(false);
  const [newGarage, setNewGarage] = useState({ name: '', address: '', contacts: [] });
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [editingGarage, setEditingGarage] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [newContact, setNewContact] = useState({ title: '', phone: '', email: '', type: 'phone' });

  const addGarage = () => {
    if (!newGarage.name.trim()) return;
    const newId = Math.max(...garages.map(g => g.id), 0) + 1;
    const garage = {
      id: newId,
      name: newGarage.name,
      address: newGarage.address,
      contacts: [],
      levels: []
    };
    setGarages([...garages, garage]);
    setNewGarage({ name: '', address: '', contacts: [] });
    setShowModal(false);
    selectGarage(newId);
  };

  const updateGarage = () => {
    if (!editingGarage || !editingGarage.name.trim()) return;
    setGarages(garages.map(g =>
      g.id === editingGarage.id ? editingGarage : g
    ));
    setShowEditModal(false);
    setEditingGarage(null);
  };

  const addOrUpdateContact = () => {
    if (!newContact.title.trim()) return;
    if (!newContact.phone.trim() && !newContact.email.trim()) return;

    const firstGarage = garages[0];
    if (!firstGarage) return;

    const updatedContacts = editingContact
      ? firstGarage.contacts.map(c => c.id === editingContact.id ? { ...newContact, id: c.id } : c)
      : [...(firstGarage.contacts || []), { ...newContact, id: Date.now() }];

    setGarages(garages.map(g =>
      g.id === firstGarage.id ? { ...g, contacts: updatedContacts } : g
    ));

    setShowContactModal(false);
    setEditingContact(null);
    setNewContact({ title: '', phone: '', email: '', type: 'phone' });
  };

  const deleteContact = (contactId) => {
    const firstGarage = garages[0];
    if (!firstGarage) return;

    setGarages(garages.map(g =>
      g.id === firstGarage.id ? { ...g, contacts: g.contacts.filter(c => c.id !== contactId) } : g
    ));
  };

  const deleteGarage = (e, garageId) => {
    e.stopPropagation();
    if (garages.length <= 1) return;
    setGarages(garages.filter(g => g.id !== garageId));
  };

  // Fetch weather for the first garage with an address
  useEffect(() => {
    const fetchWeather = async () => {
      const garageWithAddress = garages.find(g => g.address);
      if (!garageWithAddress?.address) return;

      setWeatherLoading(true);
      try {
        // Geocode the address
        const geocodeResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(garageWithAddress.address)}&format=json&limit=1`
        );
        const geocodeData = await geocodeResponse.json();

        if (geocodeData && geocodeData.length > 0) {
          const { lat, lon } = geocodeData[0];

          // Fetch weather from Open-Meteo API
          const weatherResponse = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`
          );
          const weatherInfo = await weatherResponse.json();

          if (weatherInfo && weatherInfo.current) {
            setWeatherData({
              temperature: Math.round(weatherInfo.current.temperature_2m),
              humidity: weatherInfo.current.relative_humidity_2m,
              windSpeed: Math.round(weatherInfo.current.wind_speed_10m),
              weatherCode: weatherInfo.current.weather_code,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching weather:', error);
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
  }, [garages]);

  // Get weather icon based on weather code
  const getWeatherIcon = (code) => {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 48) return '🌫️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '🌨️';
    if (code <= 82) return '🌦️';
    if (code <= 86) return '🌨️';
    return '⛈️';
  };

  // Calculate total device counts across all garages
  const getTotalDeviceCounts = () => {
    let totalCameras = 0;
    let totalSensors = 0;
    let totalSigns = 0;
    let totalSpots = 0;

    garages.forEach(garage => {
      garage.levels?.forEach(level => {
        totalSpots += level.totalSpots || 0;
        level.devices?.forEach(device => {
          if (device.type?.startsWith('cam-')) totalCameras++;
          else if (device.type?.startsWith('sensor-')) totalSensors++;
          else if (device.type?.startsWith('sign-')) totalSigns++;
        });
      });
    });

    return { totalCameras, totalSensors, totalSigns, totalSpots };
  };

  const deviceCounts = getTotalDeviceCounts();

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
          <div className="header-right-controls">
            {weatherData && (
              <div className="weather-widget">
                <span className="weather-icon">{getWeatherIcon(weatherData.weatherCode)}</span>
                <span className="weather-temp">{weatherData.temperature}°F</span>
                <span className="weather-details">
                  💧 {weatherData.humidity}% · 💨 {weatherData.windSpeed} mph
                </span>
              </div>
            )}
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
        </div>
      </header>

      {/* Main Layout with Sidebar */}
      <div className="selector-layout">
        {/* Left Sidebar */}
        <aside className="selector-sidebar">
          {/* Device Stats */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18"/>
                <path d="M18 17V9"/>
                <path d="M13 17V5"/>
                <path d="M8 17v-3"/>
              </svg>
              <span>Total Devices</span>
            </div>
            <div className="device-stats-grid">
              <div className="device-stat-card">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <div className="device-stat-info">
                  <div className="device-stat-value">{deviceCounts.totalSpots}</div>
                  <div className="device-stat-label">Spots</div>
                </div>
              </div>
              <div className="device-stat-card">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="4"/>
                </svg>
                <div className="device-stat-info">
                  <div className="device-stat-value">{deviceCounts.totalCameras}</div>
                  <div className="device-stat-label">Cameras</div>
                </div>
              </div>
              <div className="device-stat-card">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4"/>
                </svg>
                <div className="device-stat-info">
                  <div className="device-stat-value">{deviceCounts.totalSensors}</div>
                  <div className="device-stat-label">Sensors</div>
                </div>
              </div>
              <div className="device-stat-card">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M9 12h6"/>
                </svg>
                <div className="device-stat-info">
                  <div className="device-stat-value">{deviceCounts.totalSigns}</div>
                  <div className="device-stat-label">Signs</div>
                </div>
              </div>
            </div>
          </div>

          {/* Contacts */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>Contacts</span>
              <button
                className="add-contact-btn"
                onClick={() => {
                  setEditingContact(null);
                  setNewContact({ title: '', phone: '', email: '', type: 'phone' });
                  setShowContactModal(true);
                }}
                title="Add contact"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
            </div>
            <div className="sidebar-contacts">
              {(garages[0]?.contacts || []).length === 0 ? (
                <div className="empty-contacts">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                  </svg>
                  <p>No contacts yet</p>
                  <button
                    className="btn-add-first-contact"
                    onClick={() => {
                      setEditingContact(null);
                      setNewContact({ title: '', phone: '', email: '', type: 'phone' });
                      setShowContactModal(true);
                    }}
                  >
                    Add your first contact
                  </button>
                </div>
              ) : (
                (garages[0]?.contacts || []).slice(0, 5).map(contact => (
                  <div key={contact.id} className="sidebar-contact-item">
                    <div className={`contact-icon ${contact.type === 'emergency' ? 'emergency' : ''}`}>
                      {contact.type === 'email' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                          <polyline points="22,6 12,13 2,6"/>
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                      )}
                    </div>
                    <div className="contact-info">
                      <div className="contact-label">{contact.title}</div>
                      {contact.phone && (
                        <a href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`} className="contact-value contact-link">
                          {contact.phone}
                        </a>
                      )}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="contact-value contact-link">
                          {contact.email}
                        </a>
                      )}
                    </div>
                    <div className="contact-actions">
                      <button
                        className="contact-edit-btn"
                        onClick={() => {
                          setEditingContact(contact);
                          setNewContact(contact);
                          setShowContactModal(true);
                        }}
                        title="Edit contact"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        className="contact-delete-btn"
                        onClick={() => deleteContact(contact.id)}
                        title="Delete contact"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
              {(garages[0]?.contacts || []).length > 5 && (
                <div className="view-all-contacts">
                  <button className="btn-view-all" onClick={() => {/* TODO: Implement view all modal */}}>
                    View all {garages[0].contacts.length} contacts
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="selector-main-content">
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
                  {garage.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(garage.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="address-link"
                      onClick={(e) => e.stopPropagation()}
                      title="Open in Google Maps"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      {garage.address}
                    </a>
                  )}
                  <p className="stats">
                    {garage.levels.length} level{garage.levels.length !== 1 ? 's' : ''}
                    {garage.levels.length > 0 && (
                      <span> · {garage.levels.reduce((sum, l) => sum + (l.totalSpots || 0), 0)} spots</span>
                    )}
                  </p>
                </div>
                <div className="garage-card-actions">
                  <button
                    className="garage-card-edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingGarage(garage);
                      setShowEditModal(true);
                    }}
                    title="Edit garage info"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  {garages.length > 1 && (
                    <button
                      className="garage-card-delete"
                      onClick={(e) => deleteGarage(e, garage.id)}
                      title="Delete garage"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                    </button>
                  )}
                </div>
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
        </main>
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

      {/* Edit Garage Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)}>
        <ModalDialog sx={{ borderRadius: '12px', p: 3, maxWidth: 400, bgcolor: 'background.surface' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600 }}>Edit Garage</h3>
          <p style={{ margin: '0 0 20px', fontSize: '14px', opacity: 0.6 }}>
            Update garage information
          </p>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Garage Name</label>
            <Input
              placeholder="e.g., Downtown Parking"
              value={editingGarage?.name || ''}
              onChange={(e) => setEditingGarage({ ...editingGarage, name: e.target.value })}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Address</label>
            <Input
              placeholder="e.g., 123 Main Street"
              value={editingGarage?.address || ''}
              onChange={(e) => setEditingGarage({ ...editingGarage, address: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="plain" color="neutral" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={updateGarage} disabled={!editingGarage?.name?.trim()}>
              Save Changes
            </Button>
          </div>
        </ModalDialog>
      </Modal>

      {/* Add/Edit Contact Modal */}
      <Modal open={showContactModal} onClose={() => setShowContactModal(false)}>
        <ModalDialog sx={{ borderRadius: '12px', p: 3, maxWidth: 400, bgcolor: 'background.surface' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600 }}>
            {editingContact ? 'Edit Contact' : 'Add Contact'}
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: '14px', opacity: 0.6 }}>
            {editingContact ? 'Update contact information' : 'Add a new contact'}
          </p>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Title / Role</label>
            <Input
              placeholder="e.g., Manager, Security, Front Desk"
              value={newContact.title}
              onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Contact Type</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <Button
                variant={newContact.type === 'phone' ? 'solid' : 'outlined'}
                color="neutral"
                onClick={() => setNewContact({ ...newContact, type: 'phone' })}
                sx={{ flex: 1 }}
              >
                Phone
              </Button>
              <Button
                variant={newContact.type === 'email' ? 'solid' : 'outlined'}
                color="neutral"
                onClick={() => setNewContact({ ...newContact, type: 'email' })}
                sx={{ flex: 1 }}
              >
                Email
              </Button>
              <Button
                variant={newContact.type === 'emergency' ? 'solid' : 'outlined'}
                color="danger"
                onClick={() => setNewContact({ ...newContact, type: 'emergency' })}
                sx={{ flex: 1 }}
              >
                Emergency
              </Button>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Phone Number</label>
            <Input
              placeholder="e.g., (555) 123-4567"
              value={newContact.phone}
              onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Email Address</label>
            <Input
              placeholder="e.g., contact@example.com"
              value={newContact.email}
              onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="plain" color="neutral" onClick={() => setShowContactModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={addOrUpdateContact}
              disabled={!newContact.title.trim() || (!newContact.phone.trim() && !newContact.email.trim())}
            >
              {editingContact ? 'Save Changes' : 'Add Contact'}
            </Button>
          </div>
        </ModalDialog>
      </Modal>
    </div>
  );
};

export default GarageSelector;
