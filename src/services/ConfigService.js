/**
 * ConfigService - Handles reading and writing device configuration to local XML files
 *
 * Config file locations:
 * - Cameras:
 *   - C:\Ensight\CameraHub\camerahub-config.xml
 *   - C:\Ensight\EPIC\Config\DevicesConfig.xml
 *   - C:\Ensight\FLI\Config\{CameraName}.xml
 * - Signs:
 *   - C:\Ensight\EPIC\Config\DevicesConfig.xml
 * - Sensors:
 *   - C:\Ensight\EPIC\Config\DevicesConfig.xml
 */

import { js2xml, xml2js } from 'xml-js';

// ========================= CONSTANTS =========================

const XML_OPTIONS = {
  compact: true,
  ignoreComment: true,
  spaces: 2
};

const XML_PARSE_OPTIONS = {
  compact: true,
  ignoreComment: true,
  alwaysArray: false,
  nativeType: true,
  trim: true
};

// Default camera settings for FLI cameras
const DEFAULT_CAMERA_SETTINGS = {
  FPS: 5,
  RecordRawClips: false,
  Enabled: true,
  MotionThreshold: 0.1
};

// Default FLI plugin config settings
const DEFAULT_FLI_CONFIG = {
  EnhancedVisuals: true,
  ResizeWidth: 0,
  FLIConfig: {
    DetectionInterval: 2,
    ConfidenceThreshold: 40,
    Frame: {
      Width: 640,
      Height: 480
    },
    ReportFLI: true,
    ROI: {
      Location: { X: 0, Y: 0 },
      Size: { Width: 640, Height: 480 },
      X: 0,
      Y: 0,
      Width: 640,
      Height: 480
    },
    MotionDetectionSensitivity: 40,
    ROEs: {},
    CountLineUp: { X1: 93, Y1: 202, X2: 555, Y2: 169 },
    CountLineDown: { X1: 96, Y1: 215, X2: 562, Y2: 186 },
    LargeBoundingBoxMaxWidth: 0,
    LargeBoundingBoxMaxHeight: 0,
    MaximumAllowedCountedDistance: 140,
    MinimumSameObjectOverlap: 0.17,
    RecordCountFrames: false,
    RecordLowConfidenceFrames: false,
    DetectionBoxScale: 1,
    FramesReceivedTimeoutMs: 500,
    AllowTurnarounds: true,
    PersistDetections: true,
    MaxAllowedBoxJump: 200
  }
};

// ========================= HELPER FUNCTIONS =========================

/**
 * Extract IP address from RTSP URL
 */
const extractIPFromRTSP = (rtspUrl) => {
  if (!rtspUrl) return '';
  const match = rtspUrl.match(/@([\d.]+):/);
  return match ? match[1] : '';
};

/**
 * Extract port from RTSP URL
 */
const extractPortFromRTSP = (rtspUrl) => {
  if (!rtspUrl) return '554';
  const match = rtspUrl.match(/:(\d+)\//);
  return match ? match[1] : '554';
};

/**
 * Build RTSP URL from components
 */
const buildRTSPUrl = (ipAddress, port = '554', username = 'admin', password = 'Schneider1!') => {
  return `rtsp://${username}:${password}@${ipAddress}:${port}/0/onvif/profile2/media.smp`;
};

/**
 * Map camera type to config type
 */
const getCameraConfigType = (type) => {
  if (type === 'cam-fli') return 'FLI';
  if (type === 'cam-lpr') return 'LPR';
  if (type === 'cam-people') return 'PEOPLE';
  return 'FLI';
};

/**
 * Map device type to DevicesConfig type
 */
const getDeviceConfigType = (type) => {
  if (type?.startsWith('cam-')) return 'CAMERA';
  if (type?.startsWith('sign-')) return 'SIGNCONTROLLER';
  if (type?.startsWith('sensor-')) return 'SENSOR';
  return 'UNKNOWN';
};

/**
 * Get text content from XML element
 */
const getTextContent = (element) => {
  if (element === undefined || element === null) return '';
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  if (element._text !== undefined) return String(element._text);
  if (element._cdata !== undefined) return String(element._cdata);
  return '';
};

// ========================= CAMERAHUB CONFIG =========================

/**
 * Generate CameraHub config XML content
 */
export const generateCameraHubConfig = (cameras) => {
  const cameraElements = cameras.map(cam => {
    const ipAddress = cam.stream1?.ipAddress || cam.ipAddress || '';
    const port = cam.stream1?.port || cam.port || '554';
    const rtspUrl = cam.stream1?.externalUrl || buildRTSPUrl(ipAddress, port);

    return {
      Name: { _text: cam.name },
      RTSPUrl: { _text: rtspUrl },
      FPS: { _text: DEFAULT_CAMERA_SETTINGS.FPS },
      Type: { _text: getCameraConfigType(cam.type) },
      RecordRawClips: { _text: DEFAULT_CAMERA_SETTINGS.RecordRawClips },
      Enabled: { _text: DEFAULT_CAMERA_SETTINGS.Enabled },
      MotionThreshold: { _text: DEFAULT_CAMERA_SETTINGS.MotionThreshold }
    };
  });

  const fliCameras = cameras.filter(cam => cam.type === 'cam-fli');
  const fliCameraElements = fliCameras.map(cam => {
    const ipAddress = cam.stream1?.ipAddress || cam.ipAddress || '';
    const port = cam.stream1?.port || cam.port || '554';
    const rtspUrl = cam.stream1?.externalUrl || buildRTSPUrl(ipAddress, port);

    return {
      Name: { _text: cam.name },
      RTSPUrl: { _text: rtspUrl },
      FPS: { _text: DEFAULT_CAMERA_SETTINGS.FPS },
      Type: { _text: 'FLI' },
      RecordRawClips: { _text: DEFAULT_CAMERA_SETTINGS.RecordRawClips },
      Enabled: { _text: DEFAULT_CAMERA_SETTINGS.Enabled },
      MotionThreshold: { _text: DEFAULT_CAMERA_SETTINGS.MotionThreshold }
    };
  });

  const config = {
    _declaration: { _attributes: { version: '1.0', encoding: 'utf-8' } },
    CameraHubConfig: {
      Cameras: {
        Camera: cameraElements.length > 0 ? cameraElements : []
      },
      FLICameras: {
        CameraConfig: fliCameraElements.length > 0 ? fliCameraElements : []
      }
    }
  };

  return js2xml(config, XML_OPTIONS);
};

/**
 * Parse CameraHub config XML
 * Supports both <CameraHubConfig> and <CameraHub> root elements
 */
export const parseCameraHubConfig = (xmlContent) => {
  try {
    const result = xml2js(xmlContent, XML_PARSE_OPTIONS);
    const cameras = [];

    // Parse Cameras section - support both CameraHubConfig and CameraHub root elements
    const root = result?.CameraHubConfig || result?.CameraHub;
    const camerasSection = root?.Cameras?.Camera;
    if (camerasSection) {
      const cameraArray = Array.isArray(camerasSection) ? camerasSection : [camerasSection];
      cameraArray.forEach(cam => {
        const name = getTextContent(cam.Name);
        const rtspUrl = getTextContent(cam.RTSPUrl);
        const type = getTextContent(cam.Type);

        cameras.push({
          id: Date.now() + Math.random(),
          name,
          type: type === 'FLI' ? 'cam-fli' : type === 'LPR' ? 'cam-lpr' : 'cam-people',
          hardwareType: 'bullet',
          stream1: {
            ipAddress: extractIPFromRTSP(rtspUrl),
            port: extractPortFromRTSP(rtspUrl),
            externalUrl: rtspUrl,
            direction: 'in',
            rotation: 0,
            flowDestination: 'garage-entry'
          },
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 200
        });
      });
    }

    return cameras;
  } catch (error) {
    console.error('Error parsing CameraHub config:', error);
    return [];
  }
};

// ========================= DEVICES CONFIG =========================

/**
 * Generate DevicesConfig.xml content
 */
export const generateDevicesConfig = (devices) => {
  const deviceElements = devices.map(device => {
    const ipAddress = device.stream1?.ipAddress || device.ipAddress || '';
    const port = device.stream1?.port || device.port || (device.type?.startsWith('sign-') ? '10001' : '554');

    return {
      Name: { _text: device.name },
      IPAddress: { _text: ipAddress },
      Port: { _text: port },
      Type: { _text: getDeviceConfigType(device.type) }
    };
  });

  const config = {
    _declaration: { _attributes: { version: '1.0' } },
    Devices: {
      Device: deviceElements.length > 0 ? deviceElements : []
    }
  };

  return js2xml(config, XML_OPTIONS);
};

/**
 * Parse DevicesConfig.xml content
 */
export const parseDevicesConfig = (xmlContent) => {
  try {
    const result = xml2js(xmlContent, XML_PARSE_OPTIONS);
    const devices = [];

    const devicesSection = result?.Devices?.Device;
    if (devicesSection) {
      const deviceArray = Array.isArray(devicesSection) ? devicesSection : [devicesSection];
      deviceArray.forEach(dev => {
        const name = getTextContent(dev.Name);
        const ipAddress = getTextContent(dev.IPAddress);
        const port = getTextContent(dev.Port);
        const type = getTextContent(dev.Type);

        let deviceType = 'cam-fli';
        if (type === 'CAMERA') deviceType = 'cam-fli';
        else if (type === 'SIGNCONTROLLER') deviceType = 'sign-led';
        else if (type === 'SENSOR') deviceType = 'sensor-space';

        devices.push({
          id: Date.now() + Math.random(),
          name,
          type: deviceType,
          ipAddress,
          port,
          stream1: {
            ipAddress,
            port,
            direction: 'in',
            rotation: 0,
            flowDestination: 'garage-entry'
          },
          x: 100 + Math.random() * 200,
          y: 100 + Math.random() * 200
        });
      });
    }

    return devices;
  } catch (error) {
    console.error('Error parsing DevicesConfig:', error);
    return [];
  }
};

// ========================= FLI CAMERA CONFIG =========================

/**
 * Generate individual FLI camera config XML
 */
export const generateFLICameraConfig = (camera) => {
  const config = {
    _declaration: { _attributes: { version: '1.0', encoding: 'utf-8' } },
    PluginConfig: {
      _attributes: {
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema'
      },
      CameraName: { _text: camera.name },
      EnhancedVisuals: { _text: DEFAULT_FLI_CONFIG.EnhancedVisuals },
      ResizeWidth: { _text: DEFAULT_FLI_CONFIG.ResizeWidth },
      FLIConfig: {
        DetectionInterval: { _text: DEFAULT_FLI_CONFIG.FLIConfig.DetectionInterval },
        ConfidenceThreshold: { _text: DEFAULT_FLI_CONFIG.FLIConfig.ConfidenceThreshold },
        Frame: {
          Width: { _text: DEFAULT_FLI_CONFIG.FLIConfig.Frame.Width },
          Height: { _text: DEFAULT_FLI_CONFIG.FLIConfig.Frame.Height }
        },
        ReportFLI: { _text: DEFAULT_FLI_CONFIG.FLIConfig.ReportFLI },
        ROI: {
          Location: {
            X: { _text: DEFAULT_FLI_CONFIG.FLIConfig.ROI.Location.X },
            Y: { _text: DEFAULT_FLI_CONFIG.FLIConfig.ROI.Location.Y }
          },
          Size: {
            Width: { _text: DEFAULT_FLI_CONFIG.FLIConfig.ROI.Size.Width },
            Height: { _text: DEFAULT_FLI_CONFIG.FLIConfig.ROI.Size.Height }
          },
          X: { _text: DEFAULT_FLI_CONFIG.FLIConfig.ROI.X },
          Y: { _text: DEFAULT_FLI_CONFIG.FLIConfig.ROI.Y },
          Width: { _text: DEFAULT_FLI_CONFIG.FLIConfig.ROI.Width },
          Height: { _text: DEFAULT_FLI_CONFIG.FLIConfig.ROI.Height }
        },
        MotionDetectionSensitivity: { _text: DEFAULT_FLI_CONFIG.FLIConfig.MotionDetectionSensitivity },
        ROEs: {},
        CountLineUp: {
          X1: { _text: DEFAULT_FLI_CONFIG.FLIConfig.CountLineUp.X1 },
          Y1: { _text: DEFAULT_FLI_CONFIG.FLIConfig.CountLineUp.Y1 },
          X2: { _text: DEFAULT_FLI_CONFIG.FLIConfig.CountLineUp.X2 },
          Y2: { _text: DEFAULT_FLI_CONFIG.FLIConfig.CountLineUp.Y2 }
        },
        CountLineDown: {
          X1: { _text: DEFAULT_FLI_CONFIG.FLIConfig.CountLineDown.X1 },
          Y1: { _text: DEFAULT_FLI_CONFIG.FLIConfig.CountLineDown.Y1 },
          X2: { _text: DEFAULT_FLI_CONFIG.FLIConfig.CountLineDown.X2 },
          Y2: { _text: DEFAULT_FLI_CONFIG.FLIConfig.CountLineDown.Y2 }
        },
        LargeBoundingBoxMaxWidth: { _text: DEFAULT_FLI_CONFIG.FLIConfig.LargeBoundingBoxMaxWidth },
        LargeBoundingBoxMaxHeight: { _text: DEFAULT_FLI_CONFIG.FLIConfig.LargeBoundingBoxMaxHeight },
        MaximumAllowedCountedDistance: { _text: DEFAULT_FLI_CONFIG.FLIConfig.MaximumAllowedCountedDistance },
        MinimumSameObjectOverlap: { _text: DEFAULT_FLI_CONFIG.FLIConfig.MinimumSameObjectOverlap },
        RecordCountFrames: { _text: DEFAULT_FLI_CONFIG.FLIConfig.RecordCountFrames },
        RecordLowConfidenceFrames: { _text: DEFAULT_FLI_CONFIG.FLIConfig.RecordLowConfidenceFrames },
        DetectionBoxScale: { _text: DEFAULT_FLI_CONFIG.FLIConfig.DetectionBoxScale },
        FramesReceivedTimeoutMs: { _text: DEFAULT_FLI_CONFIG.FLIConfig.FramesReceivedTimeoutMs },
        AllowTurnarounds: { _text: DEFAULT_FLI_CONFIG.FLIConfig.AllowTurnarounds },
        PersistDetections: { _text: DEFAULT_FLI_CONFIG.FLIConfig.PersistDetections },
        MaxAllowedBoxJump: { _text: DEFAULT_FLI_CONFIG.FLIConfig.MaxAllowedBoxJump }
      }
    }
  };

  return js2xml(config, XML_OPTIONS);
};

// ========================= FILE OPERATIONS =========================

/**
 * Download content as a file
 */
export const downloadFile = (content, filename, mimeType = 'application/xml') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Read file content as text
 */
export const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

// ========================= EXPORT ALL CONFIGS =========================

/**
 * Export all device configs as a ZIP-like bundle (downloads each file)
 */
export const exportAllConfigs = (allDevices) => {
  const cameras = allDevices.filter(d => d.type?.startsWith('cam-'));
  const signs = allDevices.filter(d => d.type?.startsWith('sign-'));
  const sensors = allDevices.filter(d => d.type?.startsWith('sensor-'));

  // Generate and download CameraHub config
  if (cameras.length > 0) {
    const cameraHubConfig = generateCameraHubConfig(cameras);
    downloadFile(cameraHubConfig, 'camerahub-config.xml');
  }

  // Generate and download DevicesConfig (all devices)
  const devicesConfig = generateDevicesConfig(allDevices);
  downloadFile(devicesConfig, 'DevicesConfig.xml');

  // Generate and download individual FLI camera configs
  const fliCameras = cameras.filter(c => c.type === 'cam-fli');
  fliCameras.forEach(camera => {
    const fliConfig = generateFLICameraConfig(camera);
    downloadFile(fliConfig, `${camera.name}.xml`);
  });

  return {
    cameraHubConfig: cameras.length > 0,
    devicesConfig: true,
    fliConfigs: fliCameras.length
  };
};

/**
 * Export single device config
 */
export const exportDeviceConfig = (device) => {
  if (device.type?.startsWith('cam-')) {
    // Export camera config
    const cameraHubConfig = generateCameraHubConfig([device]);
    downloadFile(cameraHubConfig, `${device.name}-camerahub.xml`);

    if (device.type === 'cam-fli') {
      const fliConfig = generateFLICameraConfig(device);
      downloadFile(fliConfig, `${device.name}.xml`);
    }
  }

  // Always export device entry
  const devicesConfig = generateDevicesConfig([device]);
  downloadFile(devicesConfig, `${device.name}-device.xml`);
};

// ========================= CONFIG FILE PATHS =========================

/**
 * Get the expected config file paths for a device
 */
export const getConfigFilePaths = (device) => {
  const paths = [];

  if (device.type?.startsWith('cam-')) {
    paths.push('C:\\Ensight\\CameraHub\\camerahub-config.xml');
    paths.push('C:\\Ensight\\EPIC\\Config\\DevicesConfig.xml');
    if (device.type === 'cam-fli') {
      paths.push(`C:\\Ensight\\FLI\\Config\\${device.name}.xml`);
    }
  } else if (device.type?.startsWith('sign-')) {
    paths.push('C:\\Ensight\\EPIC\\Config\\DevicesConfig.xml');
  } else if (device.type?.startsWith('sensor-')) {
    paths.push('C:\\Ensight\\EPIC\\Config\\DevicesConfig.xml');
  }

  return paths;
};

export default {
  generateCameraHubConfig,
  parseCameraHubConfig,
  generateDevicesConfig,
  parseDevicesConfig,
  generateFLICameraConfig,
  downloadFile,
  readFileAsText,
  exportAllConfigs,
  exportDeviceConfig,
  getConfigFilePaths
};
