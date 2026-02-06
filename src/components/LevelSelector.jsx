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

const DEFAULT_NEW_SERVER = Object.freeze({
  name: '',
  username: '',
  password: '',
  ipAddress: '',
  serverType: 'Recording Server',
  os: 'Windows Server 2022',
  details: ''
});

const SERVER_TYPES = [
  'Recording Server',
  'Processing Server',
  'Edge Server',
  'Management Server',
  'Storage Server'
];

const OS_OPTIONS = [
  'Windows Server 2022',
  'Windows Server 2019',
  'Windows 11 Pro',
  'Windows 10 Pro',
  'Ubuntu 22.04 LTS',
  'Ubuntu 20.04 LTS',
  'CentOS 7',
  'Debian 12',
  'Other'
];

const generateServerId = (servers) => {
  const safeServers = safeArray(servers);
  if (safeServers.length === 0) return 1;
  const ids = safeServers
    .map(s => (s && typeof s.id === 'number' ? s.id : 0))
    .filter(id => id > 0);
  return ids.length > 0 ? Math.max(...ids) + 1 : 1;
};

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

// Map US state abbreviations to IANA timezone identifiers
const STATE_TO_TIMEZONE = {
  // Eastern Time
  'CT': 'America/New_York', 'DE': 'America/New_York', 'FL': 'America/New_York',
  'GA': 'America/New_York', 'ME': 'America/New_York', 'MD': 'America/New_York',
  'MA': 'America/New_York', 'NH': 'America/New_York', 'NJ': 'America/New_York',
  'NY': 'America/New_York', 'NC': 'America/New_York', 'OH': 'America/New_York',
  'PA': 'America/New_York', 'RI': 'America/New_York', 'SC': 'America/New_York',
  'VT': 'America/New_York', 'VA': 'America/New_York', 'WV': 'America/New_York',
  // Central Time
  'AL': 'America/Chicago', 'AR': 'America/Chicago', 'IL': 'America/Chicago',
  'IA': 'America/Chicago', 'KS': 'America/Chicago', 'KY': 'America/Chicago',
  'LA': 'America/Chicago', 'MN': 'America/Chicago', 'MS': 'America/Chicago',
  'MO': 'America/Chicago', 'NE': 'America/Chicago', 'ND': 'America/Chicago',
  'OK': 'America/Chicago', 'SD': 'America/Chicago', 'TN': 'America/Chicago',
  'TX': 'America/Chicago', 'WI': 'America/Chicago',
  // Mountain Time
  'AZ': 'America/Phoenix', 'CO': 'America/Denver', 'ID': 'America/Denver',
  'MT': 'America/Denver', 'NM': 'America/Denver', 'UT': 'America/Denver',
  'WY': 'America/Denver',
  // Pacific Time
  'CA': 'America/Los_Angeles', 'NV': 'America/Los_Angeles', 'OR': 'America/Los_Angeles',
  'WA': 'America/Los_Angeles',
  // Alaska Time
  'AK': 'America/Anchorage',
  // Hawaii-Aleutian Time
  'HI': 'America/Adak'
};

const getTimezoneForState = (state) => {
  return STATE_TO_TIMEZONE[state?.toUpperCase()] || 'America/New_York';
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
  const [localTime, setLocalTime] = useState('');

  // Server management state
  const [showServerModal, setShowServerModal] = useState(false);
  const [showServerDetailModal, setShowServerDetailModal] = useState(false);
  const [showEditServerModal, setShowEditServerModal] = useState(false);
  const [newServer, setNewServer] = useState({ ...DEFAULT_NEW_SERVER });
  const [viewingServer, setViewingServer] = useState(null);
  const [editingServer, setEditingServer] = useState(null);
  const [showServerPasswords, setShowServerPasswords] = useState({});

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
    if (!garage) return { levels: 0, spots: 0, devices: 0, camFli: 0, camLpr: 0, camPeople: 0, signLed: 0, signStatic: 0, signDesignable: 0, sensorNwave: 0, sensorParksol: 0, sensorProco: 0, sensorEnsight: 0 };
    const levels = safeArray(garage.levels);
    let spots = 0;
    let devices = 0;
    const counts = { camFli: 0, camLpr: 0, camPeople: 0, signLed: 0, signStatic: 0, signDesignable: 0, sensorNwave: 0, sensorParksol: 0, sensorProco: 0, sensorEnsight: 0 };
    for (let i = 0; i < levels.length; i++) {
      const l = levels[i];
      if (l) {
        spots += safeNumber(l.totalSpots, 0);
        const devs = safeArray(l.devices);
        devices += devs.length;
        for (let j = 0; j < devs.length; j++) {
          const type = devs[j]?.type || '';
          if (type === 'cam-fli') counts.camFli++;
          else if (type === 'cam-lpr') counts.camLpr++;
          else if (type === 'cam-people') counts.camPeople++;
          else if (type === 'sign-led') counts.signLed++;
          else if (type === 'sign-static') counts.signStatic++;
          else if (type === 'sign-designable') counts.signDesignable++;
          else if (type === 'sensor-nwave') counts.sensorNwave++;
          else if (type === 'sensor-parksol') counts.sensorParksol++;
          else if (type === 'sensor-proco') counts.sensorProco++;
          else if (type === 'sensor-ensight') counts.sensorEnsight++;
        }
      }
    }
    return { levels: levels.length, spots, devices, ...counts };
  }, [garage]);

  // Update local time based on garage location's timezone
  React.useEffect(() => {
    if (!garage?.state) {
      setLocalTime('');
      return;
    }

    const updateTime = () => {
      const timezone = getTimezoneForState(garage.state);
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      const dateString = now.toLocaleDateString('en-US', {
        timeZone: timezone,
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      setLocalTime(`${timeString} - ${dateString}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [garage?.state]);

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

  // ========================= SERVER HANDLERS =========================

  const garageServers = useMemo(() => safeArray(garage?.servers), [garage]);

  const handleCloseServerModal = useCallback(() => {
    if (!mountedRef.current) return;
    setShowServerModal(false);
    setNewServer({ ...DEFAULT_NEW_SERVER });
    setIsProcessing(false);
  }, []);

  const handleCloseServerDetailModal = useCallback(() => {
    if (!mountedRef.current) return;
    setShowServerDetailModal(false);
    setViewingServer(null);
  }, []);

  const handleCloseEditServerModal = useCallback(() => {
    if (!mountedRef.current) return;
    setShowEditServerModal(false);
    setEditingServer(null);
    setIsProcessing(false);
  }, []);

  const addServer = useCallback(() => {
    if (isProcessing) return;
    const trimmedName = sanitizeString(newServer.name);
    if (!trimmedName) return;

    setIsProcessing(true);

    try {
      const updatedGarages = garages.map(g => {
        if (!g || g.id !== selectedGarageId) return g;
        const newId = generateServerId(g.servers);
        return {
          ...g,
          servers: [
            ...safeArray(g.servers),
            {
              id: newId,
              name: trimmedName,
              username: safeString(newServer.username).trim(),
              password: safeString(newServer.password),
              ipAddress: safeString(newServer.ipAddress).trim(),
              serverType: safeString(newServer.serverType) || 'Recording Server',
              os: safeString(newServer.os) || 'Windows Server 2022',
              details: safeString(newServer.details).trim()
            }
          ]
        };
      });

      setGarages(updatedGarages);

      if (mountedRef.current) {
        handleCloseServerModal();
      }
    } catch {
      if (mountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [isProcessing, newServer, garages, selectedGarageId, setGarages, handleCloseServerModal]);

  const updateServer = useCallback(() => {
    if (isProcessing) return;
    if (!editingServer || editingServer.id == null) return;
    const trimmedName = sanitizeString(editingServer.name);
    if (!trimmedName) return;

    setIsProcessing(true);

    try {
      const updatedGarages = garages.map(g => {
        if (!g || g.id !== selectedGarageId) return g;
        return {
          ...g,
          servers: safeArray(g.servers).map(s => {
            if (!s || s.id !== editingServer.id) return s;
            return {
              ...s,
              name: trimmedName,
              username: safeString(editingServer.username).trim(),
              password: safeString(editingServer.password),
              ipAddress: safeString(editingServer.ipAddress).trim(),
              serverType: safeString(editingServer.serverType) || 'Recording Server',
              os: safeString(editingServer.os) || 'Windows Server 2022',
              details: safeString(editingServer.details).trim()
            };
          })
        };
      });

      setGarages(updatedGarages);

      if (mountedRef.current) {
        handleCloseEditServerModal();
      }
    } catch {
      if (mountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [isProcessing, editingServer, garages, selectedGarageId, setGarages, handleCloseEditServerModal]);

  const deleteServer = useCallback((e, serverId) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    if (isProcessing) return;
    if (serverId == null) return;

    setIsProcessing(true);

    try {
      const updatedGarages = garages.map(g => {
        if (!g || g.id !== selectedGarageId) return g;
        return {
          ...g,
          servers: safeArray(g.servers).filter(s => s && s.id !== serverId)
        };
      });

      setGarages(updatedGarages);

      if (mountedRef.current) {
        handleCloseEditServerModal();
        handleCloseServerDetailModal();
      }
    } catch {
      if (mountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [isProcessing, garages, selectedGarageId, setGarages, handleCloseEditServerModal, handleCloseServerDetailModal]);

  const handleNewServerChange = useCallback((field) => (e) => {
    if (!mountedRef.current) return;
    const value = e?.target?.value ?? '';
    setNewServer(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleEditServerChange = useCallback((field) => (e) => {
    if (!mountedRef.current) return;
    const value = e?.target?.value ?? '';
    setEditingServer(prev => (prev ? { ...prev, [field]: value } : prev));
  }, []);

  const handleViewServer = useCallback((server) => {
    if (!server || server.id == null) return;
    setViewingServer(server);
    setShowServerDetailModal(true);
  }, []);

  const handleOpenEditServer = useCallback((server) => {
    if (!server || server.id == null) return;
    setEditingServer({
      id: server.id,
      name: safeString(server.name),
      username: safeString(server.username),
      password: safeString(server.password),
      ipAddress: safeString(server.ipAddress),
      serverType: safeString(server.serverType),
      os: safeString(server.os),
      details: safeString(server.details)
    });
    setShowServerDetailModal(false);
    setShowEditServerModal(true);
  }, []);

  const handleOpenAddServerModal = useCallback(() => {
    setNewServer({ ...DEFAULT_NEW_SERVER });
    setShowServerModal(true);
  }, []);

  const toggleServerPassword = useCallback((serverId) => {
    setShowServerPasswords(prev => ({ ...prev, [serverId]: !prev[serverId] }));
  }, []);

  // Count devices per server
  const serverDeviceCounts = useMemo(() => {
    const counts = {};
    if (!garage) return counts;
    safeArray(garage.levels).forEach(lvl => {
      safeArray(lvl?.devices).forEach(d => {
        if (d?.serverId) {
          counts[d.serverId] = (counts[d.serverId] || 0) + 1;
        }
      });
    });
    return counts;
  }, [garage]);

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
          {localTime && garage?.state && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              marginRight: '16px',
              fontSize: '13px',
              fontWeight: 500,
              color: mode === 'dark' ? '#a1a1aa' : '#52525b'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: mode === 'dark' ? '#fafafa' : '#18181b' }}>
                {localTime.split(' - ')[0]}
              </div>
              <div style={{ fontSize: '11px', marginTop: '2px' }}>
                {localTime.split(' - ')[1]} ({garage.state})
              </div>
            </div>
          )}
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

              {stats.devices > 0 && (
                <div className="garage-equipment-summary">
                  {(stats.camFli + stats.camLpr + stats.camPeople) > 0 && (
                    <div className="equipment-summary-group">
                      <span className="equipment-summary-icon">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M23 7l-7 5 7 5V7z" />
                          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                        </svg>
                      </span>
                      <span className="equipment-summary-label">Cameras:</span>
                      {stats.camFli > 0 && <span className="equipment-type-tag">FLI: {stats.camFli}</span>}
                      {stats.camLpr > 0 && <span className="equipment-type-tag">LPR: {stats.camLpr}</span>}
                      {stats.camPeople > 0 && <span className="equipment-type-tag">People: {stats.camPeople}</span>}
                    </div>
                  )}
                  {(stats.signLed + stats.signStatic + stats.signDesignable) > 0 && (
                    <div className="equipment-summary-group">
                      <span className="equipment-summary-icon">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <line x1="9" y1="9" x2="15" y2="9" />
                          <line x1="9" y1="15" x2="15" y2="15" />
                        </svg>
                      </span>
                      <span className="equipment-summary-label">Signs:</span>
                      {stats.signLed > 0 && <span className="equipment-type-tag">LED: {stats.signLed}</span>}
                      {stats.signStatic > 0 && <span className="equipment-type-tag">Static: {stats.signStatic}</span>}
                      {stats.signDesignable > 0 && <span className="equipment-type-tag">Designable: {stats.signDesignable}</span>}
                    </div>
                  )}
                  {(stats.sensorNwave + stats.sensorParksol + stats.sensorProco + stats.sensorEnsight) > 0 && (
                    <div className="equipment-summary-group">
                      <span className="equipment-summary-icon">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42m12.72-12.72l1.42-1.42" />
                        </svg>
                      </span>
                      <span className="equipment-summary-label">Sensors:</span>
                      {stats.sensorNwave > 0 && <span className="equipment-type-tag">NWAVE: {stats.sensorNwave}</span>}
                      {stats.sensorParksol > 0 && <span className="equipment-type-tag">Parksol: {stats.sensorParksol}</span>}
                      {stats.sensorProco > 0 && <span className="equipment-type-tag">Proco: {stats.sensorProco}</span>}
                      {stats.sensorEnsight > 0 && <span className="equipment-type-tag">Ensight: {stats.sensorEnsight}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="content-area">
              {/* ========================= SERVERS SECTION ========================= */}
              <div className="section-tools" style={{ marginBottom: 0 }}>
                <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                    <line x1="6" y1="6" x2="6.01" y2="6" />
                    <line x1="6" y1="18" x2="6.01" y2="18" />
                  </svg>
                  Servers ({garageServers.length})
                </div>
              </div>

              <div className="levels-grid" style={{ marginBottom: 24 }}>
                {garageServers.map((server) => {
                  if (!server || server.id == null) return null;
                  const deviceCount = serverDeviceCounts[server.id] || 0;
                  return (
                    <div
                      key={server.id}
                      className="level-card-premium"
                      onClick={() => handleViewServer(server)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleViewServer(server);
                        }
                      }}
                    >
                      <div
                        className="level-card-bg"
                        style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}
                      />
                      <div className="level-card-glass" />
                      <div className="level-card-content">
                        <div className="level-card-actions">
                          <button
                            className="level-action-btn"
                            onClick={(e) => { e.stopPropagation(); handleOpenEditServer(server); }}
                            title="Edit Server"
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
                              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                              <line x1="6" y1="6" x2="6.01" y2="6" />
                              <line x1="6" y1="18" x2="6.01" y2="18" />
                            </svg>
                          </div>
                          <h3 className="level-name">{safeString(server.name) || 'Unnamed Server'}</h3>
                        </div>

                        <div className="level-card-stats">
                          <div className="level-stat">
                            <span className="level-stat-value" style={{ fontSize: 11 }}>{safeString(server.serverType) || 'N/A'}</span>
                            <span className="level-stat-label">Type</span>
                          </div>
                          <div className="level-stat-divider" />
                          <div className="level-stat">
                            <span className="level-stat-value" style={{ fontSize: 11 }}>{safeString(server.os).split(' ').slice(0, 2).join(' ') || 'N/A'}</span>
                            <span className="level-stat-label">OS</span>
                          </div>
                          <div className="level-stat-divider" />
                          <div className="level-stat">
                            <span className="level-stat-value">{deviceCount}</span>
                            <span className="level-stat-label">Devices</span>
                          </div>
                        </div>

                        {server.ipAddress && (
                          <div className="level-equipment-breakdown">
                            <div className="level-equip-row">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                              </svg>
                              <span className="level-equip-tag">{server.ipAddress}</span>
                            </div>
                          </div>
                        )}

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
                  onClick={handleOpenAddServerModal}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenAddServerModal();
                    }
                  }}
                >
                  <div className="add-level-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                  <span>Add Server</span>
                </div>
              </div>

              <div className="section-tools">
                <div className="section-label">All Levels</div>
              </div>

              <div className="levels-grid">
                {garageLevels.map((level, index) => {
                  if (!level || level.id == null) return null;
                  const devices = safeArray(level.devices);
                  const deviceCount = devices.length;
                  const levelCounts = devices.reduce((acc, d) => {
                    const type = d?.type || '';
                    if (type === 'cam-fli') acc.camFli++;
                    else if (type === 'cam-lpr') acc.camLpr++;
                    else if (type === 'cam-people') acc.camPeople++;
                    else if (type === 'sign-led') acc.signLed++;
                    else if (type === 'sign-static') acc.signStatic++;
                    else if (type === 'sign-designable') acc.signDesignable++;
                    else if (type === 'sensor-nwave') acc.sensorNwave++;
                    else if (type === 'sensor-parksol') acc.sensorParksol++;
                    else if (type === 'sensor-proco') acc.sensorProco++;
                    else if (type === 'sensor-ensight') acc.sensorEnsight++;
                    return acc;
                  }, { camFli: 0, camLpr: 0, camPeople: 0, signLed: 0, signStatic: 0, signDesignable: 0, sensorNwave: 0, sensorParksol: 0, sensorProco: 0, sensorEnsight: 0 });
                  const levelTotalCameras = levelCounts.camFli + levelCounts.camLpr + levelCounts.camPeople;
                  const levelTotalSigns = levelCounts.signLed + levelCounts.signStatic + levelCounts.signDesignable;
                  const levelTotalSensors = levelCounts.sensorNwave + levelCounts.sensorParksol + levelCounts.sensorProco + levelCounts.sensorEnsight;
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

                        {deviceCount > 0 && (
                          <div className="level-equipment-breakdown">
                            {levelTotalCameras > 0 && (
                              <div className="level-equip-row">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M23 7l-7 5 7 5V7z" />
                                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                </svg>
                                {levelCounts.camFli > 0 && <span className="level-equip-tag">FLI: {levelCounts.camFli}</span>}
                                {levelCounts.camLpr > 0 && <span className="level-equip-tag">LPR: {levelCounts.camLpr}</span>}
                                {levelCounts.camPeople > 0 && <span className="level-equip-tag">People: {levelCounts.camPeople}</span>}
                              </div>
                            )}
                            {levelTotalSigns > 0 && (
                              <div className="level-equip-row">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                  <line x1="9" y1="9" x2="15" y2="9" />
                                  <line x1="9" y1="15" x2="15" y2="15" />
                                </svg>
                                {levelCounts.signLed > 0 && <span className="level-equip-tag">LED: {levelCounts.signLed}</span>}
                                {levelCounts.signStatic > 0 && <span className="level-equip-tag">Static: {levelCounts.signStatic}</span>}
                                {levelCounts.signDesignable > 0 && <span className="level-equip-tag">Designable: {levelCounts.signDesignable}</span>}
                              </div>
                            )}
                            {levelTotalSensors > 0 && (
                              <div className="level-equip-row">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="3" />
                                  <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42m12.72-12.72l1.42-1.42" />
                                </svg>
                                {levelCounts.sensorNwave > 0 && <span className="level-equip-tag">NWAVE: {levelCounts.sensorNwave}</span>}
                                {levelCounts.sensorParksol > 0 && <span className="level-equip-tag">Parksol: {levelCounts.sensorParksol}</span>}
                                {levelCounts.sensorProco > 0 && <span className="level-equip-tag">Proco: {levelCounts.sensorProco}</span>}
                                {levelCounts.sensorEnsight > 0 && <span className="level-equip-tag">Ensight: {levelCounts.sensorEnsight}</span>}
                              </div>
                            )}
                          </div>
                        )}

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

      {/* ========================= ADD SERVER MODAL ========================= */}
      <Modal open={showServerModal} onClose={handleCloseServerModal}>
        <ModalDialog sx={{ ...MODAL_SX, maxWidth: 520 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #3f3f46', background: '#27272a' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fafafa', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              Add New Server
            </h3>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={LABEL_STYLE}>Server Name</label>
              <Input
                size="sm"
                placeholder="e.g., NVR-01, Edge Server A"
                value={newServer.name}
                onChange={handleNewServerChange('name')}
                autoFocus
                sx={INPUT_SX}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL_STYLE}>Server Type</label>
                <select
                  value={newServer.serverType}
                  onChange={handleNewServerChange('serverType')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 14,
                    borderRadius: 6,
                    border: '1px solid #3f3f46',
                    background: '#27272a',
                    color: '#fafafa',
                    cursor: 'pointer'
                  }}
                >
                  {SERVER_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Operating System</label>
                <select
                  value={newServer.os}
                  onChange={handleNewServerChange('os')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 14,
                    borderRadius: 6,
                    border: '1px solid #3f3f46',
                    background: '#27272a',
                    color: '#fafafa',
                    cursor: 'pointer'
                  }}
                >
                  {OS_OPTIONS.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={LABEL_STYLE}>IP Address</label>
              <Input
                size="sm"
                placeholder="e.g., 10.16.1.100"
                value={newServer.ipAddress}
                onChange={handleNewServerChange('ipAddress')}
                sx={INPUT_SX}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL_STYLE}>Username</label>
                <Input
                  size="sm"
                  placeholder="admin"
                  value={newServer.username}
                  onChange={handleNewServerChange('username')}
                  sx={INPUT_SX}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Password</label>
                <Input
                  size="sm"
                  type="password"
                  placeholder="********"
                  value={newServer.password}
                  onChange={handleNewServerChange('password')}
                  sx={INPUT_SX}
                />
              </div>
            </div>

            <div>
              <label style={LABEL_STYLE}>Details / Notes</label>
              <Input
                size="sm"
                placeholder="Any additional details about this server..."
                value={newServer.details}
                onChange={handleNewServerChange('details')}
                sx={INPUT_SX}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid #3f3f46', background: '#27272a' }}>
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              onClick={handleCloseServerModal}
              disabled={isProcessing}
              sx={{ color: '#fafafa', borderColor: '#3f3f46', '&:hover': { bgcolor: '#3f3f46' } }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={addServer}
              disabled={!sanitizeString(newServer.name).length || isProcessing}
              loading={isProcessing}
            >
              Add Server
            </Button>
          </div>
        </ModalDialog>
      </Modal>

      {/* ========================= VIEW SERVER DETAIL MODAL ========================= */}
      <Modal open={showServerDetailModal} onClose={handleCloseServerDetailModal}>
        <ModalDialog sx={{ ...MODAL_SX, maxWidth: 520 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #3f3f46', background: '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fafafa', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              {safeString(viewingServer?.name) || 'Server Details'}
            </h3>
            <button
              onClick={() => viewingServer && handleOpenEditServer(viewingServer)}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid #3f3f46',
                borderRadius: 6,
                color: '#3b82f6',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          </div>

          {viewingServer && (
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ padding: '12px 16px', background: '#27272a', borderRadius: 8, border: '1px solid #3f3f46' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Server Type</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#fafafa' }}>{safeString(viewingServer.serverType) || 'N/A'}</div>
                </div>
                <div style={{ padding: '12px 16px', background: '#27272a', borderRadius: 8, border: '1px solid #3f3f46' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Operating System</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#fafafa' }}>{safeString(viewingServer.os) || 'N/A'}</div>
                </div>
              </div>

              <div style={{ padding: '12px 16px', background: '#27272a', borderRadius: 8, border: '1px solid #3f3f46', marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>IP Address</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#fafafa', fontFamily: 'monospace' }}>{safeString(viewingServer.ipAddress) || 'N/A'}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div style={{ padding: '12px 16px', background: '#27272a', borderRadius: 8, border: '1px solid #3f3f46' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Username</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#fafafa', fontFamily: 'monospace' }}>{safeString(viewingServer.username) || 'N/A'}</div>
                </div>
                <div style={{ padding: '12px 16px', background: '#27272a', borderRadius: 8, border: '1px solid #3f3f46' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Password</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#fafafa', fontFamily: 'monospace', flex: 1 }}>
                      {showServerPasswords[viewingServer.id] ? (safeString(viewingServer.password) || 'N/A') : '••••••••'}
                    </div>
                    <button
                      onClick={() => toggleServerPassword(viewingServer.id)}
                      style={{
                        padding: '2px 6px',
                        background: 'transparent',
                        border: '1px solid #3f3f46',
                        borderRadius: 4,
                        color: '#a1a1aa',
                        fontSize: 10,
                        cursor: 'pointer'
                      }}
                    >
                      {showServerPasswords[viewingServer.id] ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>

              {safeString(viewingServer.details) && (
                <div style={{ padding: '12px 16px', background: '#27272a', borderRadius: 8, border: '1px solid #3f3f46', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Details</div>
                  <div style={{ fontSize: 13, color: '#d4d4d8', lineHeight: 1.5 }}>{viewingServer.details}</div>
                </div>
              )}

              <div style={{ padding: '12px 16px', background: '#27272a', borderRadius: 8, border: '1px solid #3f3f46' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Assigned Devices</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#fafafa' }}>{serverDeviceCounts[viewingServer.id] || 0} device(s)</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid #3f3f46', background: '#27272a' }}>
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              onClick={handleCloseServerDetailModal}
              sx={{ color: '#fafafa', borderColor: '#3f3f46', '&:hover': { bgcolor: '#3f3f46' } }}
            >
              Close
            </Button>
          </div>
        </ModalDialog>
      </Modal>

      {/* ========================= EDIT SERVER MODAL ========================= */}
      <Modal open={showEditServerModal} onClose={handleCloseEditServerModal}>
        <ModalDialog sx={{ ...MODAL_SX, maxWidth: 520 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #3f3f46', background: '#27272a' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fafafa', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              Edit Server
            </h3>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={LABEL_STYLE}>Server Name</label>
              <Input
                size="sm"
                placeholder="e.g., NVR-01, Edge Server A"
                value={editingServer?.name || ''}
                onChange={handleEditServerChange('name')}
                autoFocus
                sx={INPUT_SX}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL_STYLE}>Server Type</label>
                <select
                  value={editingServer?.serverType || ''}
                  onChange={handleEditServerChange('serverType')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 14,
                    borderRadius: 6,
                    border: '1px solid #3f3f46',
                    background: '#27272a',
                    color: '#fafafa',
                    cursor: 'pointer'
                  }}
                >
                  {SERVER_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Operating System</label>
                <select
                  value={editingServer?.os || ''}
                  onChange={handleEditServerChange('os')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 14,
                    borderRadius: 6,
                    border: '1px solid #3f3f46',
                    background: '#27272a',
                    color: '#fafafa',
                    cursor: 'pointer'
                  }}
                >
                  {OS_OPTIONS.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label style={LABEL_STYLE}>IP Address</label>
              <Input
                size="sm"
                placeholder="e.g., 10.16.1.100"
                value={editingServer?.ipAddress || ''}
                onChange={handleEditServerChange('ipAddress')}
                sx={INPUT_SX}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL_STYLE}>Username</label>
                <Input
                  size="sm"
                  placeholder="admin"
                  value={editingServer?.username || ''}
                  onChange={handleEditServerChange('username')}
                  sx={INPUT_SX}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Password</label>
                <Input
                  size="sm"
                  type="password"
                  placeholder="********"
                  value={editingServer?.password || ''}
                  onChange={handleEditServerChange('password')}
                  sx={INPUT_SX}
                />
              </div>
            </div>

            <div>
              <label style={LABEL_STYLE}>Details / Notes</label>
              <Input
                size="sm"
                placeholder="Any additional details about this server..."
                value={editingServer?.details || ''}
                onChange={handleEditServerChange('details')}
                sx={INPUT_SX}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #3f3f46', background: '#27272a' }}>
            <Button
              size="sm"
              variant="soft"
              color="danger"
              onClick={(e) => editingServer && deleteServer(e, editingServer.id)}
              disabled={isProcessing}
            >
              Delete Server
            </Button>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                size="sm"
                variant="outlined"
                color="neutral"
                onClick={handleCloseEditServerModal}
                disabled={isProcessing}
                sx={{ color: '#fafafa', borderColor: '#3f3f46', '&:hover': { bgcolor: '#3f3f46' } }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={updateServer}
                disabled={!(editingServer && sanitizeString(editingServer.name).length > 0) || isProcessing}
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
