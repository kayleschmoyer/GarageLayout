import React, { useContext, useEffect, useState, useRef } from 'react';
import { AppContext } from '../App';
import {
  generateCameraHubConfig,
  generateDevicesConfig,
  generateFLICameraConfig,
  downloadFile,
  getConfigFilePaths
} from '../services/ConfigService';

const InspectorPanel = () => {
  const {
    garages,
    setGarages,
    selectedGarageId,
    selectedLevelId,
    selectedDevice,
    setSelectedDevice
  } = useContext(AppContext);

  const [showImageModal, setShowImageModal] = useState(false);
  const [showPreviewFullscreen, setShowPreviewFullscreen] = useState(false);
  const [overrideMessage, setOverrideMessage] = useState(null);
  const [activeStreamTab, setActiveStreamTab] = useState(1);
  const fileInputRef = useRef(null);

  const garage = garages.find(g => g.id === selectedGarageId);
  const currentLevel = garage?.levels.find(l => l.id === selectedLevelId);
  const device = currentLevel?.devices?.find(d => d.id === selectedDevice?.id);
  const allLevels = garage?.levels || [];

  useEffect(() => {
    if (selectedDevice && currentLevel && !device) {
      setSelectedDevice(null);
    }
  }, [selectedDevice, currentLevel, device, setSelectedDevice]);

  // Clear override message after 3 seconds
  useEffect(() => {
    if (overrideMessage) {
      const timer = setTimeout(() => setOverrideMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [overrideMessage]);

  const updateDevice = (deviceId, updates) => {
    const updatedGarages = garages.map(g => {
      if (g.id === selectedGarageId) {
        return {
          ...g,
          levels: g.levels.map(l => {
            if (l.id === selectedLevelId) {
              return {
                ...l,
                devices: l.devices.map(d => 
                  d.id === deviceId ? { ...d, ...updates } : d
                )
              };
            }
            return l;
          })
        };
      }
      return g;
    });
    setGarages(updatedGarages);
  };

  // Remove device from map only (keeps it in the device list as pending placement)
  const removeFromMap = (deviceId) => {
    updateDevice(deviceId, { pendingPlacement: true, x: undefined, y: undefined });
    setSelectedDevice(null);
  };

  // Permanently delete device from the level
  const deleteDevice = (deviceId) => {
    const updatedGarages = garages.map(g => {
      if (g.id === selectedGarageId) {
        return {
          ...g,
          levels: g.levels.map(l => {
            if (l.id === selectedLevelId) {
              return {
                ...l,
                devices: l.devices.filter(d => d.id !== deviceId)
              };
            }
            return l;
          })
        };
      }
      return g;
    });
    setGarages(updatedGarages);
    setSelectedDevice(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        // Handle both camera view images and sensor location images
        if (device.type.startsWith('sensor-')) {
          updateDevice(device.id, { sensorImage: event.target.result });
        } else {
          updateDevice(device.id, { viewImage: event.target.result });
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = ''; // Reset input
  };

  const sendOverrideCommand = (state) => {
    updateDevice(device.id, { overrideState: state });
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    setOverrideMessage({
      state: state.toUpperCase(),
      time: timeStr
    });
  };

  const [configExportMessage, setConfigExportMessage] = useState(null);

  // Export device config files
  const exportDeviceConfigFiles = () => {
    if (!device) return;

    const isCamera = device.type?.startsWith('cam-');
    const isFLI = device.type === 'cam-fli';

    // Generate and download DevicesConfig entry
    const devicesXml = generateDevicesConfig([device]);
    downloadFile(devicesXml, `${device.name}-device-entry.xml`);

    if (isCamera) {
      // Generate and download CameraHub entry
      const cameraHubXml = generateCameraHubConfig([device]);
      downloadFile(cameraHubXml, `${device.name}-camerahub-entry.xml`);

      // Generate FLI config if applicable
      if (isFLI) {
        const fliXml = generateFLICameraConfig(device);
        downloadFile(fliXml, `${device.name}.xml`);
      }
    }

    setConfigExportMessage(`Exported config for ${device.name}`);
    setTimeout(() => setConfigExportMessage(null), 3000);
  };

  if (!currentLevel || !selectedDevice || !device) {
    return null;
  }

  const isCamera = device.type.startsWith('cam-');
  const isSensor = device.type.startsWith('sensor-');
  const isSign = device.type.startsWith('sign-');
  const isDesignableSign = device.type === 'sign-designable';
  const isStaticSign = device.type === 'sign-static';
  const isSpaceMonitor = device.type.startsWith('sensor-');
  const isNwave = device.type === 'sensor-nwave' || device.sensorGroup === 'sensor-nwave';

  // Sensor group labels
  const sensorGroupLabels = {
    'sensor-nwave': 'NWAVE',
    'sensor-parksol': 'Parksol',
    'sensor-proco': 'Proco',
    'sensor-ensight': 'Ensight Vision',
    'sensor-space': 'Space Sensor'
  };

  const getSensorGroupLabel = () => {
    if (device.sensorGroup && sensorGroupLabels[device.sensorGroup]) {
      return sensorGroupLabels[device.sensorGroup];
    }
    if (device.type && sensorGroupLabels[device.type]) {
      return sensorGroupLabels[device.type];
    }
    return 'Space Monitor';
  };

  const deviceTypeLabel = isDesignableSign ? 'Designable Sign' : isStaticSign ? 'Static Sign' :
    isCamera ? 'Camera' : isSpaceMonitor ? getSensorGroupLabel() : 'Device';

  const isDualLens = device?.hardwareType === 'dual-lens';

  // Helper to update stream properties for dual-lens cameras
  const updateStreamProperty = (streamNum, field, value) => {
    const streamKey = streamNum === 1 ? 'stream1' : 'stream2';
    updateDevice(device.id, {
      [streamKey]: {
        ...device[streamKey],
        [field]: value
      }
    });
  };

  // Get current stream data based on active tab
  const getCurrentStream = () => {
    if (!isDualLens) {
      return device.stream1 || { ipAddress: device.ipAddress, port: device.port, streamType: device.type };
    }
    return activeStreamTab === 1 ? device.stream1 : device.stream2;
  };

  // Stream type options
  const streamTypeOptions = [
    { value: 'cam-fli', label: 'FLI' },
    { value: 'cam-lpr', label: 'LPR' }
  ];

  // Get flow destination options based on direction
  const getFlowOptions = () => {
    const options = [];
    if (device.direction === 'in') {
      options.push({ value: 'garage-entry', label: '🚗 Entering Garage' });
      allLevels.filter(l => l.id !== selectedLevelId).forEach(l => {
        options.push({ value: l.id, label: `From ${l.name}` });
      });
    } else {
      options.push({ value: 'garage-exit', label: '🚗 Exiting Garage' });
      allLevels.filter(l => l.id !== selectedLevelId).forEach(l => {
        options.push({ value: l.id, label: `To ${l.name}` });
      });
    }
    return options;
  };

  const toggleDisplayMapping = (levelId) => {
    const current = device.displayMapping || [];
    const updated = current.includes(levelId)
      ? current.filter(id => id !== levelId)
      : [...current, levelId];
    updateDevice(device.id, { displayMapping: updated });
  };

  return (
    <div className="inspector-panel-compact" onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div className="inspector-header-compact">
        <button className="back-btn-small" onClick={() => setSelectedDevice(null)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <div className="inspector-title-area">
          <span className="inspector-device-name">{device.name}</span>
          <span className="inspector-device-type">{deviceTypeLabel}</span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="inspector-scroll">
        
        {/* ===== SIGN TYPE SELECTOR (for signs only) ===== */}
        {isSign && (
          <div className="inspector-section-compact">
            <label className="section-title-small">Sign Type</label>
            <select 
              className="sign-type-select"
              value={device.type}
              onChange={(e) => {
                const newType = e.target.value;
                const updates = { 
                  type: newType,
                  previewUrl: newType === 'sign-designable' ? (device.previewUrl || '') : undefined,
                  displayMapping: newType === 'sign-static' ? (device.displayMapping || [selectedLevelId]) : undefined,
                  displayStatus: newType === 'sign-static' ? (device.displayStatus || 'OPEN') : undefined
                };
                updateDevice(device.id, updates);
              }}
            >
              <option value="sign-designable">Designable Sign</option>
              <option value="sign-static">Static Sign</option>
            </select>
          </div>
        )}

        {/* ===== BASIC INFO ===== */}
        <div className="inspector-section-compact">
          <div className="compact-row">
            <label>Name</label>
            <input
              type="text"
              value={device.name || ''}
              onChange={(e) => updateDevice(device.id, { name: e.target.value })}
            />
          </div>

          {/* MAC Address for Cameras and Signs */}
          {(isCamera || isSign) && (
            <div className="compact-row">
              <label>MAC Address</label>
              <input
                type="text"
                value={device.macAddress || ''}
                placeholder="00:1A:2B:3C:4D:5E"
                onChange={(e) => updateDevice(device.id, { macAddress: e.target.value })}
              />
            </div>
          )}

          {/* Stream Tabs for Dual Lens Cameras */}
          {isCamera && isDualLens && (
            <div className="stream-tabs-inspector" style={{ display: 'flex', gap: 4, margin: '12px 0' }}>
              <button
                className={`stream-tab-btn ${activeStreamTab === 1 ? 'active' : ''}`}
                onClick={() => setActiveStreamTab(1)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: activeStreamTab === 1 ? '2px solid #3b82f6' : '1px solid #3f3f46',
                  background: activeStreamTab === 1 ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: '#fafafa',
                  fontWeight: activeStreamTab === 1 ? 600 : 400,
                  fontSize: 12
                }}
              >
                Stream 1 {device.stream1?.streamType ? `(${device.stream1.streamType === 'cam-fli' ? 'FLI' : 'LPR'})` : ''}
              </button>
              <button
                className={`stream-tab-btn ${activeStreamTab === 2 ? 'active' : ''}`}
                onClick={() => setActiveStreamTab(2)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: activeStreamTab === 2 ? '2px solid #3b82f6' : '1px solid #3f3f46',
                  background: activeStreamTab === 2 ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: '#fafafa',
                  fontWeight: activeStreamTab === 2 ? 600 : 400,
                  fontSize: 12
                }}
              >
                Stream 2 {device.stream2?.streamType ? `(${device.stream2.streamType === 'cam-fli' ? 'FLI' : 'LPR'})` : ''}
              </button>
            </div>
          )}

          {/* Stream Type Selector for Cameras */}
          {isCamera && (
            <div className="compact-row" style={{ marginBottom: 8 }}>
              <label>Stream Type</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {streamTypeOptions.map(opt => {
                  const currentStream = getCurrentStream();
                  const currentType = isDualLens
                    ? (currentStream?.streamType || device.type)
                    : device.type;
                  const isSelected = currentType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        if (isDualLens) {
                          updateStreamProperty(activeStreamTab, 'streamType', opt.value);
                        } else {
                          updateDevice(device.id, { type: opt.value });
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        border: isSelected ? '2px solid #3b82f6' : '1px solid #3f3f46',
                        background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: isSelected ? '#3b82f6' : '#a1a1aa',
                        fontWeight: isSelected ? 600 : 400,
                        fontSize: 11
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* IP/Port - Stream-aware for dual-lens cameras */}
          {!isSensor && (
            (() => {
              const currentStream = getCurrentStream();
              const ipValue = isDualLens
                ? (currentStream?.ipAddress || '')
                : (device.ipAddress || device.stream1?.ipAddress || '');
              const portValue = isDualLens
                ? (currentStream?.port || '')
                : (device.port || device.stream1?.port || '');

              return (
                <div className="compact-row-inline">
                  <div className="inline-field ip-field">
                    <label>IP</label>
                    <input
                      type="text"
                      value={ipValue}
                      placeholder="10.16.6.45"
                      onChange={(e) => {
                        if (isDualLens) {
                          updateStreamProperty(activeStreamTab, 'ipAddress', e.target.value);
                        } else {
                          updateDevice(device.id, {
                            ipAddress: e.target.value,
                            stream1: { ...device.stream1, ipAddress: e.target.value }
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="inline-field port-field">
                    <label>Port</label>
                    <input
                      type="text"
                      value={portValue}
                      placeholder={isStaticSign ? '10001' : '80'}
                      onChange={(e) => {
                        if (isDualLens) {
                          updateStreamProperty(activeStreamTab, 'port', e.target.value);
                        } else {
                          updateDevice(device.id, {
                            port: e.target.value,
                            stream1: { ...device.stream1, port: e.target.value }
                          });
                        }
                      }}
                    />
                  </div>
                </div>
              );
            })()
          )}
          {isCamera && (
            <div className="compact-row">
              <label>Rotation</label>
              <div className="rotation-compact">
                <input
                  type="number"
                  value={device.rotation || 0}
                  onChange={(e) => updateDevice(device.id, { rotation: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="360"
                />
                <span>°</span>
              </div>
            </div>
          )}
        </div>

        {/* ===== EXTERNAL URL (for cameras and signs) ===== */}
        {(isCamera || isSign) && (
          (() => {
            const currentStream = getCurrentStream();
            const urlValue = (isCamera && isDualLens)
              ? (currentStream?.externalUrl || '')
              : (device.externalUrl || '');

            return (
              <div className="inspector-section-compact">
                <label className="section-title-small">External URL {isCamera && isDualLens ? `(Stream ${activeStreamTab})` : ''}</label>
                <div className="url-input-row">
                  <input
                    type="text"
                    value={urlValue}
                    placeholder="https://device-admin.local/..."
                    onChange={(e) => {
                      if (isCamera && isDualLens) {
                        updateStreamProperty(activeStreamTab, 'externalUrl', e.target.value);
                      } else {
                        updateDevice(device.id, { externalUrl: e.target.value });
                      }
                    }}
                  />
                  <button
                    className="copy-url-btn"
                    onClick={() => navigator.clipboard.writeText(urlValue)}
                    title="Copy URL"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                </div>
                {urlValue && (
                  <a
                    href={urlValue.match(/^https?:\/\//) ? urlValue : `https://${urlValue}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="open-url-btn"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    Open in Browser
                  </a>
                )}
              </div>
            );
          })()
        )}

        {/* ===== CAMERA VIEW IMAGE ===== */}
        {isCamera && (
          <div className="inspector-section-compact">
            <label className="section-title-small">Camera View</label>
            {device.viewImage ? (
              <div className="camera-view-thumb" onClick={() => setShowImageModal(true)}>
                <img src={device.viewImage} alt="Camera view" />
                <div className="camera-view-overlay">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                  </svg>
                  Click to expand
                </div>
                <button 
                  className="remove-image-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateDevice(device.id, { viewImage: null });
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            ) : (
              <button className="upload-view-btn" onClick={() => fileInputRef.current?.click()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
                Add camera view image
              </button>
            )}
          </div>
        )}

        {/* Hidden file input for image uploads (cameras and sensors) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageUpload}
        />

        {/* ===== DESIGNABLE SIGN - PREVIEW ===== */}
        {isDesignableSign && (
          <div className="inspector-section-compact">
            <label className="section-title-small">Design / Content</label>
            <div className="preview-url-row">
              <span className="url-label">Sign Preview URL</span>
              <a href={device.previewUrl || '#'} target="_blank" rel="noopener noreferrer" className="url-link">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                LNK
              </a>
            </div>
            <div className="url-input-row">
              <input
                type="text"
                value={device.previewUrl || ''}
                placeholder="https://SIGN-12.preview..."
                onChange={(e) => updateDevice(device.id, { previewUrl: e.target.value })}
              />
              <button 
                className="copy-url-btn"
                onClick={() => navigator.clipboard.writeText(device.previewUrl || '')}
                title="Copy URL"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
            </div>
            
            {/* Live Preview */}
            {device.previewUrl && (
              <div className="sign-preview-container">
                <iframe 
                  src={device.previewUrl}
                  title="Sign Preview"
                  className="sign-preview-iframe"
                />
              </div>
            )}
            {!device.previewUrl && (
              <div className="sign-preview-placeholder">
                <div className="preview-mock">
                  <div className="preview-mock-header">AVAILABLE</div>
                  <div className="preview-mock-number">248</div>
                  <div className="preview-mock-levels">
                    <div className="preview-mock-level">Level 1<br/><span>124</span></div>
                    <div className="preview-mock-level">Level 2<br/><span>124</span></div>
                  </div>
                </div>
              </div>
            )}
            
            <button 
              className="fullscreen-btn"
              onClick={() => setShowPreviewFullscreen(true)}
            >
              View Fullscreen ▾
            </button>
          </div>
        )}

        {/* ===== STATIC SIGN - DISPLAY STATUS ===== */}
        {isStaticSign && (
          <>
            <div className="inspector-section-compact">
              <label className="section-title-small">Static Display Status</label>
              <div className={`static-display-status ${(device.displayStatus || 'OPEN').toLowerCase()}`}>
                {device.displayStatus || 'OPEN'}
              </div>
            </div>

            <div className="inspector-section-compact">
              <label className="section-title-small">Display Mapping</label>
              <div className="display-mapping-list">
                {allLevels.map(lvl => (
                  <label key={lvl.id} className="mapping-checkbox">
                    <input
                      type="checkbox"
                      checked={(device.displayMapping || []).includes(lvl.id)}
                      onChange={() => toggleDisplayMapping(lvl.id)}
                    />
                    <span className="checkbox-mark"></span>
                    <span className="checkbox-label">{lvl.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ===== OVERRIDE STATE (for all signs) ===== */}
        {isSign && (
          <div className="inspector-section-compact">
            <label className="section-title-small">Override State</label>
            <div className="override-buttons">
              <button 
                className={`override-btn open ${device.overrideState === 'open' ? 'active' : ''}`}
                onClick={() => sendOverrideCommand('open')}
              >
                OPEN
              </button>
              <button 
                className={`override-btn full ${device.overrideState === 'full' ? 'active' : ''}`}
                onClick={() => sendOverrideCommand('full')}
              >
                FULL
              </button>
              <button 
                className={`override-btn clsd ${device.overrideState === 'clsd' || device.overrideState === 'auto' ? 'active' : ''}`}
                onClick={() => sendOverrideCommand('auto')}
              >
                <span>CLSD</span>
                <span className="override-sub">Clear (AUTO)</span>
              </button>
            </div>
            {overrideMessage && (
              <div className="override-message">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Override command sent: {overrideMessage.state} @ {overrideMessage.time} | Delivered cleanly
              </div>
            )}
          </div>
        )}

        {/* ===== TRAFFIC FLOW (cameras only) ===== */}
        {isCamera && (
          (() => {
            const currentStream = getCurrentStream();
            const directionValue = isDualLens
              ? (currentStream?.direction || 'in')
              : (device.direction || 'in');
            const flowDestValue = isDualLens
              ? (currentStream?.flowDestination || (directionValue === 'in' ? 'garage-entry' : 'garage-exit'))
              : (device.flowDestination || (directionValue === 'in' ? 'garage-entry' : 'garage-exit'));

            return (
              <div className="inspector-section-compact">
                <label className="section-title-small">Traffic Flow {isDualLens ? `(Stream ${activeStreamTab})` : ''}</label>
                <p className="flow-help-text">
                  This {isDualLens ? 'stream' : 'camera'} detects cars {directionValue === 'in' ? 'entering' : 'leaving'} {currentLevel.name}
                </p>

                <div className="flow-config-simple">
                  <div className="flow-direction-row">
                    <button
                      className={`flow-dir-btn ${directionValue === 'in' ? 'active in' : ''}`}
                      onClick={() => {
                        if (isDualLens) {
                          updateStreamProperty(activeStreamTab, 'direction', 'in');
                          updateStreamProperty(activeStreamTab, 'flowDestination', 'garage-entry');
                        } else {
                          updateDevice(device.id, { direction: 'in', flowDestination: 'garage-entry' });
                        }
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                      IN
                    </button>
                    <button
                      className={`flow-dir-btn ${directionValue === 'out' ? 'active out' : ''}`}
                      onClick={() => {
                        if (isDualLens) {
                          updateStreamProperty(activeStreamTab, 'direction', 'out');
                          updateStreamProperty(activeStreamTab, 'flowDestination', 'garage-exit');
                        } else {
                          updateDevice(device.id, { direction: 'out', flowDestination: 'garage-exit' });
                        }
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                      </svg>
                      OUT
                    </button>
                  </div>

                  <div className="flow-destination">
                    <span className="flow-label">
                      {directionValue === 'in' ? 'Coming from:' : 'Going to:'}
                    </span>
                    <select
                      value={flowDestValue}
                      onChange={(e) => {
                        if (isDualLens) {
                          updateStreamProperty(activeStreamTab, 'flowDestination', e.target.value);
                        } else {
                          updateDevice(device.id, { flowDestination: e.target.value });
                        }
                      }}
                    >
                      {getFlowOptions().map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })()
        )}

        {/* ===== SPACE MONITOR CONFIGURATION ===== */}
        {isSpaceMonitor && (
          <div className="inspector-section-compact">
            <label className="section-title-small">Space Monitor Configuration</label>

            {/* Sensor Group Selection */}
            <div className="compact-row">
              <label>Sensor Group</label>
              <select
                value={device.sensorGroup || device.type || ''}
                onChange={(e) => updateDevice(device.id, { sensorGroup: e.target.value, type: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: 6,
                  color: '#fafafa',
                  fontSize: 13
                }}
              >
                <option value="sensor-nwave">NWAVE</option>
                <option value="sensor-parksol">Parksol</option>
                <option value="sensor-proco">Proco</option>
                <option value="sensor-ensight">Ensight Vision</option>
              </select>
            </div>

            <div className="compact-row">
              <label>Sensor ID</label>
              <input
                type="text"
                value={device.sensorId || ''}
                placeholder="SENSOR-001"
                onChange={(e) => updateDevice(device.id, { sensorId: e.target.value })}
              />
            </div>

            <div className="compact-row">
              <label>Serial Address</label>
              <input
                type="text"
                value={device.serialAddress || ''}
                placeholder="SN-001234"
                onChange={(e) => updateDevice(device.id, { serialAddress: e.target.value })}
              />
            </div>

            {/* NWAVE-specific fields */}
            {isNwave && (
              <>
                <div className="compact-row">
                  <label>URL (IP Address)</label>
                  <input
                    type="text"
                    value={device.ipAddress || ''}
                    placeholder="https://api.nwave.io/..."
                    onChange={(e) => updateDevice(device.id, { ipAddress: e.target.value })}
                  />
                </div>
                <div className="compact-row">
                  <label>API Key (Controller Key)</label>
                  <input
                    type="text"
                    value={device.controllerKey || ''}
                    placeholder="Enter API Key"
                    onChange={(e) => updateDevice(device.id, { controllerKey: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="compact-row">
              <label>Temp Parking Time (Minutes)</label>
              <input
                type="number"
                value={device.tempParkingTimeMinutes || ''}
                placeholder="30"
                onChange={(e) => updateDevice(device.id, { tempParkingTimeMinutes: e.target.value })}
              />
            </div>

            <div className="compact-row">
              <label>Parking Type</label>
              <div className="parking-type-buttons">
                <button
                  className={`parking-type-btn ${device.parkingType === 'normal' || device.parkingType === 'regular' ? 'active' : ''}`}
                  onClick={() => updateDevice(device.id, { parkingType: 'normal' })}
                >
                  Normal
                </button>
                <button
                  className={`parking-type-btn ev ${device.parkingType === 'ev' ? 'active' : ''}`}
                  onClick={() => updateDevice(device.id, { parkingType: 'ev' })}
                >
                  EV
                </button>
                <button
                  className={`parking-type-btn ada ${device.parkingType === 'ada' ? 'active' : ''}`}
                  onClick={() => updateDevice(device.id, { parkingType: 'ada' })}
                >
                  ADA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== SPACE MONITOR LOCATION IMAGE ===== */}
        {isSpaceMonitor && (
          <div className="inspector-section-compact">
            <label className="section-title-small">Location Photo</label>
            {device.sensorImage ? (
              <div className="sensor-image-preview-large" onClick={() => setShowImageModal(true)}>
                <img src={device.sensorImage} alt="Sensor location" />
                <div className="camera-view-overlay">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                  </svg>
                  Click to expand
                </div>
                <button 
                  className="remove-image-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateDevice(device.id, { sensorImage: null });
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            ) : (
              <button className="upload-view-btn" onClick={() => fileInputRef.current?.click()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
                Add location photo
              </button>
            )}
          </div>
        )}

        {/* Config Files Section */}
        <div className="inspector-section-compact">
          <label className="section-title-small">Config Files</label>
          <div className="config-paths-list" style={{ fontSize: 10, color: '#71717a', fontFamily: 'monospace', marginBottom: 8 }}>
            {getConfigFilePaths(device).map((path, idx) => (
              <div key={idx} style={{ marginBottom: 2, wordBreak: 'break-all' }}>{path}</div>
            ))}
          </div>
          <button
            className="export-config-btn"
            onClick={exportDeviceConfigFiles}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              width: '100%',
              padding: '8px 12px',
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: 6,
              color: '#22c55e',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Config Files
          </button>
          {configExportMessage && (
            <div style={{
              marginTop: 8,
              padding: '6px 10px',
              background: 'rgba(34, 197, 94, 0.15)',
              borderRadius: 4,
              fontSize: 11,
              color: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {configExportMessage}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons - fixed at bottom */}
      <div className="inspector-footer-compact" style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn-delete-compact"
          onClick={() => removeFromMap(device.id)}
          style={{
            flex: 1,
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#f59e0b'
          }}
          title="Remove from map but keep in device list"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
          Remove from Map
        </button>
        <button
          className="btn-delete-compact"
          onClick={() => deleteDevice(device.id)}
          style={{ flex: 1 }}
          title="Permanently delete device"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Delete
        </button>
      </div>

      {/* Image Modal - for camera views and sensor images */}
      {showImageModal && (device.viewImage || device.sensorImage) && (
        <div className="image-modal-overlay" onClick={() => setShowImageModal(false)}>
          <div className="image-modal" onClick={(e) => e.stopPropagation()}>
            <button className="image-modal-close" onClick={() => setShowImageModal(false)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
            <img src={device.viewImage || device.sensorImage} alt={isSpaceMonitor ? "Space monitor location" : "Camera view"} />
            <div className="image-modal-caption">{device.name} - {isSpaceMonitor ? 'Location Photo' : 'Camera View'}</div>
          </div>
        </div>
      )}

      {/* Preview Fullscreen Modal */}
      {showPreviewFullscreen && isDesignableSign && (
        <div className="image-modal-overlay" onClick={() => setShowPreviewFullscreen(false)}>
          <div className="preview-fullscreen-modal" onClick={(e) => e.stopPropagation()}>
            <button className="image-modal-close" onClick={() => setShowPreviewFullscreen(false)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
            {device.previewUrl ? (
              <iframe 
                src={device.previewUrl}
                title="Sign Preview Fullscreen"
                className="preview-fullscreen-iframe"
              />
            ) : (
              <div className="preview-fullscreen-placeholder">
                <div className="preview-mock large">
                  <div className="preview-mock-header">AVAILABLE</div>
                  <div className="preview-mock-number">248</div>
                  <div className="preview-mock-levels">
                    <div className="preview-mock-level">Level 1<br/><span>124</span></div>
                    <div className="preview-mock-level">Level 2<br/><span>124</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectorPanel;
