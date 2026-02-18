import React, { useContext, useState, useRef, useMemo, useCallback } from 'react';
import { Modal, ModalDialog, Input, Button } from '@mui/joy';
import { AppContext } from '../App';
import MapCanvas from './MapCanvas';
import InspectorPanel from './InspectorPanel';
import { jsPDF } from 'jspdf';
import {
  generateCameraHubConfig,
  parseCameraHubConfig,
  generateDevicesConfig,
  parseDevicesConfig,
  generateFLICameraConfig,
  downloadFile,
  readFileAsText,
  exportAllConfigs,
  getConfigFilePaths
} from '../services/ConfigService';

// ========================= CONSTANTS =========================

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

const deviceTypes = {
  cameras: [
    { id: 'cam-fli', name: 'FLI Camera' },
    { id: 'cam-lpr', name: 'LPR Camera' },
    { id: 'cam-people', name: 'People Counting' }
  ],
  hardwareTypes: [
    { id: 'dual-lens', name: 'Dual Lens', streams: 2 },
    { id: 'bullet', name: 'Bullet', streams: 1 }
  ],
  signs: [
    { id: 'sign-led', name: 'LED Sign' },
    { id: 'sign-static', name: 'Static Sign' },
    { id: 'sign-designable', name: 'Designable Sign' }
  ],
  sensorGroups: [
    { id: 'sensor-nwave', name: 'NWAVE' },
    { id: 'sensor-parksol', name: 'Parksol' },
    { id: 'sensor-proco', name: 'Proco' },
    { id: 'sensor-ensight', name: 'Ensight Vision' }
  ],
  parkingTypes: [
    { id: 'ev', name: 'EV' },
    { id: 'ada', name: 'ADA' },
    { id: 'normal', name: 'Normal' }
  ]
};

const safeArray = (arr) => (Array.isArray(arr) ? arr : []);
const safeString = (val) => (typeof val === 'string' ? val : '');
const safeNumber = (val, fallback = 0) => {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const sanitizeString = (val) => safeString(val).trim();

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

// ========================= MAIN COMPONENT =========================

const EditorView = () => {
  const context = useContext(AppContext);
  const mountedRef = useRef(true);
  const fileInputRef = useRef(null);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Safe context extraction - must be before useEffects that depend on these values
  const garages = safeArray(context?.garages);
  const setGarages = typeof context?.setGarages === 'function' ? context.setGarages : () => {};
  const selectedGarageId = context?.selectedGarageId;
  const selectedLevelId = context?.selectedLevelId;
  const setSelectedLevelId = typeof context?.setSelectedLevelId === 'function' ? context.setSelectedLevelId : () => {};
  const selectedDevice = context?.selectedDevice;
  const setSelectedDevice = typeof context?.setSelectedDevice === 'function' ? context.setSelectedDevice : () => {};
  const goBack = typeof context?.goBack === 'function' ? context.goBack : () => {};
  const mode = context?.mode === 'light' ? 'light' : 'dark';
  const setMode = typeof context?.setMode === 'function' ? context.setMode : () => {};

  // State for import/export messages
  const [importMessage, setImportMessage] = useState(null);

  // State for local time display
  const [localTime, setLocalTime] = useState('');

  // Theme colors based on mode
  const theme = useMemo(() => ({
    bg: mode === 'dark' ? '#09090b' : '#f4f4f5',
    bgSurface: mode === 'dark' ? '#18181b' : '#ffffff',
    bgElevated: mode === 'dark' ? 'rgba(24, 24, 27, 0.8)' : 'rgba(255, 255, 255, 0.95)',
    bgHover: mode === 'dark' ? 'rgba(39, 39, 42, 0.8)' : 'rgba(244, 244, 245, 0.9)',
    bgButton: mode === 'dark' ? 'rgba(63, 63, 70, 0.6)' : 'rgba(228, 228, 231, 0.8)',
    bgButtonHover: mode === 'dark' ? 'rgba(82, 82, 91, 0.8)' : 'rgba(212, 212, 216, 0.9)',
    border: mode === 'dark' ? '#27272a' : '#e4e4e7',
    borderSubtle: mode === 'dark' ? '#3f3f46' : '#d4d4d8',
    text: mode === 'dark' ? '#fafafa' : '#18181b',
    textSecondary: mode === 'dark' ? '#a1a1aa' : '#52525b',
    textMuted: mode === 'dark' ? '#71717a' : '#71717a',
    sidebar: mode === 'dark' ? '#18181b' : '#ffffff',
    sidebarBorder: mode === 'dark' ? '#27272a' : '#e4e4e7',
    inputBg: mode === 'dark' ? '#27272a' : '#f4f4f5',
    inputBorder: mode === 'dark' ? '#444' : '#d4d4d8'
  }), [mode]);

  // Local state
  const [activeTab, setActiveTab] = useState('servers');
  const [mapFilter, setMapFilter] = useState([]); // [] = show all, or array of active filters: 'cameras', 'spaceMonitoring', 'signs'
  const [showAddForm, setShowAddForm] = useState(false);
  const [showLevelSettings, setShowLevelSettings] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configImportType, setConfigImportType] = useState('devicesConfig'); // 'devicesConfig', 'cameraHub'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [cameraFormStep, setCameraFormStep] = useState(1); // 1: hardware, 2: type, 3: config
  const [activeStreamTab, setActiveStreamTab] = useState(1); // For dual lens: 1 or 2
  const [collapsedSensorGroups, setCollapsedSensorGroups] = useState({}); // Track collapsed state per sensor group
  const [selectedServerId, setSelectedServerId] = useState(null); // Track which server is expanded
  const [serverFormTab, setServerFormTab] = useState('identity'); // 'identity' | 'networking' | 'splashtop'
  const [newServer, setNewServer] = useState({
    name: '',
    ram: '',
    ramCustom: '',
    ssd: '',
    ssdCustom: '',
    os: '',
    osCustom: '',
    ethernetPortCount: 2,
    ethernetPorts: [
      { mac: '', ip: '', dhcp: false },
      { mac: '', ip: '', dhcp: false }
    ],
    loginUsername: '',
    loginPassword: '',
    splashtopLink: '',
  });
  const configFileInputRef = useRef(null);

  // Helper to update a server property in the garage's servers array
  const updateServerProp = (serverId, updates) => {
    const updatedGarages = garages.map(g => {
      if (g.id !== selectedGarageId) return g;
      return {
        ...g,
        servers: safeArray(g.servers).map(s =>
          s.id === serverId ? { ...s, ...updates } : s
        )
      };
    });
    setGarages(updatedGarages);
  };

  const [newDevice, setNewDevice] = useState({
    type: '',
    hardwareType: '', // 'dual-lens' or 'bullet'
    name: '',
    // Stream 1 settings
    stream1: {
      ipAddress: '',
      port: '',
      direction: 'in',
      rotation: 0,
      flowDestination: 'garage-entry',
      viewImage: null,
      externalUrl: '',
      streamType: '' // 'cam-fli' or 'cam-lpr' for dual-lens
    },
    // Stream 2 settings (for dual lens)
    stream2: {
      ipAddress: '',
      port: '',
      direction: 'in',
      rotation: 0,
      flowDestination: 'garage-entry',
      viewImage: null,
      externalUrl: '',
      streamType: '' // 'cam-fli' or 'cam-lpr' for dual-lens
    },
    // Legacy fields for signs/sensors
    ipAddress: '',
    port: '',
    direction: 'in',
    rotation: 0,
    flowDestination: 'garage-entry',
    viewImage: null,
    previewUrl: '',
    displayMapping: [],
    overrideState: 'auto',
    serialAddress: '',
    spotNumber: '',
    parkingType: 'normal',
    sensorImage: null,
    externalUrl: '',
    // Sensor group fields
    sensorGroup: '',
    sensorId: '',
    tempParkingTimeMinutes: '',
    controllerKey: '',
    // Server and sign association
    serverId: '',
    signId: ''
  });

  // Memoized garage and level
  const garage = useMemo(() => {
    if (selectedGarageId == null) return null;
    return garages.find(g => g && g.id === selectedGarageId) || null;
  }, [garages, selectedGarageId]);

  const level = useMemo(() => {
    if (!garage || selectedLevelId == null) return null;
    return safeArray(garage.levels).find(l => l && l.id === selectedLevelId) || null;
  }, [garage, selectedLevelId]);

  const allLevels = useMemo(() => safeArray(garage?.levels), [garage]);

  // Servers for the garage (for camera-server association)
  const garageServers = useMemo(() => safeArray(garage?.servers), [garage]);

  // All signs across all levels (for camera-sign association)
  const allGarageSigns = useMemo(() => {
    const signsList = [];
    safeArray(garage?.levels).forEach(lvl => {
      safeArray(lvl?.devices).forEach(d => {
        if (d?.type?.startsWith('sign-')) {
          signsList.push({ ...d, levelName: lvl.name });
        }
      });
    });
    return signsList;
  }, [garage]);

  // Address
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

  // Level devices
  const levelDevices = useMemo(() => safeArray(level?.devices), [level]);
  const cameras = useMemo(() => levelDevices.filter(d => d.type?.startsWith('cam-')), [levelDevices]);
  const spaceMonitors = useMemo(() => levelDevices.filter(d => d.type?.startsWith('sensor-')), [levelDevices]);
  const signs = useMemo(() => levelDevices.filter(d => d.type?.startsWith('sign-')), [levelDevices]);

  // Stats
  const stats = useMemo(() => ({
    cameras: cameras.length,
    spaceMonitors: spaceMonitors.length,
    signs: signs.length,
    servers: garageServers.length
  }), [cameras, spaceMonitors, signs, garageServers]);

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

  // Pending placement counts
  const pendingCameras = useMemo(() => cameras.filter(d => d.pendingPlacement), [cameras]);
  const pendingSigns = useMemo(() => signs.filter(d => d.pendingPlacement), [signs]);
  const pendingSpaceMonitors = useMemo(() => spaceMonitors.filter(d => d.pendingPlacement), [spaceMonitors]);
  const hasPendingDevices = pendingCameras.length > 0 || pendingSigns.length > 0 || pendingSpaceMonitors.length > 0;

  // Group sensors by sensorGroup for collapsible display
  const groupedSensors = useMemo(() => {
    const groups = {};
    spaceMonitors.forEach(sensor => {
      const groupId = sensor.sensorGroup || sensor.type || 'other';
      if (!groups[groupId]) {
        groups[groupId] = [];
      }
      groups[groupId].push(sensor);
    });
    return groups;
  }, [spaceMonitors]);

  // Sensor group labels
  const sensorGroupLabels = {
    'sensor-nwave': 'NWAVE',
    'sensor-parksol': 'Parksol',
    'sensor-proco': 'Proco',
    'sensor-ensight': 'Ensight Vision',
    'sensor-space': 'Space Sensor'
  };

  const toggleSensorGroup = useCallback((groupId) => {
    setCollapsedSensorGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  }, []);

  // Level navigation
  const currentLevelIndex = useMemo(() => allLevels.findIndex(l => l?.id === selectedLevelId), [allLevels, selectedLevelId]);
  const prevLevel = allLevels[currentLevelIndex - 1];
  const nextLevel = allLevels[currentLevelIndex + 1];

  // Handlers
  const toggleMode = useCallback(() => {
    if (!mountedRef.current) return;
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const handleLevelChange = useCallback((direction) => {
    if (direction === 'prev' && prevLevel) {
      setSelectedLevelId(prevLevel.id);
    } else if (direction === 'next' && nextLevel) {
      setSelectedLevelId(nextLevel.id);
    }
  }, [prevLevel, nextLevel, setSelectedLevelId]);

  const getDeviceIcon = useCallback((type) => {
    if (type?.startsWith('cam-')) {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
        </svg>
      );
    }
    if (type?.startsWith('sign-')) {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      );
    }
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v20M2 12h20" />
      </svg>
    );
  }, []);

  const getFlowOptions = useCallback((direction) => {
    const options = [
      { value: 'garage-entry', label: 'Street / External' },
      { value: 'garage-exit', label: 'Exit to Street' }
    ];
    allLevels.forEach(l => {
      if (l && l.id !== selectedLevelId) {
        options.push({ value: `level-${l.id}`, label: l.name });
      }
    });
    return options;
  }, [allLevels, selectedLevelId]);

  const handleNewDeviceImageUpload = useCallback((e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setNewDevice(prev => ({ ...prev, viewImage: event.target.result }));
    };
    reader.readAsDataURL(file);
  }, []);

  const resetNewDevice = useCallback(() => {
    setCameraFormStep(1);
    setActiveStreamTab(1);
    setNewDevice({
      type: '',
      hardwareType: '',
      name: '',
      stream1: {
        ipAddress: '',
        port: '',
        direction: 'in',
        rotation: 0,
        flowDestination: 'garage-entry',
        viewImage: null,
        externalUrl: '',
        streamType: ''
      },
      stream2: {
        ipAddress: '',
        port: '',
        direction: 'in',
        rotation: 0,
        flowDestination: 'garage-entry',
        viewImage: null,
        externalUrl: '',
        streamType: ''
      },
      ipAddress: '',
      port: '',
      direction: 'in',
      rotation: 0,
      flowDestination: 'garage-entry',
      viewImage: null,
      previewUrl: '',
      displayMapping: [],
      overrideState: 'auto',
      serialAddress: '',
      spotNumber: '',
      parkingType: 'normal',
      sensorImage: null,
      externalUrl: '',
      sensorGroup: '',
      sensorId: '',
      tempParkingTimeMinutes: '',
      controllerKey: '',
      serverId: '',
      signId: ''
    });
  }, []);

  const addDevice = useCallback(() => {
    if (!newDevice.name.trim()) return;
    // Determine device type based on active tab and sensor group
    let deviceType = newDevice.type;
    if (!deviceType) {
      if (activeTab === 'spaceMonitoring') {
        deviceType = newDevice.sensorGroup || 'sensor-nwave';
      } else if (activeTab === 'cameras') {
        deviceType = 'cam-fli';
      } else {
        deviceType = 'sign-led';
      }
    }
    const deviceToAdd = {
      id: Date.now(),
      ...newDevice,
      type: deviceType,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200
    };
    const updatedGarages = garages.map(g => {
      if (g.id !== selectedGarageId) return g;
      return {
        ...g,
        levels: safeArray(g.levels).map(l => {
          if (l.id !== selectedLevelId) return l;
          return { ...l, devices: [...safeArray(l.devices), deviceToAdd] };
        })
      };
    });
    setGarages(updatedGarages);
    setShowAddForm(false);
    resetNewDevice();
  }, [newDevice, activeTab, garages, selectedGarageId, selectedLevelId, setGarages, resetNewDevice]);

  // Helper to update stream settings
  const updateStream = useCallback((streamNum, field, value) => {
    const streamKey = streamNum === 1 ? 'stream1' : 'stream2';
    setNewDevice(prev => ({
      ...prev,
      [streamKey]: {
        ...prev[streamKey],
        [field]: value
      }
    }));
  }, []);

  // Place a pending device on the canvas
  const placeDeviceOnCanvas = useCallback((deviceId) => {
    const updatedGarages = garages.map(g => {
      if (g.id !== selectedGarageId) return g;
      return {
        ...g,
        levels: safeArray(g.levels).map(l => {
          if (l.id !== selectedLevelId) return l;
          return {
            ...l,
            devices: safeArray(l.devices).map(d => {
              if (d.id !== deviceId) return d;
              // Assign random position and remove pending flag
              return {
                ...d,
                x: 100 + Math.random() * 200,
                y: 100 + Math.random() * 200,
                pendingPlacement: false
              };
            })
          };
        })
      };
    });
    setGarages(updatedGarages);
  }, [garages, selectedGarageId, selectedLevelId, setGarages]);

  // Place all pending devices on canvas
  const placeAllPendingDevices = useCallback(() => {
    const updatedGarages = garages.map(g => {
      if (g.id !== selectedGarageId) return g;
      return {
        ...g,
        levels: safeArray(g.levels).map(l => {
          if (l.id !== selectedLevelId) return l;
          return {
            ...l,
            devices: safeArray(l.devices).map(d => {
              if (!d.pendingPlacement) return d;
              return {
                ...d,
                x: 100 + Math.random() * 400,
                y: 100 + Math.random() * 300,
                pendingPlacement: false
              };
            })
          };
        })
      };
    });
    setGarages(updatedGarages);
  }, [garages, selectedGarageId, selectedLevelId, setGarages]);

  // ========================= CONFIG EXPORT/IMPORT =========================

  // Export all configs for current level devices
  const handleExportConfigs = useCallback(() => {
    if (!level) return;
    const allDevices = safeArray(level.devices);
    if (allDevices.length === 0) {
      setImportMessage({ type: 'warning', text: 'No devices to export on this level.' });
      setTimeout(() => setImportMessage(null), 3000);
      return;
    }

    const result = exportAllConfigs(allDevices);
    setImportMessage({
      type: 'success',
      text: `Exported: ${result.cameraHubConfig ? 'camerahub-config.xml, ' : ''}DevicesConfig.xml${result.fliConfigs > 0 ? `, ${result.fliConfigs} FLI config(s)` : ''}`
    });
    setTimeout(() => setImportMessage(null), 5000);
  }, [level]);

  // Export configs for all garage devices
  const handleExportAllGarageConfigs = useCallback(() => {
    if (!garage) return;
    const allDevices = [];
    safeArray(garage.levels).forEach(lvl => {
      safeArray(lvl.devices).forEach(device => {
        allDevices.push(device);
      });
    });

    if (allDevices.length === 0) {
      setImportMessage({ type: 'warning', text: 'No devices to export in this garage.' });
      setTimeout(() => setImportMessage(null), 3000);
      return;
    }

    const result = exportAllConfigs(allDevices);
    setImportMessage({
      type: 'success',
      text: `Exported all garage configs: ${allDevices.length} device(s)`
    });
    setTimeout(() => setImportMessage(null), 5000);
  }, [garage]);

  // Handle config file import
  const handleConfigFileImport = useCallback(async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      let importedDevices = [];

      if (configImportType === 'devicesConfig') {
        importedDevices = parseDevicesConfig(content);
      } else if (configImportType === 'cameraHub') {
        importedDevices = parseCameraHubConfig(content);
      }

      if (importedDevices.length === 0) {
        setImportMessage({ type: 'error', text: 'No devices found in the config file.' });
        setTimeout(() => setImportMessage(null), 3000);
        return;
      }

      // Add imported devices to current level
      const updatedGarages = garages.map(g => {
        if (g.id !== selectedGarageId) return g;
        return {
          ...g,
          levels: safeArray(g.levels).map(l => {
            if (l.id !== selectedLevelId) return l;
            return {
              ...l,
              devices: [...safeArray(l.devices), ...importedDevices]
            };
          })
        };
      });
      setGarages(updatedGarages);

      setImportMessage({
        type: 'success',
        text: `Imported ${importedDevices.length} device(s) from ${file.name}`
      });
      setShowConfigModal(false);
      setTimeout(() => setImportMessage(null), 5000);
    } catch (error) {
      console.error('Error importing config:', error);
      setImportMessage({ type: 'error', text: 'Failed to parse config file.' });
      setTimeout(() => setImportMessage(null), 3000);
    }

    e.target.value = ''; // Reset input
  }, [configImportType, garages, selectedGarageId, selectedLevelId, setGarages]);

  // Generate single camera config files
  const handleExportCameraConfigs = useCallback((camera) => {
    // Generate CameraHub entry
    const cameraHubXml = generateCameraHubConfig([camera]);
    downloadFile(cameraHubXml, `${camera.name}-camerahub-entry.xml`);

    // Generate DevicesConfig entry
    const devicesXml = generateDevicesConfig([camera]);
    downloadFile(devicesXml, `${camera.name}-device-entry.xml`);

    // Generate FLI config if applicable
    if (camera.type === 'cam-fli') {
      const fliXml = generateFLICameraConfig(camera);
      downloadFile(fliXml, `${camera.name}.xml`);
    }

    setImportMessage({
      type: 'success',
      text: `Exported config files for ${camera.name}`
    });
    setTimeout(() => setImportMessage(null), 3000);
  }, []);

  // Generate config for a single sign or sensor
  const handleExportDeviceConfig = useCallback((device) => {
    const devicesXml = generateDevicesConfig([device]);
    downloadFile(devicesXml, `${device.name}-device-entry.xml`);

    setImportMessage({
      type: 'success',
      text: `Exported config for ${device.name}`
    });
    setTimeout(() => setImportMessage(null), 3000);
  }, []);

  // ========================= PDF EXPORT =========================

  const exportLayoutPDF = useCallback(async () => {
    if (!garage) return;

    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Get current date/time for PDF
      const timezone = getTimezoneForState(garage.state);
      const now = new Date();
      const dateTimeString = now.toLocaleString('en-US', {
        timeZone: timezone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      // Helper: load image as data URL and get dimensions
      const loadImageForPdf = (src) => {
        return new Promise((resolve) => {
          if (!src) { resolve(null); return; }
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: img.naturalWidth, height: img.naturalHeight });
            } catch { resolve(null); }
          };
          img.onerror = () => resolve(null);
          img.src = src;
        });
      };

      // Comprehensive color map for every device sub-type
      const typeColorMap = {
        'cam-fli':          [59, 130, 246],   // blue
        'cam-lpr':          [99, 102, 241],   // indigo
        'cam-people':       [14, 165, 233],   // sky
        'cam-ptz':          [6, 182, 212],    // cyan
        'cam-dome':         [56, 189, 248],   // light blue
        'camera':           [59, 130, 246],
        'sign-led':         [34, 197, 94],    // green
        'sign-static':      [22, 163, 74],    // darker green
        'sign-designable':  [74, 222, 128],   // light green
        'sign':             [34, 197, 94],
        'sensor-nwave':     [245, 158, 11],   // amber
        'sensor-parksol':   [251, 146, 60],   // orange
        'sensor-proco':     [234, 179, 8],    // yellow
        'sensor-ensight':   [217, 119, 6],    // dark amber
        'sensor-space':     [253, 186, 116],  // peach
        'sensor':           [245, 158, 11],
        'server':           [168, 85, 247],   // purple
      };
      const getColor = (type) => typeColorMap[type] || [161, 161, 170];

      // Convert hex color string to [r, g, b] array
      const hexToRgb = (hex) => {
        if (!hex || typeof hex !== 'string') return null;
        const h = hex.replace('#', '');
        if (h.length === 3) return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
        if (h.length === 6) return [parseInt(h.substring(0,2),16), parseInt(h.substring(2,4),16), parseInt(h.substring(4,6),16)];
        return null;
      };

      // Get the effective color for a device: custom color takes priority over type color
      const getDeviceRgb = (device) => hexToRgb(device.color) || getColor(device.type);

      // Friendly label map
      const typeLabelMap = {
        'cam-fli': 'FLI Camera', 'cam-lpr': 'LPR Camera', 'cam-people': 'People Counting',
        'cam-ptz': 'PTZ Camera', 'cam-dome': 'Dome Camera',
        'sign-led': 'LED Sign', 'sign-static': 'Static Sign', 'sign-designable': 'Designable Sign',
        'sensor-nwave': 'NWAVE Sensor', 'sensor-parksol': 'Parksol Sensor',
        'sensor-proco': 'Proco Sensor', 'sensor-ensight': 'Ensight Vision',
        'sensor-space': 'Space Sensor', 'server': 'Server',
      };
      const getLabel = (type) => typeLabelMap[type] || type || 'Device';

      // Short label for the dot itself
      const getDotLabel = (type) => {
        if (type === 'cam-fli') return 'FLI';
        if (type === 'cam-lpr') return 'LPR';
        if (type === 'cam-people') return 'PPL';
        if (type === 'cam-ptz') return 'PTZ';
        if (type === 'cam-dome') return 'DME';
        if (type === 'server') return 'SRV';
        if (type?.startsWith('sign-')) return type.replace('sign-', '').charAt(0).toUpperCase();
        if (type?.startsWith('sensor-')) return 'P';
        return '';
      };

      // Helper: draw a direction cone (wedge) in the PDF
      const drawCone = (pdf, cx, cy, rotation, radius, colorRgb, opacity) => {
        const angleSpread = 60; // degrees
        const startAngle = ((rotation || 0) - 30) * Math.PI / 180; // same as Konva: 0=right, clockwise
        const endAngle = startAngle + (angleSpread * Math.PI / 180);
        const steps = 24;
        const points = [[cx, cy]];
        for (let i = 0; i <= steps; i++) {
          const a = startAngle + (endAngle - startAngle) * (i / steps);
          points.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
        }
        // Draw filled triangle/wedge using lines with low opacity
        // jsPDF doesn't support true alpha, so we blend the color toward background (22, 26, 36)
        const bg = [22, 26, 36];
        const blended = colorRgb.map((c, i) => Math.round(bg[i] * (1 - opacity) + c * opacity));
        pdf.setFillColor(...blended);
        // Build the polygon path
        const startPt = points[0];
        const pathLines = points.slice(1);
        // Use triangle fan approach
        for (let i = 0; i < pathLines.length - 1; i++) {
          pdf.triangle(
            startPt[0], startPt[1],
            pathLines[i][0], pathLines[i][1],
            pathLines[i + 1][0], pathLines[i + 1][1],
            'F'
          );
        }
      };

      const levels = safeArray(garage.levels);
      if (levels.length === 0) {
        alert('No levels to export.');
        return;
      }

      for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
        const currentLevel = levels[levelIndex];
        if (levelIndex > 0) pdf.addPage();

        // Background
        pdf.setFillColor(18, 20, 28);
        pdf.rect(0, 0, pageWidth, pageHeight, 'F');

        // Header bar
        const headerHeight = 55;
        pdf.setFillColor(28, 32, 42);
        pdf.rect(0, 0, pageWidth, headerHeight, 'F');
        pdf.setFillColor(59, 130, 246);
        pdf.rect(0, headerHeight - 2, pageWidth, 2, 'F');

        // Brand accent bar
        pdf.setFillColor(59, 130, 246);
        pdf.roundedRect(20, 12, 4, 30, 2, 2, 'F');

        // Garage name
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(22);
        pdf.setFont('helvetica', 'bold');
        pdf.text(String(garage.name || 'Untitled'), 34, 28);

        // Date/Time + address
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(161, 161, 170);
        pdf.text(dateTimeString + (garage.state ? ` (${garage.state})` : ''), 34, 44);

        // Level badge
        const levelText = String(currentLevel.name || `Level ${levelIndex + 1}`);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        const levelTextWidth = pdf.getTextWidth(levelText) + 20;
        pdf.setFillColor(59, 130, 246);
        pdf.roundedRect(pageWidth - levelTextWidth - 20, 15, levelTextWidth, 26, 13, 13, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.text(levelText, pageWidth - levelTextWidth / 2 - 20, 33, { align: 'center' });

        // Filter placed devices
        const placedDevices = safeArray(currentLevel.devices).filter(d =>
          d && typeof d.x === 'number' && typeof d.y === 'number' && !isNaN(d.x) && !isNaN(d.y) && !d.pendingPlacement
        );

        // Collect unique types on this level for the legend
        const typesOnLevel = new Map(); // type -> count
        placedDevices.forEach(d => {
          const t = d.type || 'unknown';
          typesOnLevel.set(t, (typesOnLevel.get(t) || 0) + 1);
        });

        // Layout dimensions
        const canvasMargin = 32;
        const legendItemH = 16;
        const legendRows = Math.max(1, Math.ceil(typesOnLevel.size / 4));
        const legendHeight = legendRows * legendItemH + 18;
        const canvasY = headerHeight + 16;
        const canvasWidth = pageWidth - canvasMargin * 2;
        const canvasHeight = pageHeight - canvasY - legendHeight - 28;

        // Canvas container
        pdf.setFillColor(22, 26, 36);
        pdf.setDrawColor(38, 44, 58);
        pdf.setLineWidth(1);
        pdf.roundedRect(canvasMargin, canvasY, canvasWidth, canvasHeight, 8, 8, 'FD');

        // Render background image if available
        if (currentLevel.bgImage) {
          try {
            const imgData = await loadImageForPdf(currentLevel.bgImage);
            if (imgData) {
              const innerPad = 4;
              const imgAspect = imgData.width / imgData.height;
              const areaW = canvasWidth - innerPad * 2;
              const areaH = canvasHeight - innerPad * 2;
              const areaAspect = areaW / areaH;
              let drawW, drawH;
              if (imgAspect > areaAspect) { drawW = areaW; drawH = areaW / imgAspect; }
              else { drawH = areaH; drawW = areaH * imgAspect; }
              const drawX = canvasMargin + innerPad + (areaW - drawW) / 2;
              const drawY = canvasY + innerPad + (areaH - drawH) / 2;
              pdf.addImage(imgData.dataUrl, 'JPEG', drawX, drawY, drawW, drawH);
            }
          } catch (e) {
            console.warn('Could not render background image in PDF:', e);
          }
        }

        if (placedDevices.length > 0) {
          // Compute bounds
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          placedDevices.forEach(d => {
            minX = Math.min(minX, d.x - 30);
            minY = Math.min(minY, d.y - 30);
            maxX = Math.max(maxX, d.x + 30);
            maxY = Math.max(maxY, d.y + 30);
          });
          const contentWidth = Math.max(maxX - minX, 1);
          const contentHeight = Math.max(maxY - minY, 1);
          const innerPad = 20;
          const availW = canvasWidth - innerPad * 2;
          const availH = canvasHeight - innerPad * 2;
          const scale = Math.min(availW / contentWidth, availH / contentHeight, 1.5);
          const offsetX = canvasMargin + innerPad + (availW - contentWidth * scale) / 2 - minX * scale;
          const offsetY = canvasY + innerPad + (availH - contentHeight * scale) / 2 - minY * scale;

          // === PASS 1: Draw direction cones first (underneath dots) ===
          placedDevices.forEach(device => {
            const isCamera = device.type?.startsWith('cam-');
            if (!isCamera) return;
            const x = offsetX + device.x * scale;
            const y = offsetY + device.y * scale;
            const isDualLens = device.hardwareType === 'dual-lens';
            const baseColor = getDeviceRgb(device);
            const coneRadius = (device.coneSize ?? 40) * scale;

            if (isDualLens) {
              const rot1 = device.stream1?.rotation ?? device.rotation ?? 0;
              const rot2 = device.stream2?.rotation ?? device.rotation ?? 0;
              const size1 = (device.stream1?.coneSize ?? device.coneSize ?? 40) * scale;
              const size2 = (device.stream2?.coneSize ?? device.coneSize ?? 40) * scale;
              const color1 = hexToRgb(device.stream1?.color) || baseColor;
              const color2 = hexToRgb(device.stream2?.color) || baseColor;
              drawCone(pdf, x, y, rot1, size1, color1, 0.18);
              drawCone(pdf, x, y, rot2, size2, color2, 0.18);
            } else {
              const rot = device.rotation ?? 0;
              drawCone(pdf, x, y, rot, coneRadius, baseColor, 0.2);
            }
          });

          // === PASS 2: Draw device dots and labels ===
          placedDevices.forEach(device => {
            const x = offsetX + device.x * scale;
            const y = offsetY + device.y * scale;
            const r = Math.max(7, 11 * scale);
            const deviceColor = getDeviceRgb(device);

            // Outer glow
            pdf.setFillColor(
              Math.round(deviceColor[0] * 0.25),
              Math.round(deviceColor[1] * 0.25),
              Math.round(deviceColor[2] * 0.25)
            );
            pdf.circle(x, y, r + 4, 'F');

            // Main circle
            pdf.setFillColor(...deviceColor);
            pdf.circle(x, y, r, 'F');

            // Border
            pdf.setDrawColor(255, 255, 255);
            pdf.setLineWidth(1.2);
            pdf.circle(x, y, r, 'D');

            // Dot label (type abbreviation inside circle)
            const dotLabel = getDotLabel(device.type);
            if (dotLabel) {
              pdf.setTextColor(255, 255, 255);
              pdf.setFontSize(Math.max(5, 7 * scale));
              pdf.setFont('helvetica', 'bold');
              pdf.text(dotLabel, x, y + (Math.max(5, 7 * scale)) * 0.35, { align: 'center' });
            }

            // Device name label below
            pdf.setTextColor(210, 215, 225);
            pdf.setFontSize(Math.max(5.5, 7.5 * scale));
            pdf.setFont('helvetica', 'normal');
            pdf.text(String(device.name || ''), x, y + r + 10 * scale, { align: 'center' });
          });
        } else {
          // No placed devices message
          pdf.setTextColor(100, 100, 110);
          pdf.setFontSize(13);
          pdf.setFont('helvetica', 'italic');
          pdf.text('No devices placed on this level', canvasMargin + canvasWidth / 2, canvasY + canvasHeight / 2, { align: 'center' });
        }

        // =================== LEGEND ===================
        const legendY = pageHeight - legendHeight - 16;
        pdf.setFillColor(24, 28, 38);
        pdf.setDrawColor(45, 50, 60);
        pdf.setLineWidth(0.75);
        pdf.roundedRect(canvasMargin, legendY, canvasWidth, legendHeight, 6, 6, 'FD');

        // Legend title
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(120, 120, 135);
        pdf.text('LEGEND', canvasMargin + 10, legendY + 12);

        // Draw legend items dynamically based on device types actually on this level
        const legendCols = 4;
        const colWidth = (canvasWidth - 20) / legendCols;
        let colIdx = 0;
        const entries = Array.from(typesOnLevel.entries());
        entries.forEach(([type, count], idx) => {
          const row = Math.floor(idx / legendCols);
          const col = idx % legendCols;
          const itemX = canvasMargin + 12 + col * colWidth;
          const itemY = legendY + 22 + row * legendItemH;
          const color = getColor(type);

          // Colored circle
          pdf.setFillColor(...color);
          pdf.circle(itemX + 4, itemY, 4, 'F');
          pdf.setDrawColor(255, 255, 255);
          pdf.setLineWidth(0.5);
          pdf.circle(itemX + 4, itemY, 4, 'D');

          // Label with count
          pdf.setTextColor(190, 195, 205);
          pdf.setFontSize(7.5);
          pdf.setFont('helvetica', 'normal');
          pdf.text(`${getLabel(type)} (${count})`, itemX + 12, itemY + 3);
        });

        // If no devices, show a generic legend
        if (entries.length === 0) {
          pdf.setTextColor(100, 100, 110);
          pdf.setFontSize(7.5);
          pdf.setFont('helvetica', 'italic');
          pdf.text('No devices on this level', canvasMargin + 60, legendY + 22);
        }

        // Page number footer pill
        pdf.setFillColor(59, 130, 246);
        pdf.roundedRect(pageWidth / 2 - 30, pageHeight - 18, 60, 14, 7, 7, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${levelIndex + 1} / ${levels.length}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
      }

      pdf.save(`${(garage.name || 'Layout').replace(/\s+/g, '_')}_Layout.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('PDF export failed: ' + (err?.message || 'Unknown error'));
    }
  }, [garage]);

  // Guard
  if (!garage || !level) {
    return null;
  }

  const garageName = sanitizeString(garage.name) || 'Property';

  // ========================= RENDER =========================

  return (
    <div className="selector-view">
      <header className="selector-header-modern">
        <div className="brand-section">
          <button
            className="back-btn-modern"
            onClick={goBack}
            title="Back to Levels"
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
            onError={(e) => { if (e.target) e.target.style.display = 'none'; }}
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

      <div className="editor-body" style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden',
        padding: '12px 16px',
        background: theme.bg,
        minHeight: 0
      }}>
        {/* Dashboard Header - Improved Layout */}
        <div className="dashboard-header-modern" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: theme.bgElevated,
          borderRadius: 12,
          border: `1px solid ${theme.border}`,
          marginBottom: 12,
          flexShrink: 0,
          gap: 24
        }}>
          {/* Left: Garage Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: theme.text }}>{garageName}</h1>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ 
                fontSize: 12, 
                color: theme.textMuted, 
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
              title="View on Google Maps"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {fullAddress}
            </a>
          </div>

          {/* Center: Level Navigator */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12,
            padding: '10px 20px',
            background: theme.bgHover,
            borderRadius: 10,
            border: `1px solid ${theme.borderSubtle}`
          }}>
            <button
              onClick={() => handleLevelChange('prev')}
              disabled={!prevLevel}
              title="Previous Level"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${theme.borderSubtle}`,
                background: prevLevel ? theme.bgButton : 'transparent',
                cursor: prevLevel ? 'pointer' : 'not-allowed',
                opacity: prevLevel ? 1 : 0.4,
                color: theme.textSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span style={{ 
              fontWeight: 600, 
              fontSize: 15,
              minWidth: 80, 
              textAlign: 'center',
              color: theme.text
            }}>{level.name}</span>
            <button
              onClick={() => handleLevelChange('next')}
              disabled={!nextLevel}
              title="Next Level"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${theme.borderSubtle}`,
                background: nextLevel ? theme.bgButton : 'transparent',
                cursor: nextLevel ? 'pointer' : 'not-allowed',
                opacity: nextLevel ? 1 : 0.4,
                color: theme.textSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Right: Stats + Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Stats Badges - Clickable Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => setMapFilter(prev => prev.includes('cameras') ? prev.filter(f => f !== 'cameras') : [...prev, 'cameras'])}
                title={mapFilter.includes('cameras') ? 'Remove cameras from filter' : 'Add cameras to filter'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  background: mapFilter.includes('cameras') ? 'rgba(59, 130, 246, 0.2)' : theme.bgButton,
                  border: `1px solid ${mapFilter.includes('cameras') ? '#3b82f6' : theme.borderSubtle}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: mapFilter.includes('cameras') ? '#3b82f6' : theme.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
                </svg>
                <span style={{ fontWeight: 600, color: mapFilter.includes('cameras') ? '#3b82f6' : theme.text }}>{stats.cameras}</span>
                <span>Cameras</span>
              </button>

              <button
                onClick={() => setMapFilter(prev => prev.includes('spaceMonitoring') ? prev.filter(f => f !== 'spaceMonitoring') : [...prev, 'spaceMonitoring'])}
                title={mapFilter.includes('spaceMonitoring') ? 'Remove sensors from filter' : 'Add sensors to filter'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  background: mapFilter.includes('spaceMonitoring') ? 'rgba(245, 158, 11, 0.2)' : theme.bgButton,
                  border: `1px solid ${mapFilter.includes('spaceMonitoring') ? '#f59e0b' : theme.borderSubtle}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: mapFilter.includes('spaceMonitoring') ? '#f59e0b' : theme.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M2 12h20" />
                </svg>
                <span style={{ fontWeight: 600, color: mapFilter.includes('spaceMonitoring') ? '#f59e0b' : theme.text }}>{stats.spaceMonitors}</span>
                <span>Sensors</span>
              </button>

              <button
                onClick={() => setMapFilter(prev => prev.includes('signs') ? prev.filter(f => f !== 'signs') : [...prev, 'signs'])}
                title={mapFilter.includes('signs') ? 'Remove signs from filter' : 'Add signs to filter'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  background: mapFilter.includes('signs') ? 'rgba(34, 197, 94, 0.2)' : theme.bgButton,
                  border: `1px solid ${mapFilter.includes('signs') ? '#22c55e' : theme.borderSubtle}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: mapFilter.includes('signs') ? '#22c55e' : theme.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                <span style={{ fontWeight: 600, color: mapFilter.includes('signs') ? '#22c55e' : theme.text }}>{stats.signs}</span>
                <span>Signs</span>
              </button>

              <button
                onClick={() => setMapFilter(prev => prev.includes('servers') ? prev.filter(f => f !== 'servers') : [...prev, 'servers'])}
                title={mapFilter.includes('servers') ? 'Remove servers from filter' : 'Add servers to filter'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  background: mapFilter.includes('servers') ? 'rgba(168, 85, 247, 0.2)' : theme.bgButton,
                  border: `1px solid ${mapFilter.includes('servers') ? '#a855f7' : theme.borderSubtle}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: mapFilter.includes('servers') ? '#a855f7' : theme.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                </svg>
                <span style={{ fontWeight: 600, color: mapFilter.includes('servers') ? '#a855f7' : theme.text }}>{stats.servers}</span>
                <span>Servers</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Config Export/Import Dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowConfigModal(true)}
                  title="Device Config Files"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    background: '#22c55e',
                    border: 'none',
                    borderRadius: 8,
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="11" x2="12" y2="17" />
                    <polyline points="9 14 12 11 15 14" />
                  </svg>
                  Config Files
                </button>
              </div>

              <button
                onClick={exportLayoutPDF}
                title="Export layout as PDF"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  background: '#3b82f6',
                  border: 'none',
                  borderRadius: 8,
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M12 18v-6" /><path d="M9 15l3 3 3-3" />
                </svg>
                Export PDF
              </button>

              <button
                onClick={() => setShowLevelSettings(true)}
                title="Level Settings"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  background: theme.bgButton,
                  border: `1px solid ${theme.borderSubtle}`,
                  borderRadius: 8,
                  color: theme.textSecondary,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Settings
              </button>
            </div>
          </div>

          {/* Import/Export Message Toast */}
          {importMessage && (
            <div style={{
              position: 'fixed',
              top: 80,
              right: 20,
              padding: '12px 20px',
              background: importMessage.type === 'success' ? '#22c55e' : importMessage.type === 'error' ? '#ef4444' : '#f59e0b',
              color: 'white',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              zIndex: 1000,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {importMessage.type === 'success' ? (
                  <path d="M20 6L9 17l-5-5" />
                ) : importMessage.type === 'error' ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M12 9v4M12 17h.01" />
                )}
              </svg>
              {importMessage.text}
            </div>
          )}
        </div>

            {/* Editor Content */}
            <div className="editor-layout-modern" style={{ 
              display: 'flex', 
              flex: 1, 
              gap: 0, 
              minHeight: 0,
              overflow: 'hidden'
            }}>
                {/* Collapsible Device Palette */}
                <aside className="device-palette-modern" style={{ 
                  width: sidebarCollapsed ? 48 : 380,
                  minWidth: sidebarCollapsed ? 48 : 380,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  background: theme.sidebar,
                  border: `1px solid ${theme.sidebarBorder}`,
                  borderRadius: 0,
                  transition: 'width 0.2s ease, min-width 0.2s ease',
                  position: 'relative'
                }}>
                  {/* Collapse Toggle Button */}
                  <button
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    style={{
                      position: 'absolute',
                      right: -12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 24,
                      height: 48,
                      background: theme.bgButton,
                      border: `1px solid ${theme.borderSubtle}`,
                      borderRadius: '0 6px 6px 0',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10,
                      color: theme.textSecondary
                    }}
                    title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d={sidebarCollapsed ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"} />
                    </svg>
                  </button>

                  {/* Collapsed State - Just Icons */}
                  {sidebarCollapsed ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: 8 }}>
                      <button
                        onClick={() => { setSidebarCollapsed(false); setActiveTab('servers'); }}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          border: activeTab === 'servers' ? '1px solid #3b82f6' : '1px solid transparent',
                          background: activeTab === 'servers' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          color: activeTab === 'servers' ? '#3b82f6' : theme.textMuted,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Servers"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                          <line x1="6" y1="6" x2="6.01" y2="6" />
                          <line x1="6" y1="18" x2="6.01" y2="18" />
                        </svg>
                      </button>
                      <button
                        onClick={() => { setSidebarCollapsed(false); setActiveTab('cameras'); }}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          border: activeTab === 'cameras' ? '1px solid #3b82f6' : '1px solid transparent',
                          background: activeTab === 'cameras' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          color: activeTab === 'cameras' ? '#3b82f6' : theme.textMuted,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Cameras"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" />
                          <rect x="3" y="6" width="12" height="12" rx="2" />
                        </svg>
                      </button>
                      <button
                        onClick={() => { setSidebarCollapsed(false); setActiveTab('signs'); }}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          border: activeTab === 'signs' ? '1px solid #3b82f6' : '1px solid transparent',
                          background: activeTab === 'signs' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          color: activeTab === 'signs' ? '#3b82f6' : theme.textMuted,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Signs"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="4" width="20" height="12" rx="2" />
                          <path d="M6 8h12M6 12h8" />
                          <path d="M12 16v4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => { setSidebarCollapsed(false); setActiveTab('spaceMonitoring'); }}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          border: activeTab === 'spaceMonitoring' ? '1px solid #3b82f6' : '1px solid transparent',
                          background: activeTab === 'spaceMonitoring' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          color: activeTab === 'spaceMonitoring' ? '#3b82f6' : theme.textMuted,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Space Monitoring"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M5.636 18.364a9 9 0 010-12.728" />
                          <path d="M8.464 15.536a5 5 0 010-7.072" />
                          <circle cx="12" cy="12" r="2" fill="currentColor" />
                          <path d="M15.536 8.464a5 5 0 010 7.072" />
                          <path d="M18.364 5.636a9 9 0 010 12.728" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <>
                  <div className="palette-header-modern">
                    <div className="palette-tabs-modern">
                      <button
                        className={`palette-tab-modern ${activeTab === 'servers' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('servers'); setShowAddForm(false); }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                          <line x1="6" y1="6" x2="6.01" y2="6" />
                          <line x1="6" y1="18" x2="6.01" y2="18" />
                        </svg>
                        <span className="tab-label-modern">Servers</span>
                      </button>
                      <button
                        className={`palette-tab-modern ${activeTab === 'cameras' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('cameras'); setShowAddForm(false); }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" />
                          <rect x="3" y="6" width="12" height="12" rx="2" />
                          <circle cx="9" cy="12" r="2" />
                        </svg>
                        <span className="tab-label-modern">Cameras</span>
                      </button>
                      <button
                        className={`palette-tab-modern ${activeTab === 'signs' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('signs'); setShowAddForm(false); }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="4" width="20" height="12" rx="2" />
                          <path d="M6 8h12M6 12h8" />
                          <path d="M12 16v4M8 20h8" />
                        </svg>
                        <span className="tab-label-modern">Signs</span>
                      </button>
                      <button
                        className={`palette-tab-modern ${activeTab === 'spaceMonitoring' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('spaceMonitoring'); setShowAddForm(false); }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M5.636 18.364a9 9 0 010-12.728" />
                          <path d="M8.464 15.536a5 5 0 010-7.072" />
                          <circle cx="12" cy="12" r="2" fill="currentColor" />
                          <path d="M15.536 8.464a5 5 0 010 7.072" />
                          <path d="M18.364 5.636a9 9 0 010 12.728" />
                        </svg>
                        <span className="tab-label-modern">Space Monitoring</span>
                      </button>
                    </div>
                  </div>

                  <div className="palette-content-modern">
                    {!showAddForm ? (
                      <>
                        <div className="palette-title">
                          {activeTab === 'cameras' ? 'Cameras' : activeTab === 'signs' ? 'Signs' : activeTab === 'servers' ? 'Servers' : 'Space Monitoring'} {activeTab === 'servers' ? `for ${garage?.name || 'Site'}` : `on ${level.name}`}
                        </div>

                        {activeTab !== 'servers' && (
                          <button
                            className="btn-sidebar-action primary"
                            style={{ marginBottom: 16 }}
                            onClick={() => setShowAddForm(true)}
                          >
                            + Add {activeTab === 'cameras' ? 'Camera' : activeTab === 'signs' ? 'Sign' : 'Sensor Group'}
                          </button>
                        )}

                        {activeTab === 'servers' && (
                          <button
                            className="btn-sidebar-action primary"
                            style={{ marginBottom: 16 }}
                            onClick={() => {
                              setNewServer({
                                name: '',
                                ram: '',
                                ramCustom: '',
                                ssd: '',
                                ssdCustom: '',
                                os: '',
                                osCustom: '',
                                ethernetPortCount: 2,
                                ethernetPorts: [
                                  { mac: '', ip: '', dhcp: false },
                                  { mac: '', ip: '', dhcp: false }
                                ],
                                loginUsername: '',
                                loginPassword: '',
                                splashtopLink: '',
                              });
                              setShowAddForm(true);
                              setServerFormTab('identity');
                            }}
                          >
                            + Add Server
                          </button>
                        )}

                        <div className="device-list-modern" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {/* Place All Button - show if there are pending devices */}
                          {activeTab === 'cameras' && pendingCameras.length > 0 && (
                            <button
                              onClick={placeAllPendingDevices}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '8px 12px',
                                background: 'rgba(59, 130, 246, 0.15)',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: 6,
                                color: '#3b82f6',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer',
                                marginBottom: 4
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              Place All {pendingCameras.length} Imported Camera{pendingCameras.length > 1 ? 's' : ''} on Canvas
                            </button>
                          )}

                          {activeTab === 'cameras' && cameras.length === 0 && (
                            <div className="sidebar-empty-state">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
                              </svg>
                              <p>No cameras added yet</p>
                            </div>
                          )}

                          {activeTab === 'cameras' && cameras.map(cam => {
                            const isDisabled = cam.status && cam.status.toLowerCase() === 'disabled';
                            return (
                            <div
                              key={cam.id}
                              className="modern-device-item"
                              onClick={() => setSelectedDevice(cam)}
                              style={{
                                background: selectedDevice?.id === cam.id
                                  ? 'rgba(59, 130, 246, 0.2)'
                                  : cam.pendingPlacement ? 'rgba(59, 130, 246, 0.1)' : undefined,
                                border: selectedDevice?.id === cam.id
                                  ? '1px solid rgba(59, 130, 246, 0.6)'
                                  : cam.pendingPlacement ? '1px dashed rgba(59, 130, 246, 0.4)' : undefined,
                                cursor: 'pointer',
                                opacity: isDisabled ? 0.4 : 1,
                              }}>
                              <div className="device-icon-wrapper">{getDeviceIcon(cam.type)}</div>
                              <div className="device-info-modern" style={{ flex: 1 }}>
                                <span className="device-name-modern">{cam.name}</span>
                                <span className="device-type-modern" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  {(cam.ipAddress || cam.stream1?.ipAddress) && <span>{cam.ipAddress || cam.stream1?.ipAddress}:{cam.port || cam.stream1?.port || '554'}</span>}
                                  {!(cam.ipAddress || cam.stream1?.ipAddress) && cam.type}
                                  {isDisabled && (
                                    <span style={{ color: '#ef4444', fontSize: 10, fontWeight: 600 }}>• Disabled</span>
                                  )}
                                  {cam.pendingPlacement && (
                                    <span style={{ color: '#f59e0b', fontSize: 10 }}>• Not placed</span>
                                  )}
                                </span>
                                {(cam.serverId || cam.signId) && (
                                  <span className="device-type-modern" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                    {cam.serverId && (() => {
                                      const srv = garageServers.find(s => s.id === cam.serverId);
                                      return srv ? (
                                        <span style={{ fontSize: 10, color: '#60a5fa', background: 'rgba(59,130,246,0.12)', padding: '1px 6px', borderRadius: 3 }}>
                                          {srv.name}
                                        </span>
                                      ) : null;
                                    })()}
                                    {cam.signId && (() => {
                                      const sgn = allGarageSigns.find(s => s.id === cam.signId);
                                      return sgn ? (
                                        <span style={{ fontSize: 10, color: '#4ade80', background: 'rgba(34,197,94,0.12)', padding: '1px 6px', borderRadius: 3 }}>
                                          {sgn.name}
                                        </span>
                                      ) : null;
                                    })()}
                                  </span>
                                )}
                              </div>
                              {cam.pendingPlacement && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); placeDeviceOnCanvas(cam.id); }}
                                  title="Place on canvas"
                                  style={{
                                    padding: '4px 8px',
                                    background: '#3b82f6',
                                    border: 'none',
                                    borderRadius: 4,
                                    color: 'white',
                                    fontSize: 10,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  Place
                                </button>
                              )}
                            </div>
                          );
                          })}

                          {/* Place All Button - show if there are pending signs */}
                          {activeTab === 'signs' && pendingSigns.length > 0 && (
                            <button
                              onClick={placeAllPendingDevices}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '8px 12px',
                                background: 'rgba(34, 197, 94, 0.15)',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                borderRadius: 6,
                                color: '#22c55e',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer',
                                marginBottom: 4
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              Place All {pendingSigns.length} Imported Sign{pendingSigns.length > 1 ? 's' : ''} on Canvas
                            </button>
                          )}

                          {activeTab === 'signs' && signs.length === 0 && (
                            <div className="sidebar-empty-state">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                              </svg>
                              <p>No signs added yet</p>
                            </div>
                          )}

                          {activeTab === 'signs' && signs.map(sign => (
                            <div
                              key={sign.id}
                              className="modern-device-item"
                              onClick={() => setSelectedDevice(sign)}
                              style={{
                                background: selectedDevice?.id === sign.id
                                  ? 'rgba(34, 197, 94, 0.2)'
                                  : sign.pendingPlacement ? 'rgba(34, 197, 94, 0.1)' : undefined,
                                border: selectedDevice?.id === sign.id
                                  ? '1px solid rgba(34, 197, 94, 0.6)'
                                  : sign.pendingPlacement ? '1px dashed rgba(34, 197, 94, 0.4)' : undefined,
                                cursor: 'pointer'
                              }}>
                              <div className="device-icon-wrapper">{getDeviceIcon(sign.type)}</div>
                              <div className="device-info-modern" style={{ flex: 1 }}>
                                <span className="device-name-modern">{sign.name}</span>
                                <span className="device-type-modern" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {sign.ipAddress && <span>{sign.ipAddress}:{sign.port || '80'}</span>}
                                  {!sign.ipAddress && sign.type}
                                  {sign.pendingPlacement && (
                                    <span style={{ color: '#f59e0b', fontSize: 10 }}>• Not placed</span>
                                  )}
                                </span>
                              </div>
                              {sign.pendingPlacement && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); placeDeviceOnCanvas(sign.id); }}
                                  title="Place on canvas"
                                  style={{
                                    padding: '4px 8px',
                                    background: '#22c55e',
                                    border: 'none',
                                    borderRadius: 4,
                                    color: 'white',
                                    fontSize: 10,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  Place
                                </button>
                              )}
                            </div>
                          ))}

                          {/* Place All Button - show if there are pending space monitors */}
                          {activeTab === 'spaceMonitoring' && pendingSpaceMonitors.length > 0 && (
                            <button
                              onClick={placeAllPendingDevices}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                padding: '8px 12px',
                                background: 'rgba(245, 158, 11, 0.15)',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                borderRadius: 6,
                                color: '#f59e0b',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer',
                                marginBottom: 4
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              Place All {pendingSpaceMonitors.length} Imported Sensor{pendingSpaceMonitors.length > 1 ? 's' : ''} on Canvas
                            </button>
                          )}

                          {activeTab === 'spaceMonitoring' && spaceMonitors.length === 0 && (
                            <div className="sidebar-empty-state">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                <path d="M12 2v20M2 12h20" />
                              </svg>
                              <p>No space monitors added yet</p>
                            </div>
                          )}

                          {activeTab === 'spaceMonitoring' && spaceMonitors.length > 0 && Object.entries(groupedSensors).map(([groupId, sensors]) => (
                            <div key={groupId} style={{ marginBottom: 4 }}>
                              {/* Collapsible Group Header */}
                              <button
                                onClick={() => toggleSensorGroup(groupId)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  width: '100%',
                                  padding: '8px 10px',
                                  background: theme.bgHover,
                                  border: `1px solid ${theme.borderSubtle}`,
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  color: theme.text,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.03em'
                                }}
                              >
                                <svg
                                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                  style={{
                                    transition: 'transform 0.2s ease',
                                    transform: collapsedSensorGroups[groupId] ? 'rotate(-90deg)' : 'rotate(0deg)'
                                  }}
                                >
                                  <path d="M6 9l6 6 6-6" />
                                </svg>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5">
                                  <path d="M5.636 18.364a9 9 0 010-12.728" />
                                  <circle cx="12" cy="12" r="2" fill="#f59e0b" />
                                  <path d="M18.364 5.636a9 9 0 010 12.728" />
                                </svg>
                                <span style={{ flex: 1, textAlign: 'left' }}>
                                  {sensorGroupLabels[groupId] || groupId}
                                </span>
                                <span style={{
                                  background: 'rgba(245, 158, 11, 0.2)',
                                  color: '#f59e0b',
                                  padding: '2px 8px',
                                  borderRadius: 10,
                                  fontSize: 11,
                                  fontWeight: 600
                                }}>
                                  {sensors.length}
                                </span>
                              </button>

                              {/* Collapsible Sensor List */}
                              {!collapsedSensorGroups[groupId] && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6, paddingLeft: 8 }}>
                                  {sensors.map(sensor => (
                                    <div
                                      key={sensor.id}
                                      className="modern-device-item"
                                      onClick={() => setSelectedDevice(sensor)}
                                      style={{
                                        background: selectedDevice?.id === sensor.id
                                          ? 'rgba(245, 158, 11, 0.2)'
                                          : sensor.pendingPlacement ? 'rgba(245, 158, 11, 0.1)' : undefined,
                                        border: selectedDevice?.id === sensor.id
                                          ? '1px solid rgba(245, 158, 11, 0.6)'
                                          : sensor.pendingPlacement ? '1px dashed rgba(245, 158, 11, 0.4)' : undefined,
                                        cursor: 'pointer'
                                      }}>
                                      <div className="device-icon-wrapper">{getDeviceIcon(sensor.type)}</div>
                                      <div className="device-info-modern" style={{ flex: 1 }}>
                                        <span className="device-name-modern">{sensor.name}</span>
                                        <span className="device-type-modern" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          {sensor.sensorId || sensor.serialAddress || 'Space Monitor'}
                                          {sensor.pendingPlacement && (
                                            <span style={{ color: '#f59e0b', fontSize: 10 }}>• Not placed</span>
                                          )}
                                        </span>
                                      </div>
                                      {sensor.pendingPlacement && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); placeDeviceOnCanvas(sensor.id); }}
                                          title="Place on canvas"
                                          style={{
                                            padding: '4px 8px',
                                            background: '#f59e0b',
                                            border: 'none',
                                            borderRadius: 4,
                                            color: 'white',
                                            fontSize: 10,
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap'
                                          }}
                                        >
                                          Place
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Servers Tab Content */}
                          {activeTab === 'servers' && garageServers.length === 0 && (
                            <div className="sidebar-empty-state">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                              </svg>
                              <p>No servers configured</p>
                              <p style={{ fontSize: 11, opacity: 0.7 }}>Click "+ Add Server" to add one</p>
                            </div>
                          )}

                          {activeTab === 'servers' && garageServers.map(server => {
                            const isExpanded = selectedServerId === server.id;
                            return (
                            <div
                              key={server.id}
                              className="modern-device-item"
                              style={{
                                cursor: 'pointer',
                                flexDirection: 'column',
                                alignItems: 'stretch',
                                border: isExpanded ? '1px solid rgba(168, 85, 247, 0.4)' : undefined,
                                background: isExpanded ? 'rgba(168, 85, 247, 0.08)' : undefined,
                              }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => { setSelectedServerId(isExpanded ? null : server.id); setServerFormTab('identity'); }}>
                                <div className="device-icon-wrapper" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                                    <line x1="6" y1="6" x2="6.01" y2="6" />
                                    <line x1="6" y1="18" x2="6.01" y2="18" />
                                  </svg>
                                </div>
                                <div className="device-info-modern" style={{ flex: 1 }}>
                                  <span className="device-name-modern">{server.name}</span>
                                  <span className="device-type-modern">
                                    {server.ipAddress || server.ethernetPorts?.[0]?.ip || 'No IP set'}
                                  </span>
                                </div>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                                  <path d="M6 9l6 6 6-6"/>
                                </svg>
                              </div>

                              {isExpanded && (
                                <div style={{ marginTop: 10, padding: '10px 0 0', borderTop: '1px solid rgba(168, 85, 247, 0.15)', display: 'flex', flexDirection: 'column', gap: 0, fontSize: 12 }}>
                                  {/* Server Editor Tabs */}
                                  <div style={{ display: 'flex', gap: 1, marginBottom: 10 }}>
                                    {[{ id: 'identity', label: 'Identity' }, { id: 'networking', label: 'Network' }, { id: 'splashtop', label: 'Splashtop' }].map(t => (
                                      <button key={t.id} onClick={(e) => { e.stopPropagation(); setServerFormTab(t.id); }} style={{
                                        flex: 1, padding: '6px 4px', fontSize: 10, fontWeight: serverFormTab === t.id ? 600 : 400, cursor: 'pointer',
                                        background: serverFormTab === t.id ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                                        border: serverFormTab === t.id ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid #3f3f46',
                                        borderRadius: 4, color: serverFormTab === t.id ? '#c084fc' : '#71717a', transition: 'all 0.15s'
                                      }}>{t.label}</button>
                                    ))}
                                  </div>

                                  {/* Identity Tab */}
                                  {serverFormTab === 'identity' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                                      <div>
                                        <label style={{ fontSize: 10, color: '#71717a', display: 'block', marginBottom: 2 }}>Server Name</label>
                                        <input type="text" value={server.name || ''} placeholder="Server-01" onChange={(e) => updateServerProp(server.id, { name: e.target.value })} style={{ width: '100%', padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }} />
                                      </div>
                                      <div style={{ display: 'flex', gap: 6 }}>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: 10, color: '#71717a', display: 'block', marginBottom: 2 }}>RAM</label>
                                          <select value={server.ram || ''} onChange={(e) => updateServerProp(server.id, { ram: e.target.value, ramCustom: e.target.value === 'Custom' ? (server.ramCustom || '') : '' })} style={{ width: '100%', padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }}>
                                            <option value="">Select RAM…</option>
                                            <option>8 GB</option>
                                            <option>16 GB</option>
                                            <option>32 GB</option>
                                            <option>64 GB</option>
                                            <option>128 GB</option>
                                            <option>256 GB</option>
                                            <option>Custom</option>
                                          </select>
                                          {server.ram === 'Custom' && (
                                            <input type="text" value={server.ramCustom || ''} placeholder="e.g. 48 GB" onChange={(e) => updateServerProp(server.id, { ramCustom: e.target.value })} style={{ width: '100%', marginTop: 4, padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }} />
                                          )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: 10, color: '#71717a', display: 'block', marginBottom: 2 }}>SSD</label>
                                          <select value={server.ssd || ''} onChange={(e) => updateServerProp(server.id, { ssd: e.target.value, ssdCustom: e.target.value === 'Custom' ? (server.ssdCustom || '') : '' })} style={{ width: '100%', padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }}>
                                            <option value="">Select SSD…</option>
                                            <option>256 GB</option>
                                            <option>512 GB</option>
                                            <option>1 TB</option>
                                            <option>2 TB</option>
                                            <option>4 TB</option>
                                            <option>8 TB</option>
                                            <option>Custom</option>
                                          </select>
                                          {server.ssd === 'Custom' && (
                                            <input type="text" value={server.ssdCustom || ''} placeholder="e.g. 1.5 TB" onChange={(e) => updateServerProp(server.id, { ssdCustom: e.target.value })} style={{ width: '100%', marginTop: 4, padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }} />
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        <label style={{ fontSize: 10, color: '#71717a', display: 'block', marginBottom: 2 }}>Operating System</label>
                                        <select value={server.os || ''} onChange={(e) => updateServerProp(server.id, { os: e.target.value, osCustom: e.target.value === 'Custom' ? (server.osCustom || '') : '' })} style={{ width: '100%', padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }}>
                                          <option value="">Select OS…</option>
                                          <option>Windows Server 2019</option>
                                          <option>Windows Server 2022</option>
                                          <option>Windows Server 2025</option>
                                          <option>Windows 10 IoT</option>
                                          <option>Windows 11 IoT</option>
                                          <option>Ubuntu Server 22.04 LTS</option>
                                          <option>Ubuntu Server 24.04 LTS</option>
                                          <option>RHEL 9</option>
                                          <option>Custom</option>
                                        </select>
                                        {server.os === 'Custom' && (
                                          <input type="text" value={server.osCustom || ''} placeholder="Enter custom OS" onChange={(e) => updateServerProp(server.id, { osCustom: e.target.value })} style={{ width: '100%', marginTop: 4, padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }} />
                                        )}
                                      </div>
                                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                        <span style={{ fontSize: 10, color: '#a855f7', background: 'rgba(168, 85, 247, 0.12)', padding: '2px 8px', borderRadius: 4 }}>
                                          {(() => {
                                            let count = 0;
                                            safeArray(garage?.levels).forEach(lvl => { safeArray(lvl?.devices).forEach(d => { if (d?.serverId === server.id) count++; }); });
                                            return `${count} device${count !== 1 ? 's' : ''} assigned`;
                                          })()}
                                        </span>
                                        {!server.pendingPlacement && server.x != null && (
                                          <span style={{ fontSize: 10, color: '#22c55e', background: 'rgba(34, 197, 94, 0.12)', padding: '2px 8px', borderRadius: 4 }}>On Map</span>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Networking Tab */}
                                  {serverFormTab === 'networking' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                        <label style={{ fontSize: 11, color: '#a1a1aa' }}>Ports:</label>
                                        <select value={server.ethernetPortCount || server.ethernetPorts?.length || 2} onChange={(e) => {
                                          const count = parseInt(e.target.value, 10);
                                          const ports = [...(server.ethernetPorts || [])];
                                          while (ports.length < count) ports.push({ mac: '', ip: '', dhcp: false });
                                          updateServerProp(server.id, { ethernetPortCount: count, ethernetPorts: ports.slice(0, count) });
                                        }} style={{ padding: '4px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #3f3f46', background: '#27272a', color: '#fafafa' }}>
                                          {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                      </div>
                                      {(server.ethernetPorts || []).map((port, idx) => (
                                        <div key={idx} style={{ background: 'rgba(168, 85, 247, 0.06)', borderRadius: 6, padding: '8px 10px', border: '1px solid rgba(168, 85, 247, 0.1)' }}>
                                          <div style={{ fontWeight: 600, fontSize: 11, color: '#c084fc', marginBottom: 6 }}>Port {idx + 1}</div>
                                          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                            <div style={{ flex: 1 }}>
                                              <label style={{ fontSize: 10, color: '#71717a', display: 'block', marginBottom: 2 }}>MAC</label>
                                              <input type="text" value={port.mac || ''} placeholder="00:1A:2B:3C:4D:5E" onChange={(e) => {
                                                const ports = [...(server.ethernetPorts || [])]; ports[idx] = { ...ports[idx], mac: e.target.value };
                                                updateServerProp(server.id, { ethernetPorts: ports });
                                              }} style={{ width: '100%', padding: '5px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 11 }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                              <label style={{ fontSize: 10, color: '#71717a', display: 'block', marginBottom: 2 }}>IP</label>
                                              <input type="text" value={port.ip || ''} placeholder="10.16.6.100" onChange={(e) => {
                                                const ports = [...(server.ethernetPorts || [])]; ports[idx] = { ...ports[idx], ip: e.target.value };
                                                updateServerProp(server.id, { ethernetPorts: ports });
                                              }} style={{ width: '100%', padding: '5px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 11 }} />
                                            </div>
                                          </div>
                                          <div style={{ display: 'flex', gap: 4 }}>
                                            <button onClick={() => { const ports = [...(server.ethernetPorts || [])]; ports[idx] = { ...ports[idx], dhcp: false }; updateServerProp(server.id, { ethernetPorts: ports }); }} style={{ padding: '3px 10px', borderRadius: 4, fontSize: 10, cursor: 'pointer', border: !port.dhcp ? '2px solid #a855f7' : '1px solid #3f3f46', background: !port.dhcp ? 'rgba(168, 85, 247, 0.15)' : 'transparent', color: !port.dhcp ? '#a855f7' : '#a1a1aa' }}>Static</button>
                                            <button onClick={() => { const ports = [...(server.ethernetPorts || [])]; ports[idx] = { ...ports[idx], dhcp: true }; updateServerProp(server.id, { ethernetPorts: ports }); }} style={{ padding: '3px 10px', borderRadius: 4, fontSize: 10, cursor: 'pointer', border: port.dhcp ? '2px solid #a855f7' : '1px solid #3f3f46', background: port.dhcp ? 'rgba(168, 85, 247, 0.15)' : 'transparent', color: port.dhcp ? '#a855f7' : '#a1a1aa' }}>DHCP</button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Splashtop Tab */}
                                  {serverFormTab === 'splashtop' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                                      <div style={{ display: 'flex', gap: 6 }}>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: 10, color: '#71717a', display: 'block', marginBottom: 2 }}>Username</label>
                                          <input type="text" value={server.loginUsername || ''} placeholder="Administrator" onChange={(e) => updateServerProp(server.id, { loginUsername: e.target.value })} style={{ width: '100%', padding: '5px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 11 }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: 10, color: '#71717a', display: 'block', marginBottom: 2 }}>Password</label>
                                          <input type="text" value={server.loginPassword || ''} placeholder="password" onChange={(e) => updateServerProp(server.id, { loginPassword: e.target.value })} style={{ width: '100%', padding: '5px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 11 }} />
                                        </div>
                                      </div>
                                      <div>
                                        <label style={{ fontSize: 10, color: '#71717a', display: 'block', marginBottom: 2 }}>Shortcut URL</label>
                                        <input type="text" value={server.splashtopLink || ''} placeholder="st-business://com.splashtop.business/?shortcut=..." onChange={(e) => updateServerProp(server.id, { splashtopLink: e.target.value })} style={{ width: '100%', padding: '5px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 11 }} />
                                      </div>
                                      {server.splashtopLink && (
                                        <button onClick={(e) => { e.stopPropagation(); window.location.href = server.splashtopLink; }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 4, padding: '8px 12px', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.18), rgba(59, 130, 246, 0.18))', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: 6, color: '#c084fc', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(59, 130, 246, 0.3))'; e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.18), rgba(59, 130, 246, 0.18))'; e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)'; }} title="Launch Splashtop Business desktop app">
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                                          Load Splashtop
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/* Actions */}
                                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                                    {(server.pendingPlacement || server.x == null) && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); placeDeviceOnCanvas(server.id); }}
                                        style={{ flex: 1, padding: '6px 10px', background: '#a855f7', border: 'none', borderRadius: 4, color: 'white', fontSize: 11, cursor: 'pointer' }}
                                      >
                                        Place on Map
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const updatedGarages = garages.map(g => {
                                          if (g.id !== selectedGarageId) return g;
                                          return {
                                            ...g,
                                            servers: safeArray(g.servers).filter(s => s.id !== server.id),
                                            levels: safeArray(g.levels).map(l => ({
                                              ...l,
                                              devices: safeArray(l.devices).filter(d => d.id !== server.id)
                                            }))
                                          };
                                        });
                                        setGarages(updatedGarages);
                                        setSelectedServerId(null);
                                      }}
                                      style={{ padding: '6px 10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 4, color: '#ef4444', fontSize: 11, cursor: 'pointer' }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                          })}
                        </div>
                      </>
                    ) : (
                      /* Add Device Form */
                      <div className="add-device-form-compact">
                        <div className="form-header-compact">
                          <button className="back-link" onClick={() => {
                            if (activeTab === 'cameras' && cameraFormStep > 1) {
                              setCameraFormStep(cameraFormStep - 1);
                            } else {
                              setShowAddForm(false);
                              resetNewDevice();
                            }
                          }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <span className="form-title">
                            {activeTab === 'servers' ? 'Add Server' : (
                              <>Add {activeTab === 'cameras' ? 'Camera' : activeTab === 'spaceMonitoring' ? 'Sensor Group' : 'Sign'}
                              {activeTab === 'cameras' && cameraFormStep === 1 && ' - Hardware Type'}
                              {activeTab === 'cameras' && cameraFormStep === 2 && ' - Camera Type'}
                              {activeTab === 'cameras' && cameraFormStep === 3 && ' - Configuration'}
                              </>
                            )}
                          </span>
                        </div>

                        <div className="form-scroll">
                          {/* === CAMERA FORMS (Multi-step) === */}
                          {activeTab === 'cameras' && cameraFormStep === 1 && (
                            <div className="form-section">
                              <label className="form-label-small">Select Hardware Type</label>
                              <div className="type-selector-compact" style={{ flexDirection: 'column', gap: 8 }}>
                                {deviceTypes.hardwareTypes.map(hw => (
                                  <button
                                    key={hw.id}
                                    className={`type-chip hardware-type-btn ${newDevice.hardwareType === hw.id ? 'selected' : ''}`}
                                    onClick={() => {
                                      setNewDevice({ ...newDevice, hardwareType: hw.id });
                                      setCameraFormStep(2);
                                    }}
                                    style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
                                  >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      {hw.id === 'dual-lens' ? (
                                        <>
                                          <circle cx="8" cy="12" r="4" />
                                          <circle cx="16" cy="12" r="4" />
                                          <rect x="2" y="6" width="20" height="12" rx="2" strokeWidth="1.5" />
                                        </>
                                      ) : (
                                        <>
                                          <circle cx="12" cy="12" r="4" />
                                          <path d="M4 8h16v8H4z" />
                                        </>
                                      )}
                                    </svg>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginLeft: 8 }}>
                                      <span style={{ fontWeight: 600 }}>{hw.name}</span>
                                      <span style={{ fontSize: 11, opacity: 0.7 }}>{hw.streams} stream{hw.streams > 1 ? 's' : ''}</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {activeTab === 'cameras' && cameraFormStep === 2 && (
                            <div className="form-section">
                              <label className="form-label-small">Select Camera Type</label>
                              <div className="type-selector-compact" style={{ flexDirection: 'column', gap: 8 }}>
                                {deviceTypes.cameras.map(type => (
                                  <button
                                    key={type.id}
                                    className={`type-chip ${newDevice.type === type.id ? 'selected' : ''}`}
                                    onClick={() => {
                                      setNewDevice({ ...newDevice, type: type.id, name: newDevice.name || type.name });
                                      setCameraFormStep(3);
                                    }}
                                    style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
                                  >
                                    {getDeviceIcon(type.id)}
                                    <span style={{ marginLeft: 8 }}>{type.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {activeTab === 'cameras' && cameraFormStep === 3 && (
                            <>
                              {/* Stream Tabs for Dual Lens */}
                              {newDevice.hardwareType === 'dual-lens' && (
                                <div className="stream-tabs" style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                                  <button
                                    className={`stream-tab ${activeStreamTab === 1 ? 'active' : ''}`}
                                    onClick={() => setActiveStreamTab(1)}
                                    style={{
                                      flex: 1,
                                      padding: '8px 12px',
                                      border: activeStreamTab === 1 ? '2px solid #3b82f6' : `1px solid ${theme.borderSubtle}`,
                                      background: activeStreamTab === 1 ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                      borderRadius: 6,
                                      cursor: 'pointer',
                                      color: theme.text,
                                      fontWeight: activeStreamTab === 1 ? 600 : 400
                                    }}
                                  >
                                    Stream 1
                                  </button>
                                  <button
                                    className={`stream-tab ${activeStreamTab === 2 ? 'active' : ''}`}
                                    onClick={() => setActiveStreamTab(2)}
                                    style={{
                                      flex: 1,
                                      padding: '8px 12px',
                                      border: activeStreamTab === 2 ? '2px solid #3b82f6' : `1px solid ${theme.borderSubtle}`,
                                      background: activeStreamTab === 2 ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                      borderRadius: 6,
                                      cursor: 'pointer',
                                      color: theme.text,
                                      fontWeight: activeStreamTab === 2 ? 600 : 400
                                    }}
                                  >
                                    Stream 2
                                  </button>
                                </div>
                              )}

                              {/* Stream Configuration */}
                              {(() => {
                                const stream = newDevice.hardwareType === 'dual-lens'
                                  ? (activeStreamTab === 1 ? newDevice.stream1 : newDevice.stream2)
                                  : newDevice.stream1;
                                const updateCurrentStream = (field, value) => {
                                  if (newDevice.hardwareType === 'dual-lens') {
                                    updateStream(activeStreamTab, field, value);
                                  } else {
                                    updateStream(1, field, value);
                                  }
                                };
                                const inputStyle = { 
                                  width: '100%', 
                                  padding: '10px 12px', 
                                  fontSize: 14, 
                                  borderRadius: 6, 
                                  border: `1px solid ${theme.inputBorder}`, 
                                  background: theme.inputBg, 
                                  color: theme.text 
                                };
                                return (
                                  <>
                                    <div className="form-section">
                                      <div className="form-field-stack">
                                        <label className="form-label-small">Camera Name</label>
                                        <input
                                          type="text"
                                          placeholder="Camera Name"
                                          value={newDevice.name}
                                          onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                                          style={inputStyle}
                                        />
                                      </div>
                                      <div className="form-field-stack" style={{ marginTop: 12 }}>
                                        <label className="form-label-small">MAC Address</label>
                                        <input
                                          type="text"
                                          placeholder="00:1A:2B:3C:4D:5E"
                                          value={newDevice.macAddress || ''}
                                          onChange={(e) => setNewDevice({ ...newDevice, macAddress: e.target.value })}
                                          style={inputStyle}
                                        />
                                      </div>
                                      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                                        <div className="form-field-stack" style={{ flex: 2 }}>
                                          <label className="form-label-small">IP Address</label>
                                          <input
                                            type="text"
                                            placeholder="10.16.6.45"
                                            value={stream.ipAddress}
                                            onChange={(e) => updateCurrentStream('ipAddress', e.target.value)}
                                            style={inputStyle}
                                          />
                                        </div>
                                        <div className="form-field-stack" style={{ flex: 1 }}>
                                          <label className="form-label-small">Port</label>
                                          <input
                                            type="text"
                                            placeholder="80"
                                            value={stream.port}
                                            onChange={(e) => updateCurrentStream('port', e.target.value)}
                                            style={inputStyle}
                                          />
                                        </div>
                                      </div>

                                      {/* Stream Type Selector for Dual Lens */}
                                      {newDevice.hardwareType === 'dual-lens' && (
                                        <div style={{ marginTop: 12 }}>
                                          <label className="form-label-small">Stream Type</label>
                                          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                            {[
                                              { value: 'cam-fli', label: 'FLI' },
                                              { value: 'cam-lpr', label: 'LPR' }
                                            ].map(opt => {
                                              const isSelected = (stream.streamType || newDevice.type) === opt.value;
                                              return (
                                                <button
                                                  key={opt.value}
                                                  type="button"
                                                  onClick={() => updateCurrentStream('streamType', opt.value)}
                                                  style={{
                                                    flex: 1,
                                                    padding: '8px 12px',
                                                    border: isSelected ? '2px solid #3b82f6' : `1px solid ${theme.borderSubtle}`,
                                                    background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                                    borderRadius: 6,
                                                    cursor: 'pointer',
                                                    color: isSelected ? '#3b82f6' : theme.textSecondary,
                                                    fontWeight: isSelected ? 600 : 400,
                                                    fontSize: 12
                                                  }}
                                                >
                                                  {opt.label}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    <div className="form-section" style={{ marginTop: 16 }}>
                                      <label className="form-label-small">Traffic Flow</label>
                                      <div className="flow-setup-compact" style={{ marginTop: 8 }}>
                                        <div className="flow-direction-buttons">
                                          <button
                                            className={`flow-btn ${stream.direction === 'in' ? 'active in' : ''}`}
                                            onClick={() => {
                                              updateCurrentStream('direction', 'in');
                                              updateCurrentStream('flowDestination', 'garage-entry');
                                            }}
                                          >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                              <path d="M5 12h14M12 5l7 7-7 7" />
                                            </svg>
                                            INTO {level.name}
                                          </button>
                                          <button
                                            className={`flow-btn ${stream.direction === 'out' ? 'active out' : ''}`}
                                            onClick={() => {
                                              updateCurrentStream('direction', 'out');
                                              updateCurrentStream('flowDestination', 'garage-exit');
                                            }}
                                          >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                              <path d="M19 12H5M12 19l-7-7 7-7" />
                                            </svg>
                                            OUT OF {level.name}
                                          </button>
                                        </div>
                                        <div className="flow-destination-row" style={{ marginTop: 10 }}>
                                          <span className="flow-context">
                                            {stream.direction === 'in' ? 'Coming from:' : 'Going to:'}
                                          </span>
                                          <select
                                            value={stream.flowDestination}
                                            onChange={(e) => updateCurrentStream('flowDestination', e.target.value)}
                                            style={{ flex: 1, padding: '8px 12px', fontSize: 13, borderRadius: 6, border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text }}
                                          >
                                            {getFlowOptions(stream.direction).map(opt => (
                                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="form-section" style={{ marginTop: 16 }}>
                                      <div className="form-field-stack">
                                        <label className="form-label-small">External URL (Optional)</label>
                                        <input
                                          type="text"
                                          placeholder="rtsp://..."
                                          value={stream.externalUrl}
                                          onChange={(e) => updateCurrentStream('externalUrl', e.target.value)}
                                          style={inputStyle}
                                        />
                                      </div>
                                    </div>

                                    {/* Server and Sign Association */}
                                    <div className="form-section" style={{ marginTop: 16 }}>
                                      <label className="form-label-small" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                                          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                                          <line x1="6" y1="6" x2="6.01" y2="6" />
                                          <line x1="6" y1="18" x2="6.01" y2="18" />
                                        </svg>
                                        Server Assignment
                                      </label>
                                      <select
                                        value={newDevice.serverId || ''}
                                        onChange={(e) => setNewDevice({ ...newDevice, serverId: e.target.value ? Number(e.target.value) : '' })}
                                        style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 6, border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text }}
                                      >
                                        <option value="">No server assigned</option>
                                        {garageServers.map(s => (
                                          <option key={s.id} value={s.id}>{s.name} ({s.serverType})</option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="form-section" style={{ marginTop: 12 }}>
                                      <label className="form-label-small" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <rect x="2" y="4" width="20" height="12" rx="2" />
                                          <path d="M6 8h12M6 12h8" />
                                          <path d="M12 16v4" />
                                        </svg>
                                        Sign Assignment
                                      </label>
                                      <select
                                        value={newDevice.signId || ''}
                                        onChange={(e) => setNewDevice({ ...newDevice, signId: e.target.value ? Number(parseFloat(e.target.value)) : '' })}
                                        style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 6, border: `1px solid ${theme.inputBorder}`, background: theme.inputBg, color: theme.text }}
                                      >
                                        <option value="">No sign assigned</option>
                                        {allGarageSigns.map(s => (
                                          <option key={s.id} value={s.id}>{s.name} ({s.levelName})</option>
                                        ))}
                                      </select>
                                    </div>
                                  </>
                                );
                              })()}

                              <div className="form-section" style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                                <button
                                  className="btn-sidebar-action"
                                  onClick={() => { setShowAddForm(false); resetNewDevice(); }}
                                  style={{ flex: 1 }}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn-sidebar-action primary"
                                  onClick={addDevice}
                                  disabled={!newDevice.name.trim()}
                                  style={{ flex: 1 }}
                                >
                                  Add Camera
                                </button>
                              </div>
                            </>
                          )}

                          {/* === SERVER ADD FORM === */}
                          {activeTab === 'servers' && (
                            <>
                              {/* Tab Bar */}
                              <div style={{ display: 'flex', gap: 1, marginBottom: 12 }}>
                                {[{ id: 'identity', label: 'Identity' }, { id: 'networking', label: 'Network' }, { id: 'splashtop', label: 'Splashtop' }].map(t => (
                                  <button key={t.id} onClick={() => setServerFormTab(t.id)} style={{
                                    flex: 1, padding: '8px 4px', fontSize: 11, fontWeight: serverFormTab === t.id ? 600 : 400, cursor: 'pointer',
                                    background: serverFormTab === t.id ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                                    border: serverFormTab === t.id ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid #3f3f46',
                                    borderRadius: 4, color: serverFormTab === t.id ? '#c084fc' : '#71717a', transition: 'all 0.15s'
                                  }}>{t.label}</button>
                                ))}
                              </div>

                              {/* Identity Tab */}
                              {serverFormTab === 'identity' && (
                                <div className="form-section" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  <div className="compact-input-row">
                                    <label>Server Name</label>
                                    <input type="text" placeholder="Server-01" value={newServer.name} onChange={(e) => setNewServer({ ...newServer, name: e.target.value })} />
                                  </div>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 3 }}>RAM</label>
                                      <select value={newServer.ram} onChange={(e) => setNewServer({ ...newServer, ram: e.target.value, ramCustom: e.target.value === 'Custom' ? newServer.ramCustom : '' })} style={{ width: '100%', padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }}>
                                        <option value="">Select RAM…</option>
                                        <option>8 GB</option>
                                        <option>16 GB</option>
                                        <option>32 GB</option>
                                        <option>64 GB</option>
                                        <option>128 GB</option>
                                        <option>256 GB</option>
                                        <option>Custom</option>
                                      </select>
                                      {newServer.ram === 'Custom' && (
                                        <input type="text" placeholder="e.g. 48 GB" value={newServer.ramCustom} onChange={(e) => setNewServer({ ...newServer, ramCustom: e.target.value })} style={{ width: '100%', marginTop: 4, padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }} />
                                      )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 3 }}>SSD</label>
                                      <select value={newServer.ssd} onChange={(e) => setNewServer({ ...newServer, ssd: e.target.value, ssdCustom: e.target.value === 'Custom' ? newServer.ssdCustom : '' })} style={{ width: '100%', padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }}>
                                        <option value="">Select SSD…</option>
                                        <option>256 GB</option>
                                        <option>512 GB</option>
                                        <option>1 TB</option>
                                        <option>2 TB</option>
                                        <option>4 TB</option>
                                        <option>8 TB</option>
                                        <option>Custom</option>
                                      </select>
                                      {newServer.ssd === 'Custom' && (
                                        <input type="text" placeholder="e.g. 1.5 TB" value={newServer.ssdCustom} onChange={(e) => setNewServer({ ...newServer, ssdCustom: e.target.value })} style={{ width: '100%', marginTop: 4, padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }} />
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 3 }}>Operating System</label>
                                    <select value={newServer.os} onChange={(e) => setNewServer({ ...newServer, os: e.target.value, osCustom: e.target.value === 'Custom' ? newServer.osCustom : '' })} style={{ width: '100%', padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }}>
                                      <option value="">Select OS…</option>
                                      <option>Windows Server 2019</option>
                                      <option>Windows Server 2022</option>
                                      <option>Windows Server 2025</option>
                                      <option>Windows 10 IoT</option>
                                      <option>Windows 11 IoT</option>
                                      <option>Ubuntu Server 22.04 LTS</option>
                                      <option>Ubuntu Server 24.04 LTS</option>
                                      <option>RHEL 9</option>
                                      <option>Custom</option>
                                    </select>
                                    {newServer.os === 'Custom' && (
                                      <input type="text" placeholder="Enter custom OS" value={newServer.osCustom} onChange={(e) => setNewServer({ ...newServer, osCustom: e.target.value })} style={{ width: '100%', marginTop: 4, padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }} />
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Networking Tab */}
                              {serverFormTab === 'networking' && (
                                <div className="form-section">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                    <label style={{ fontSize: 12, color: '#a1a1aa' }}>Number of ports:</label>
                                    <select
                                      value={newServer.ethernetPortCount}
                                      onChange={(e) => {
                                        const count = parseInt(e.target.value, 10);
                                        const ports = [...newServer.ethernetPorts];
                                        while (ports.length < count) ports.push({ mac: '', ip: '', dhcp: false });
                                        setNewServer({ ...newServer, ethernetPortCount: count, ethernetPorts: ports.slice(0, count) });
                                      }}
                                      style={{ padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #3f3f46', background: '#27272a', color: '#fafafa' }}
                                    >
                                      {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                  </div>
                                  {newServer.ethernetPorts.map((port, idx) => (
                                    <div key={idx} style={{ background: 'rgba(168, 85, 247, 0.06)', borderRadius: 6, padding: '10px', border: '1px solid rgba(168, 85, 247, 0.15)', marginBottom: 8 }}>
                                      <div style={{ fontWeight: 600, fontSize: 11, color: '#c084fc', marginBottom: 6 }}>Port {idx + 1}</div>
                                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 3 }}>MAC</label>
                                          <input type="text" placeholder="00:1A:2B:3C:4D:5E" value={port.mac} onChange={(e) => {
                                            const ports = [...newServer.ethernetPorts]; ports[idx] = { ...ports[idx], mac: e.target.value };
                                            setNewServer({ ...newServer, ethernetPorts: ports });
                                          }} style={{ width: '100%', padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 3 }}>IP</label>
                                          <input type="text" placeholder="10.16.6.100" value={port.ip} onChange={(e) => {
                                            const ports = [...newServer.ethernetPorts]; ports[idx] = { ...ports[idx], ip: e.target.value };
                                            setNewServer({ ...newServer, ethernetPorts: ports });
                                          }} style={{ width: '100%', padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }} />
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={() => { const ports = [...newServer.ethernetPorts]; ports[idx] = { ...ports[idx], dhcp: false }; setNewServer({ ...newServer, ethernetPorts: ports }); }} style={{ padding: '3px 10px', borderRadius: 4, fontSize: 10, cursor: 'pointer', border: !port.dhcp ? '2px solid #a855f7' : '1px solid #3f3f46', background: !port.dhcp ? 'rgba(168, 85, 247, 0.15)' : 'transparent', color: !port.dhcp ? '#a855f7' : '#a1a1aa' }}>Static</button>
                                        <button onClick={() => { const ports = [...newServer.ethernetPorts]; ports[idx] = { ...ports[idx], dhcp: true }; setNewServer({ ...newServer, ethernetPorts: ports }); }} style={{ padding: '3px 10px', borderRadius: 4, fontSize: 10, cursor: 'pointer', border: port.dhcp ? '2px solid #a855f7' : '1px solid #3f3f46', background: port.dhcp ? 'rgba(168, 85, 247, 0.15)' : 'transparent', color: port.dhcp ? '#a855f7' : '#a1a1aa' }}>DHCP</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Splashtop Tab */}
                              {serverFormTab === 'splashtop' && (
                                <div className="form-section">
                                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 3 }}>Username</label>
                                      <input type="text" placeholder="Administrator" value={newServer.loginUsername} onChange={(e) => setNewServer({ ...newServer, loginUsername: e.target.value })} style={{ width: '100%', padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 3 }}>Password</label>
                                      <input type="text" placeholder="password" value={newServer.loginPassword} onChange={(e) => setNewServer({ ...newServer, loginPassword: e.target.value })} style={{ width: '100%', padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 12 }} />
                                    </div>
                                  </div>
                                  <div>
                                    <label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 3 }}>Shortcut URL</label>
                                    <input type="text" placeholder="st-business://com.splashtop.business/?shortcut=..." value={newServer.splashtopLink} onChange={(e) => setNewServer({ ...newServer, splashtopLink: e.target.value })} style={{ width: '100%', padding: '6px 8px', background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, color: '#fafafa', fontSize: 11 }} />
                                    <span style={{ fontSize: 10, color: '#52525b', marginTop: 3, display: 'block' }}>Paste the st-business:// shortcut URL</span>
                                  </div>
                                </div>
                              )}

                              {/* Buttons - always visible */}
                              <div className="form-section" style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                                <button
                                  className="btn-sidebar-action"
                                  onClick={() => { setShowAddForm(false); }}
                                  style={{ flex: 1 }}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn-sidebar-action primary"
                                  disabled={!newServer.name.trim()}
                                  onClick={() => {
                                    const serverId = Date.now();
                                    const serverEntry = {
                                      id: serverId,
                                      ...newServer,
                                      serverType: 'Ensight',
                                      ipAddress: newServer.ethernetPorts[0]?.ip || '',
                                    };
                                    // Add to garage servers array AND as a device on current level for map placement
                                    const updatedGarages = garages.map(g => {
                                      if (g.id !== selectedGarageId) return g;
                                      return {
                                        ...g,
                                        servers: [...safeArray(g.servers), serverEntry],
                                        levels: safeArray(g.levels).map(l => {
                                          if (l.id !== selectedLevelId) return l;
                                          return {
                                            ...l,
                                            devices: [...safeArray(l.devices), {
                                              id: serverId,
                                              name: newServer.name,
                                              type: 'server',
                                              pendingPlacement: true,
                                              x: undefined,
                                              y: undefined,
                                            }]
                                          };
                                        })
                                      };
                                    });
                                    setGarages(updatedGarages);
                                    setShowAddForm(false);
                                  }}
                                  style={{ flex: 1 }}
                                >
                                  Add Server
                                </button>
                              </div>
                            </>
                          )}

                          {/* === SIGNS & SPACE MONITORING FORMS === */}
                          {(activeTab === 'signs' || activeTab === 'spaceMonitoring') && (
                            <>
                              {activeTab === 'signs' && (
                                <div className="form-section">
                                  <label className="form-label-small">Type</label>
                                  <div className="type-selector-compact">
                                    {deviceTypes.signs.map(type => (
                                      <button
                                        key={type.id}
                                        className={`type-chip ${newDevice.type === type.id ? 'selected' : ''}`}
                                        onClick={() => setNewDevice({ ...newDevice, type: type.id, name: newDevice.name || type.name })}
                                      >
                                        {getDeviceIcon(type.id)}
                                        <span>{type.name.replace(' Sign', '')}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {activeTab === 'spaceMonitoring' && (
                                <div className="form-section">
                                  <label className="form-label-small">Sensor Group</label>
                                  <div className="type-selector-compact" style={{ flexWrap: 'wrap' }}>
                                    {deviceTypes.sensorGroups.map(group => (
                                      <button
                                        key={group.id}
                                        className={`type-chip ${newDevice.sensorGroup === group.id ? 'selected' : ''}`}
                                        onClick={() => setNewDevice({ ...newDevice, sensorGroup: group.id, type: group.id, name: newDevice.name || group.name })}
                                        style={{ minWidth: '45%' }}
                                      >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M5.636 18.364a9 9 0 010-12.728" />
                                          <circle cx="12" cy="12" r="2" fill="currentColor" />
                                          <path d="M18.364 5.636a9 9 0 010 12.728" />
                                        </svg>
                                        <span>{group.name}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="form-section">
                                <div className="compact-input-row">
                                  <label>Name</label>
                                  <input
                                    type="text"
                                    placeholder={activeTab === 'spaceMonitoring' ? 'Sensor Group 1' : 'Lobby Display'}
                                    value={newDevice.name}
                                    onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                                  />
                                </div>

                                {activeTab === 'signs' && (
                                  <div className="compact-input-row">
                                    <label>MAC Address</label>
                                    <input
                                      type="text"
                                      placeholder="00:1A:2B:3C:4D:5E"
                                      value={newDevice.macAddress || ''}
                                      onChange={(e) => setNewDevice({ ...newDevice, macAddress: e.target.value })}
                                    />
                                  </div>
                                )}

                                {activeTab === 'spaceMonitoring' && (
                                  <>
                                    <div className="compact-input-row">
                                      <label>Sensor ID</label>
                                      <input
                                        type="text"
                                        placeholder="SENSOR-001"
                                        value={newDevice.sensorId}
                                        onChange={(e) => setNewDevice({ ...newDevice, sensorId: e.target.value })}
                                      />
                                    </div>
                                    <div className="compact-input-row">
                                      <label>Serial Address</label>
                                      <input
                                        type="text"
                                        placeholder="SN-001234"
                                        value={newDevice.serialAddress}
                                        onChange={(e) => setNewDevice({ ...newDevice, serialAddress: e.target.value })}
                                      />
                                    </div>
                                    {newDevice.sensorGroup === 'sensor-nwave' && (
                                      <>
                                        <div className="compact-input-row">
                                          <label>URL (IP Address)</label>
                                          <input
                                            type="text"
                                            placeholder="https://api.nwave.io/..."
                                            value={newDevice.ipAddress}
                                            onChange={(e) => setNewDevice({ ...newDevice, ipAddress: e.target.value })}
                                          />
                                        </div>
                                        <div className="compact-input-row">
                                          <label>API Key (Controller Key)</label>
                                          <input
                                            type="text"
                                            placeholder="Enter API Key"
                                            value={newDevice.controllerKey}
                                            onChange={(e) => setNewDevice({ ...newDevice, controllerKey: e.target.value })}
                                          />
                                        </div>
                                      </>
                                    )}
                                    <div className="compact-input-row">
                                      <label>Temp Parking Time (Minutes)</label>
                                      <input
                                        type="number"
                                        placeholder="30"
                                        value={newDevice.tempParkingTimeMinutes}
                                        onChange={(e) => setNewDevice({ ...newDevice, tempParkingTimeMinutes: e.target.value })}
                                      />
                                    </div>
                                    <div className="compact-input-row">
                                      <label>Parking Type</label>
                                      <div className="parking-type-buttons" style={{ marginTop: 4 }}>
                                        {deviceTypes.parkingTypes.map(ptype => (
                                          <button
                                            key={ptype.id}
                                            className={`parking-type-btn ${ptype.id === 'ev' ? 'ev' : ptype.id === 'ada' ? 'ada' : ''} ${newDevice.parkingType === ptype.id ? 'active' : ''}`}
                                            onClick={() => setNewDevice({ ...newDevice, parkingType: ptype.id })}
                                          >
                                            {ptype.name}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </>
                                )}

                                {activeTab === 'signs' && (
                                  <>
                                    <div className="compact-input-row-inline">
                                      <div className="inline-field ip-field">
                                        <label>IP</label>
                                        <input
                                          type="text"
                                          placeholder="10.16.6.45"
                                          value={newDevice.ipAddress}
                                          onChange={(e) => setNewDevice({ ...newDevice, ipAddress: e.target.value })}
                                        />
                                      </div>
                                      <div className="inline-field port-field">
                                        <label>Port</label>
                                        <input
                                          type="text"
                                          placeholder="80"
                                          value={newDevice.port}
                                          onChange={(e) => setNewDevice({ ...newDevice, port: e.target.value })}
                                        />
                                      </div>
                                    </div>
                                    <div className="compact-input-row">
                                      <label>External URL (Optional)</label>
                                      <input
                                        type="text"
                                        placeholder="https://..."
                                        value={newDevice.externalUrl || ''}
                                        onChange={(e) => setNewDevice({ ...newDevice, externalUrl: e.target.value })}
                                      />
                                    </div>
                                  </>
                                )}
                              </div>

                              <div className="form-section" style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                                <button
                                  className="btn-sidebar-action"
                                  onClick={() => { setShowAddForm(false); resetNewDevice(); }}
                                  style={{ flex: 1 }}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn-sidebar-action primary"
                                  onClick={addDevice}
                                  disabled={!newDevice.name.trim() || (activeTab === 'spaceMonitoring' && !newDevice.sensorGroup)}
                                  style={{ flex: 1 }}
                                >
                                  Add
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                    </>
                  )}
                </aside>

                {/* Canvas Container */}
                <div className="canvas-container-modern" style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                  minHeight: 0,
                  overflow: 'hidden',
                  background: mode === 'dark' ? '#0a0a0b' : '#f8fafc',
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8
                }}>
<MapCanvas mapFilter={mapFilter} />
                </div>

                {/* Inspector Panel */}
                {selectedDevice && (
                  <aside className="inspector-panel-modern">
                    <InspectorPanel />
                  </aside>
                )}
            </div>
      </div>

      {/* Level Settings Modal */}
      <Modal open={showLevelSettings} onClose={() => setShowLevelSettings(false)}>
        <ModalDialog sx={{
          ...MODAL_SX,
          bgcolor: theme.bgSurface,
          border: `1px solid ${theme.borderSubtle}`
        }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${theme.borderSubtle}`, background: theme.bgHover }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: theme.text }}>Level Settings</h3>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ ...LABEL_STYLE, color: theme.textSecondary }}>Level Name</label>
              <Input
                size="sm"
                value={level.name || ''}
                onChange={(e) => {
                  const updatedGarages = garages.map(g => {
                    if (g.id === selectedGarageId) {
                      return {
                        ...g,
                        levels: safeArray(g.levels).map(l =>
                          l.id === selectedLevelId ? { ...l, name: e.target.value } : l
                        )
                      };
                    }
                    return g;
                  });
                  setGarages(updatedGarages);
                }}
                sx={INPUT_SX}
              />
            </div>

            <div>
              <label style={LABEL_STYLE}>Background Image</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="level-bg-upload"
                  onChange={(e) => {
                    const file = e.target?.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const updatedGarages = garages.map(g => {
                        if (g.id === selectedGarageId) {
                          return {
                            ...g,
                            levels: safeArray(g.levels).map(l =>
                              l.id === selectedLevelId ? { ...l, bgImage: event.target.result } : l
                            )
                          };
                        }
                        return g;
                      });
                      setGarages(updatedGarages);
                    };
                    reader.readAsDataURL(file);
                    // Reset input so the same file can be re-uploaded after deletion
                    e.target.value = '';
                  }}
                />
                <label
                  htmlFor="level-bg-upload"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: `1px solid ${theme.borderSubtle}`,
                    background: theme.bgButton,
                    color: theme.text,
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  {level.bgImage ? 'Change Image' : 'Upload Image'}
                </label>
                {level.bgImage && (
                  <Button
                    size="sm"
                    variant="soft"
                    color="danger"
                    onClick={() => {
                      const updatedGarages = garages.map(g => {
                        if (g.id === selectedGarageId) {
                          return {
                            ...g,
                            levels: safeArray(g.levels).map(l =>
                              l.id === selectedLevelId ? { ...l, bgImage: null } : l
                            )
                          };
                        }
                        return g;
                      });
                      setGarages(updatedGarages);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid #3f3f46', background: '#27272a' }}>
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              onClick={() => setShowLevelSettings(false)}
              sx={{ color: '#fafafa', borderColor: '#3f3f46', '&:hover': { bgcolor: '#3f3f46' } }}
            >
              Close
            </Button>
          </div>
        </ModalDialog>
      </Modal>

      {/* Config Files Modal */}
      <Modal open={showConfigModal} onClose={() => setShowConfigModal(false)}>
        <ModalDialog sx={{
          ...MODAL_SX,
          maxWidth: 560,
          bgcolor: theme.bgSurface,
          border: `1px solid ${theme.borderSubtle}`
        }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${theme.borderSubtle}`, background: theme.bgHover }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: theme.text }}>Device Configuration Files</h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: theme.textMuted }}>
              Export configs to update local Ensight files, or import from existing configs
            </p>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Export Section */}
            <div>
              <label style={{ ...LABEL_STYLE, color: theme.textSecondary, marginBottom: 12 }}>Export Configs</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => {
                    handleExportConfigs();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    background: theme.bgButton,
                    border: `1px solid ${theme.borderSubtle}`,
                    borderRadius: 8,
                    color: theme.text,
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <div>
                    <div style={{ fontWeight: 500 }}>Export Current Level Configs</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                      Downloads camerahub-config.xml, DevicesConfig.xml, and FLI configs for {level?.name}
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleExportAllGarageConfigs();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    background: theme.bgButton,
                    border: `1px solid ${theme.borderSubtle}`,
                    borderRadius: 8,
                    color: theme.text,
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <div>
                    <div style={{ fontWeight: 500 }}>Export All Garage Configs</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>
                      Downloads configs for all devices across all levels in {garage?.name}
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: `1px solid ${theme.borderSubtle}` }} />

            {/* Import Section */}
            <div>
              <label style={{ ...LABEL_STYLE, color: theme.textSecondary, marginBottom: 12 }}>Import Devices from Config</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    background: configImportType === 'devicesConfig' ? 'rgba(59, 130, 246, 0.15)' : theme.bgButton,
                    border: configImportType === 'devicesConfig' ? '2px solid #3b82f6' : `1px solid ${theme.borderSubtle}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: theme.text,
                    fontSize: 13
                  }}>
                    <input
                      type="radio"
                      name="configType"
                      checked={configImportType === 'devicesConfig'}
                      onChange={() => setConfigImportType('devicesConfig')}
                      style={{ display: 'none' }}
                    />
                    DevicesConfig.xml
                  </label>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 12px',
                    background: configImportType === 'cameraHub' ? 'rgba(59, 130, 246, 0.15)' : theme.bgButton,
                    border: configImportType === 'cameraHub' ? '2px solid #3b82f6' : `1px solid ${theme.borderSubtle}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: theme.text,
                    fontSize: 13
                  }}>
                    <input
                      type="radio"
                      name="configType"
                      checked={configImportType === 'cameraHub'}
                      onChange={() => setConfigImportType('cameraHub')}
                      style={{ display: 'none' }}
                    />
                    camerahub-config.xml
                  </label>
                </div>

                <input
                  ref={configFileInputRef}
                  type="file"
                  accept=".xml"
                  style={{ display: 'none' }}
                  onChange={handleConfigFileImport}
                />

                <button
                  onClick={() => configFileInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '12px 16px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: `2px dashed ${theme.borderSubtle}`,
                    borderRadius: 8,
                    color: theme.text,
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Click to select {configImportType === 'devicesConfig' ? 'DevicesConfig.xml' : 'camerahub-config.xml'}
                </button>

                <p style={{ fontSize: 11, color: theme.textMuted, margin: '4px 0 0' }}>
                  Devices will be imported to {level?.name}. Duplicate names will be added as new devices.
                </p>
              </div>
            </div>

            {/* Config File Paths Info */}
            <div style={{
              padding: '12px 16px',
              background: theme.bgHover,
              borderRadius: 8,
              border: `1px solid ${theme.borderSubtle}`
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>
                Local Config File Paths
              </div>
              <div style={{ fontSize: 11, color: theme.textMuted, fontFamily: 'monospace', lineHeight: 1.6 }}>
                <div><strong>Cameras:</strong></div>
                <div style={{ paddingLeft: 12 }}>C:\Ensight\CameraHub\camerahub-config.xml</div>
                <div style={{ paddingLeft: 12 }}>C:\Ensight\EPIC\Config\DevicesConfig.xml</div>
                <div style={{ paddingLeft: 12 }}>C:\Ensight\FLI\Config\[CameraName].xml</div>
                <div style={{ marginTop: 8 }}><strong>Signs & Sensors:</strong></div>
                <div style={{ paddingLeft: 12 }}>C:\Ensight\EPIC\Config\DevicesConfig.xml</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 20px', borderTop: `1px solid ${theme.borderSubtle}`, background: theme.bgHover }}>
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              onClick={() => setShowConfigModal(false)}
              sx={{ color: theme.text, borderColor: theme.borderSubtle, '&:hover': { bgcolor: theme.bgButton } }}
            >
              Close
            </Button>
          </div>
        </ModalDialog>
      </Modal>
    </div>
  );
};

export default EditorView;
