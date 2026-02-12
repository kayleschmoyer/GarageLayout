/**
 * ExcelParserService - Parses the Ensight site configuration xlsx workbook
 * and maps it to the GarageLayout app data structure.
 *
 * Expected tabs:
 *   Garages, GarageLevels, DisplayGroups, DisplayControllers,
 *   DisplayLevels, DisplaySchedules, Cameras, FLICameras,
 *   SensorGroups, Sensors
 */

import * as XLSX from 'xlsx';

// ========================= SECURITY CONSTANTS =========================

/** Maximum rows allowed per sheet to prevent memory exhaustion */
const MAX_ROWS_PER_SHEET = 10000;

/** Maximum total devices across all levels */
const MAX_TOTAL_DEVICES = 50000;

// ========================= HELPERS =========================

/**
 * Sanitize a string to prevent XSS when rendered in the DOM.
 * Escapes HTML special characters.
 */
function sanitizeForDisplay(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Read a sheet into an array of objects using the first row as headers.
 * Enforces row limits for security.
 */
function sheetToObjects(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  
  // Security: Enforce row limit
  if (rows.length > MAX_ROWS_PER_SHEET) {
    throw new Error(`Sheet "${sheetName}" exceeds maximum allowed rows (${MAX_ROWS_PER_SHEET}).`);
  }
  
  return rows;
}

const str = (val) => (val == null ? '' : String(val).trim());
/** Sanitized string for values that will be displayed in UI */
const safeStr = (val) => sanitizeForDisplay(str(val));
const num = (val, fallback = 0) => {
  if (val == null || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};
const bool = (val) => {
  if (typeof val === 'boolean') return val;
  const s = str(val).toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
};

let nextId = 1;
function genId() {
  return nextId++;
}

// ========================= MAIN PARSER =========================

/**
 * Parse an xlsx ArrayBuffer into the app's garage data structure.
 *
 * @param {ArrayBuffer} buffer - The xlsx file content
 * @returns {{ garages: Array, rawData: Object, sheetNames: string[] }}
 */
export function parseExcelFile(buffer) {
  // Security: Validate input buffer
  if (!buffer) {
    throw new Error('No file data provided.');
  }
  
  if (!(buffer instanceof ArrayBuffer) && !ArrayBuffer.isView(buffer)) {
    throw new Error('Invalid file data format.');
  }
  
  if (buffer.byteLength === 0) {
    throw new Error('File is empty.');
  }

  nextId = 1;

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'array' });
  } catch (err) {
    throw new Error(`Failed to parse Excel file: ${err.message || 'Unknown error'}`);
  }
  
  const sheetNames = workbook.SheetNames;
  
  if (!sheetNames || sheetNames.length === 0) {
    throw new Error('Excel file contains no sheets.');
  }

  // Parse each tab (sheetToObjects enforces row limits)
  const garagesData = sheetToObjects(workbook, 'Garages');
  const garageLevelsData = sheetToObjects(workbook, 'GarageLevels');
  const displayGroupsData = sheetToObjects(workbook, 'DisplayGroups');
  const displayControllersData = sheetToObjects(workbook, 'DisplayControllers');
  const displayLevelsData = sheetToObjects(workbook, 'DisplayLevels');
  const displaySchedulesData = sheetToObjects(workbook, 'DisplaySchedules');
  const camerasData = sheetToObjects(workbook, 'Cameras');
  const fliCamerasData = sheetToObjects(workbook, 'FLICameras');
  const sensorGroupsData = sheetToObjects(workbook, 'SensorGroups');
  const sensorsData = sheetToObjects(workbook, 'Sensors');

  // Security: Track total devices to enforce limits
  let totalDeviceCount = 0;
  
  // Build garage map
  const garages = garagesData.map((row) => {
    const garageName = str(row.Garage);
    const visibleName = safeStr(row.VisibleGarageName) || safeStr(row.Garage);
    const stage = str(row.Stage);

    // Find levels for this garage
    const levelRows = garageLevelsData.filter(
      (l) => str(l.Garage) === garageName
    );

    const levels = levelRows.map((lr) => {
      const levelName = str(lr.Level);
      const visibleLevelName = safeStr(lr.VisibleLevelName) || safeStr(lr.Level);
      const server = str(lr.Server);
      const maxOccupancy = num(lr.MaximumOccupancy, 100);

      // Collect devices for this garage+level
      const devices = [];

      // --- Cameras on this level via FLICameras mapping ---
      const fliForLevel = fliCamerasData.filter(
        (f) => str(f.Garage) === garageName && str(f.Level) === levelName
      );
      fliForLevel.forEach((fli) => {
        const camName = str(fli.CameraName);
        const camData = camerasData.find((c) => str(c.Name) === camName);
        if (camData) {
          const detectionType = str(camData.DetectionType).toUpperCase();
          let deviceType = 'cam-fli'; // default
          if (detectionType === 'LPR') deviceType = 'cam-lpr';
          else if (detectionType === 'PEOPLE' || detectionType === 'PEOPLECOUNTING') deviceType = 'cam-people';
          else if (detectionType === 'FLI') deviceType = 'cam-fli';
          
          devices.push({
            id: genId(),
            name: camName,
            type: deviceType,
            ipAddress: str(camData.IPAddress),
            port: str(camData.Port),
            rtspUrl: str(camData.RTSPURL),
            resolution: str(camData.Resolution),
            server: str(camData.Server),
            status: str(camData.Status),
            visibleName: str(camData.VisibleCameraName),
            detectionType: str(camData.DetectionType),
            // FLI-specific
            backOfCarIs: str(fli.BackOfCarIs),
            isEntryExitCamera: bool(fli.IsEntryExitCamera),
            dependentCameraName: str(fli.DependentCameraName),
            pendingPlacement: true,
            macAddress: '',
            stream1: str(camData.RTSPURL),
            stream2: '',
            hardwareType: 'Bullet',
          });
        }
      });

      // --- Cameras NOT in FLICameras but assigned to this level's server ---
      // (non-FLI cameras that share the same server)
      const fliCameraNames = new Set(fliCamerasData.map((f) => str(f.CameraName)));
      const serverCameras = camerasData.filter(
        (c) => str(c.Server) === server && !fliCameraNames.has(str(c.Name))
      );
      // Only add if we haven't already added them
      serverCameras.forEach((camData) => {
        const camName = str(camData.Name);
        // Avoid duplicates
        if (devices.some((d) => d.name === camName)) return;
        const detectionType = str(camData.DetectionType).toUpperCase();
        let deviceType = 'cam-fli'; // default
        if (detectionType === 'LPR') deviceType = 'cam-lpr';
        else if (detectionType === 'PEOPLE' || detectionType === 'PEOPLECOUNTING') deviceType = 'cam-people';
        else if (detectionType === 'FLI') deviceType = 'cam-fli';
        
        devices.push({
          id: genId(),
          name: camName,
          type: deviceType,
          ipAddress: str(camData.IPAddress),
          port: str(camData.Port),
          rtspUrl: str(camData.RTSPURL),
          resolution: str(camData.Resolution),
          server: str(camData.Server),
          status: str(camData.Status),
          visibleName: str(camData.VisibleCameraName),
          detectionType: str(camData.DetectionType),
          pendingPlacement: true,
          macAddress: '',
          stream1: str(camData.RTSPURL),
          stream2: '',
          hardwareType: 'Bullet',
        });
      });

      // --- Sensor Groups for this level ---
      const sensorGroupsForLevel = sensorGroupsData.filter(
        (sg) => str(sg.Garage) === garageName && str(sg.Level) === levelName
      );
      sensorGroupsForLevel.forEach((sg) => {
        const groupId = str(sg.GroupID);
        const protocol = str(sg.SensorProtocol);

        // Get individual sensors in this group
        const sensorsInGroup = sensorsData.filter(
          (s) => str(s.SensorGroupID) === groupId
        );

        // Map sensor protocol to device type
        const protocolLower = protocol.toLowerCase();
        let sensorType = 'sensor-nwave'; // default
        if (protocolLower === 'parksol' || protocolLower === 'parksolution') sensorType = 'sensor-parksol';
        else if (protocolLower === 'proco') sensorType = 'sensor-proco';
        else if (protocolLower === 'ensight') sensorType = 'sensor-ensight';
        else if (protocolLower === 'nwave') sensorType = 'sensor-nwave';

        devices.push({
          id: genId(),
          name: `SensorGroup-${groupId}`,
          type: sensorType,
          sensorProtocol: protocol,
          controllerAddress: str(sg.ControllerAddress),
          controllerKey: str(sg.ControllerKey),
          parentLevel: str(sg.ParentLevel),
          sensorCount: sensorsInGroup.length,
          sensors: sensorsInGroup.map((s) => ({
            sensorName: str(s.SensorName),
            sensorId: str(s.SensorId),
            parkingType: str(s.ParkingType),
            tempParkingTimeInMinutes: num(s.TempParkingTimeInMinutes),
          })),
          pendingPlacement: true,
        });
      });

      // --- Display controllers assigned to this level ---
      const displaysForLevel = displayLevelsData.filter(
        (dl) => str(dl.Garage) === garageName && str(dl.Level) === levelName
      );
      displaysForLevel.forEach((dl) => {
        const displayName = str(dl.DisplayName);
        const controller = displayControllersData.find(
          (dc) => str(dc.DisplayName) === displayName
        );
        if (controller && !devices.some((d) => d.name === displayName)) {
          const displayProtocol = str(controller.DisplayProtocol).toUpperCase();
          let signType = 'sign-static'; // default
          if (displayProtocol === 'LED') signType = 'sign-led';
          else if (displayProtocol === 'DESIGNABLE') signType = 'sign-designable';
          
          devices.push({
            id: genId(),
            name: displayName,
            type: signType,
            ipAddress: str(controller.IPAddress),
            port: str(controller.Port),
            serialAddress: str(controller.SerialAddress),
            displayProtocol: str(controller.DisplayProtocol),
            displayMap: str(controller.DisplayMap),
            displayGroupName: str(controller.DisplayGroupName),
            visibleName: str(controller.VisibleDisplayName),
            controllerName: str(controller.DisplayControllerName),
            server: str(controller.Server),
            hardwareType: str(controller.InsertHardwareType),
            keepLevelCountsSeparate: bool(controller.KeepLevelCountsSeparate),
            positionName: str(dl.PositionName),
            levelDisplayName: str(dl.LevelName),
            pendingPlacement: true,
          });
        }
      });

      // Security: Track and enforce device limits
      totalDeviceCount += devices.length;
      if (totalDeviceCount > MAX_TOTAL_DEVICES) {
        throw new Error(`Too many devices in file. Maximum allowed is ${MAX_TOTAL_DEVICES}.`);
      }

      return {
        id: genId(),
        name: visibleLevelName,
        internalName: levelName,
        totalSpots: maxOccupancy,
        evSpots: 0,
        handicapSpots: 0,
        bgImage: null,
        devices,
        // Store all the raw GarageLevel config
        config: {
          server,
          levelType: str(lr.LevelType),
          visibleOnPortal: bool(lr.VisibleOnPortal),
          maximumOccupancy: maxOccupancy,
          autoResetCountsEnabled: bool(lr.AutoResetCountsEnabled),
          autoResetCountValue: num(lr.AutoResetCountValue),
          autoResetCountTime: str(lr.AutoResetCountTime),
          forceFullVacancyThreshold: num(lr.ForceFullVacancyThreshold),
          vehicleTransitThreshold: num(lr.VehicleTransitThreshold),
          vehicleTransitThresholdTTLSeconds: num(lr.VehicleTransitThresholdTTLSeconds),
          showFullMessage: bool(lr.ShowFullMessage),
          showFullMessageRed: bool(lr.ShowFullMessageRed),
          portalDisplayOrdinal: num(lr.PortalDisplayOrdinal),
          signDisplayOrdinal: num(lr.SignDisplayOrdinal),
          portalRendering: str(lr.PortalRendering),
          vehicleRolesAllowed: str(lr.VehicleRolesAllowed),
        },
      };
    });

    return {
      id: genId(),
      name: visibleName,
      internalName: garageName,
      stage,
      address: str(row.Address),
      city: str(row.City),
      state: str(row.State),
      zip: str(row.Zip) || str(row.ZipCode),
      image: '',
      contacts: [],
      quickLinks: [],
      servers: [],
      levels,
    };
  });

  // Store raw parsed data for reference
  const rawData = {
    garages: garagesData,
    garageLevels: garageLevelsData,
    displayGroups: displayGroupsData,
    displayControllers: displayControllersData,
    displayLevels: displayLevelsData,
    displaySchedules: displaySchedulesData,
    cameras: camerasData,
    fliCameras: fliCamerasData,
    sensorGroups: sensorGroupsData,
    sensors: sensorsData,
  };

  return { garages, rawData, sheetNames };
}

/**
 * Get a summary of what was parsed from the Excel file.
 *
 * @param {{ garages: Array, rawData: Object }} parsed
 * @returns {{ totalGarages: number, totalLevels: number, totalDevices: number, tabCounts: Object }}
 */
export function getImportSummary(parsed) {
  const { garages, rawData } = parsed;
  let totalLevels = 0;
  let totalDevices = 0;

  garages.forEach((g) => {
    totalLevels += g.levels.length;
    g.levels.forEach((l) => {
      totalDevices += l.devices.length;
    });
  });

  const tabCounts = {};
  for (const [key, arr] of Object.entries(rawData)) {
    tabCounts[key] = Array.isArray(arr) ? arr.length : 0;
  }

  return {
    totalGarages: garages.length,
    totalLevels,
    totalDevices,
    tabCounts,
  };
}
