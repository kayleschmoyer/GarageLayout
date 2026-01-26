import React, { useContext, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Modal, ModalDialog, Button, Input } from '@mui/joy';
import { AppContext } from '../App';
import {
  generateCameraHubConfig,
  generateDevicesConfig,
  generateFLICameraConfig,
  parseCameraHubConfig,
  parseDevicesConfig,
  downloadFile,
  readFileAsText
} from '../services/ConfigService';

// ========================= CONSTANTS =========================

const STORAGE_KEY = 'garagelayout-site-config';

const DeviceIcon = ({ type }) => {
  if (type?.startsWith('cam-')) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 7l-7 5 7 5V7z"/>
        <rect x="1" y="5" width="15" height="14" rx="2"/>
      </svg>
    );
  }
  if (type?.startsWith('sign-')) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M9 9h6M9 15h6"/>
      </svg>
    );
  }
  if (type?.startsWith('sensor-')) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
      </svg>
    );
  }
  return null;
};

const getDeviceTypeLabel = (type) => {
  const labels = {
    'cam-fli': 'FLI Camera',
    'cam-lpr': 'LPR Camera',
    'cam-people': 'People Counting',
    'sign-led': 'LED Sign',
    'sign-static': 'Static Sign',
    'sign-designable': 'Designable Sign',
    'sensor-space': 'Space Sensor'
  };
  return labels[type] || type;
};

// ========================= MAIN COMPONENT =========================

const SitePage = () => {
  const context = useContext(AppContext);
  const mode = context?.mode === 'light' ? 'light' : 'dark';
  const garages = Array.isArray(context?.garages) ? context.garages : [];
  const setGarages = typeof context?.setGarages === 'function' ? context.setGarages : () => {};
  const setCurrentView = typeof context?.setCurrentView === 'function' ? context.setCurrentView : () => {};
  const selectGarage = typeof context?.selectGarage === 'function' ? context.selectGarage : () => {};

  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState('devicesConfig');
  const [importMessage, setImportMessage] = useState(null);
  const [configPreviewTab, setConfigPreviewTab] = useState('devices');
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const fileInputRef = useRef(null);

  // Theme colors
  const theme = useMemo(() => ({
    bg: mode === 'dark' ? '#09090b' : '#f4f4f5',
    bgSurface: mode === 'dark' ? '#18181b' : '#ffffff',
    bgCard: mode === 'dark' ? '#1f1f23' : '#fafafa',
    bgCode: mode === 'dark' ? '#0d0d0e' : '#f0f0f2',
    border: mode === 'dark' ? '#27272a' : '#e4e4e7',
    borderSubtle: mode === 'dark' ? '#3f3f46' : '#d4d4d8',
    text: mode === 'dark' ? '#fafafa' : '#18181b',
    textSecondary: mode === 'dark' ? '#a1a1aa' : '#52525b',
    textMuted: mode === 'dark' ? '#71717a' : '#71717a',
    accent: '#3b82f6',
    accentHover: '#2563eb',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444'
  }), [mode]);

  // Collect all devices from all garages and levels
  const allDevices = useMemo(() => {
    const devices = [];
    garages.forEach(garage => {
      if (garage?.levels) {
        garage.levels.forEach(level => {
          if (level?.devices) {
            level.devices.forEach(device => {
              devices.push({
                ...device,
                garageName: garage.name,
                garageId: garage.id,
                levelName: level.name,
                levelId: level.id
              });
            });
          }
        });
      }
    });
    return devices;
  }, [garages]);

  // Categorized devices
  const cameras = useMemo(() => allDevices.filter(d => d.type?.startsWith('cam-')), [allDevices]);
  const signs = useMemo(() => allDevices.filter(d => d.type?.startsWith('sign-')), [allDevices]);
  const sensors = useMemo(() => allDevices.filter(d => d.type?.startsWith('sensor-')), [allDevices]);

  // Real-time config generation
  const devicesConfigXml = useMemo(() => {
    if (allDevices.length === 0) return '<!-- No devices configured -->';
    return generateDevicesConfig(allDevices);
  }, [allDevices]);

  const cameraHubConfigXml = useMemo(() => {
    if (cameras.length === 0) return '<!-- No cameras configured -->';
    return generateCameraHubConfig(cameras);
  }, [cameras]);

  // Update timestamp when devices change
  useEffect(() => {
    setLastUpdate(Date.now());
  }, [allDevices]);

  // Save config to localStorage
  useEffect(() => {
    if (garages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          garages,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to save config to localStorage:', e);
      }
    }
  }, [garages]);

  // Load config from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.garages && Array.isArray(data.garages)) {
          // Only load if current garages have no custom devices
          const currentHasDevices = garages.some(g =>
            g.levels?.some(l => l.devices?.length > 0)
          );
          if (!currentHasDevices && data.garages.some(g =>
            g.levels?.some(l => l.devices?.length > 0)
          )) {
            setGarages(data.garages);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load config from localStorage:', e);
    }
  }, []); // Only run on mount

  // Handle file import
  const handleFileImport = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      let importedDevices = [];

      if (importType === 'devicesConfig') {
        importedDevices = parseDevicesConfig(content);
      } else if (importType === 'cameraHub') {
        importedDevices = parseCameraHubConfig(content);
      }

      if (importedDevices.length === 0) {
        setImportMessage({ type: 'error', text: 'No devices found in the config file.' });
        return;
      }

      // Add devices to the first garage's first level
      if (garages.length > 0 && garages[0].levels?.length > 0) {
        const updatedGarages = [...garages];
        const existingDevices = updatedGarages[0].levels[0].devices || [];
        updatedGarages[0].levels[0].devices = [...existingDevices, ...importedDevices];
        setGarages(updatedGarages);
        setImportMessage({
          type: 'success',
          text: `Imported ${importedDevices.length} device(s) to ${garages[0].name} - ${garages[0].levels[0].name}`
        });
      }

      setShowImportModal(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Error importing config:', error);
      setImportMessage({ type: 'error', text: 'Failed to parse config file.' });
    }
  }, [importType, garages, setGarages]);

  // Download handlers
  const handleDownloadDevicesConfig = useCallback(() => {
    if (allDevices.length === 0) {
      setImportMessage({ type: 'warning', text: 'No devices to export.' });
      return;
    }
    downloadFile(devicesConfigXml, 'DevicesConfig.xml');
    setImportMessage({ type: 'success', text: 'Downloaded DevicesConfig.xml' });
  }, [allDevices, devicesConfigXml]);

  const handleDownloadCameraHubConfig = useCallback(() => {
    if (cameras.length === 0) {
      setImportMessage({ type: 'warning', text: 'No cameras to export.' });
      return;
    }
    downloadFile(cameraHubConfigXml, 'camerahub-config.xml');
    setImportMessage({ type: 'success', text: 'Downloaded camerahub-config.xml' });
  }, [cameras, cameraHubConfigXml]);

  const handleDownloadAllConfigs = useCallback(() => {
    if (allDevices.length === 0) {
      setImportMessage({ type: 'warning', text: 'No devices to export.' });
      return;
    }

    // Download DevicesConfig
    downloadFile(devicesConfigXml, 'DevicesConfig.xml');

    // Download CameraHub config if cameras exist
    if (cameras.length > 0) {
      downloadFile(cameraHubConfigXml, 'camerahub-config.xml');
    }

    // Download individual FLI configs
    const fliCameras = cameras.filter(c => c.type === 'cam-fli');
    fliCameras.forEach(camera => {
      const fliConfig = generateFLICameraConfig(camera);
      downloadFile(fliConfig, `${camera.name}.xml`);
    });

    setImportMessage({
      type: 'success',
      text: `Downloaded ${cameras.length > 0 ? 'DevicesConfig.xml, camerahub-config.xml' : 'DevicesConfig.xml'}${fliCameras.length > 0 ? ` + ${fliCameras.length} FLI config(s)` : ''}`
    });
  }, [allDevices, cameras, devicesConfigXml, cameraHubConfigXml]);

  // Format timestamp
  const formatTime = (ts) => {
    const date = new Date(ts);
    return date.toLocaleTimeString();
  };

  // Clear message after 3 seconds
  useEffect(() => {
    if (importMessage) {
      const timer = setTimeout(() => setImportMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [importMessage]);

  return (
    <div style={{
      minHeight: '100vh',
      background: theme.bg,
      padding: '24px',
      color: theme.text
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Site Configuration</h1>
          <p style={{ margin: '4px 0 0', color: theme.textSecondary, fontSize: 14 }}>
            Real-time device configuration overview
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button
            variant="outlined"
            onClick={() => setShowImportModal(true)}
            sx={{
              borderColor: theme.borderSubtle,
              color: theme.text,
              '&:hover': { borderColor: theme.accent, bgcolor: 'transparent' }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
            </svg>
            Import Config
          </Button>
          <Button
            onClick={handleDownloadAllConfigs}
            sx={{
              bgcolor: theme.accent,
              '&:hover': { bgcolor: theme.accentHover }
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Download All Configs
          </Button>
        </div>
      </div>

      {/* Toast Message */}
      {importMessage && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          padding: '12px 20px',
          borderRadius: 8,
          background: importMessage.type === 'success' ? theme.success :
                      importMessage.type === 'warning' ? theme.warning : theme.danger,
          color: '#fff',
          fontWeight: 500,
          fontSize: 14,
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {importMessage.text}
        </div>
      )}

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24
      }}>
        {[
          { label: 'Total Devices', value: allDevices.length, color: theme.accent },
          { label: 'Cameras', value: cameras.length, color: '#8b5cf6' },
          { label: 'Signs', value: signs.length, color: '#f59e0b' },
          { label: 'Sensors', value: sensors.length, color: '#22c55e' }
        ].map((stat, i) => (
          <div key={i} style={{
            background: theme.bgSurface,
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            padding: 20
          }}>
            <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4 }}>{stat.label}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24
      }}>
        {/* Device List */}
        <div style={{
          background: theme.bgSurface,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>All Devices</h2>
            <span style={{ fontSize: 12, color: theme.textMuted }}>
              Updated: {formatTime(lastUpdate)}
            </span>
          </div>
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {allDevices.length === 0 ? (
              <div style={{
                padding: 40,
                textAlign: 'center',
                color: theme.textMuted
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.5 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M12 8v4M12 16h.01"/>
                </svg>
                <div>No devices configured yet</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Import a config or add devices in the editor</div>
              </div>
            ) : (
              allDevices.map((device, idx) => (
                <div
                  key={device.id || idx}
                  style={{
                    padding: '12px 20px',
                    borderBottom: idx < allDevices.length - 1 ? `1px solid ${theme.border}` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = theme.bgCard}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  onClick={() => {
                    if (device.garageId) {
                      selectGarage(device.garageId);
                    }
                  }}
                >
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: device.type?.startsWith('cam-') ? 'rgba(139, 92, 246, 0.15)' :
                               device.type?.startsWith('sign-') ? 'rgba(245, 158, 11, 0.15)' :
                               'rgba(34, 197, 94, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: device.type?.startsWith('cam-') ? '#8b5cf6' :
                           device.type?.startsWith('sign-') ? '#f59e0b' : '#22c55e'
                  }}>
                    <DeviceIcon type={device.type} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{device.name || 'Unnamed Device'}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted }}>
                      {device.garageName} / {device.levelName} - {getDeviceTypeLabel(device.type)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>
                    {device.stream1?.ipAddress || device.ipAddress || 'No IP'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Config Preview */}
        <div style={{
          background: theme.bgSurface,
          border: `1px solid ${theme.border}`,
          borderRadius: 12,
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '12px 20px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            gap: 0
          }}>
            {['devices', 'camerahub'].map(tab => (
              <button
                key={tab}
                onClick={() => setConfigPreviewTab(tab)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: configPreviewTab === tab ? theme.accent : 'transparent',
                  color: configPreviewTab === tab ? '#fff' : theme.textSecondary,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  transition: 'all 0.15s'
                }}
              >
                {tab === 'devices' ? 'DevicesConfig.xml' : 'camerahub-config.xml'}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button
              onClick={configPreviewTab === 'devices' ? handleDownloadDevicesConfig : handleDownloadCameraHubConfig}
              style={{
                padding: '6px 12px',
                border: `1px solid ${theme.borderSubtle}`,
                background: 'transparent',
                color: theme.text,
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Download
            </button>
          </div>
          <div style={{
            padding: 0,
            maxHeight: 500,
            overflowY: 'auto'
          }}>
            <pre style={{
              margin: 0,
              padding: 16,
              fontSize: 12,
              fontFamily: 'Monaco, Consolas, monospace',
              background: theme.bgCode,
              color: theme.textSecondary,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              lineHeight: 1.6
            }}>
              {configPreviewTab === 'devices' ? devicesConfigXml : cameraHubConfigXml}
            </pre>
          </div>
          <div style={{
            padding: '8px 16px',
            borderTop: `1px solid ${theme.border}`,
            fontSize: 11,
            color: theme.textMuted,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: theme.success,
              animation: 'pulse 2s infinite'
            }} />
            Live preview - updates automatically when devices change
          </div>
        </div>
      </div>

      {/* Garage Summary */}
      <div style={{
        marginTop: 24,
        background: theme.bgSurface,
        border: `1px solid ${theme.border}`,
        borderRadius: 12,
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${theme.border}`
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Garages Overview</h2>
        </div>
        <div style={{ padding: 20 }}>
          {garages.length === 0 ? (
            <div style={{ color: theme.textMuted, textAlign: 'center', padding: 20 }}>
              No garages configured
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              {garages.map(garage => {
                const garageDevices = allDevices.filter(d => d.garageId === garage.id);
                const garageCameras = garageDevices.filter(d => d.type?.startsWith('cam-'));
                const garageSigns = garageDevices.filter(d => d.type?.startsWith('sign-'));
                const garageSensors = garageDevices.filter(d => d.type?.startsWith('sensor-'));

                return (
                  <div
                    key={garage.id}
                    style={{
                      background: theme.bgCard,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 10,
                      padding: 16,
                      cursor: 'pointer',
                      transition: 'border-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = theme.accent}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = theme.border}
                    onClick={() => selectGarage(garage.id)}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{garage.name}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 12 }}>
                      {garage.address}, {garage.city}, {garage.state} {garage.zip}
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                      <span style={{ color: '#8b5cf6' }}>{garageCameras.length} cameras</span>
                      <span style={{ color: '#f59e0b' }}>{garageSigns.length} signs</span>
                      <span style={{ color: '#22c55e' }}>{garageSensors.length} sensors</span>
                    </div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 8 }}>
                      {garage.levels?.length || 0} level(s)
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Back button */}
      <div style={{ marginTop: 24 }}>
        <Button
          variant="outlined"
          onClick={() => setCurrentView('garages')}
          sx={{
            borderColor: theme.borderSubtle,
            color: theme.text,
            '&:hover': { borderColor: theme.accent, bgcolor: 'transparent' }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Garages
        </Button>
      </div>

      {/* Import Modal */}
      <Modal open={showImportModal} onClose={() => setShowImportModal(false)}>
        <ModalDialog sx={{
          borderRadius: '12px',
          p: 0,
          width: '100%',
          maxWidth: 420,
          bgcolor: theme.bgSurface,
          border: `1px solid ${theme.border}`,
          overflow: 'hidden'
        }}>
          <div style={{ padding: 20, borderBottom: `1px solid ${theme.border}` }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: theme.text }}>
              Import Configuration
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: theme.textSecondary }}>
              Load devices from an existing config file
            </p>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 8,
                color: theme.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Config Type
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'devicesConfig', label: 'DevicesConfig.xml' },
                  { id: 'cameraHub', label: 'camerahub-config.xml' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setImportType(opt.id)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      border: importType === opt.id ? '2px solid #3b82f6' : `1px solid ${theme.borderSubtle}`,
                      background: importType === opt.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      borderRadius: 8,
                      color: theme.text,
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              onChange={handleFileImport}
              style={{ display: 'none' }}
            />
            <Button
              fullWidth
              onClick={() => fileInputRef.current?.click()}
              sx={{
                bgcolor: theme.accent,
                '&:hover': { bgcolor: theme.accentHover }
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
              Select File
            </Button>
          </div>
          <div style={{
            padding: '12px 20px',
            background: theme.bgCard,
            borderTop: `1px solid ${theme.border}`
          }}>
            <Button
              variant="plain"
              fullWidth
              onClick={() => setShowImportModal(false)}
              sx={{ color: theme.textSecondary }}
            >
              Cancel
            </Button>
          </div>
        </ModalDialog>
      </Modal>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default SitePage;
