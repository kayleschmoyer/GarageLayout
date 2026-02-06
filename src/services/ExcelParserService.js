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

// ========================= HELPERS =========================

/**
 * Read a sheet into an array of objects using the first row as headers.
 */
function sheetToObjects(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

const str = (val) => (val == null ? '' : String(val).trim());
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
  nextId = 1;

  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;

  // Parse each tab
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

  // Build garage map
  const garages = garagesData.map((row) => {
    const garageName = str(row.Garage);
    const visibleName = str(row.VisibleGarageName) || garageName;
    const stage = str(row.Stage);

    // Find levels for this garage
    const levelRows = garageLevelsData.filter(
      (l) => str(l.Garage) === garageName
    );

    const levels = levelRows.map((lr) => {
      const levelName = str(lr.Level);
      const visibleLevelName = str(lr.VisibleLevelName) || levelName;
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
          devices.push({
            id: genId(),
            name: camName,
            type: 'camera',
            subType: str(camData.DetectionType) === 'FLI' ? 'fli' :
                     str(camData.DetectionType) === 'LPR' ? 'lpr' : 'peopleCounting',
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
            x: 100 + (devices.length % 5) * 80,
            y: 100 + Math.floor(devices.length / 5) * 80,
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
        devices.push({
          id: genId(),
          name: camName,
          type: 'camera',
          subType: str(camData.DetectionType) === 'FLI' ? 'fli' :
                   str(camData.DetectionType) === 'LPR' ? 'lpr' : 'peopleCounting',
          ipAddress: str(camData.IPAddress),
          port: str(camData.Port),
          rtspUrl: str(camData.RTSPURL),
          resolution: str(camData.Resolution),
          server: str(camData.Server),
          status: str(camData.Status),
          visibleName: str(camData.VisibleCameraName),
          detectionType: str(camData.DetectionType),
          x: 100 + (devices.length % 5) * 80,
          y: 100 + Math.floor(devices.length / 5) * 80,
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

        devices.push({
          id: genId(),
          name: `SensorGroup-${groupId}`,
          type: 'sensor',
          subType: protocol.toLowerCase() || 'nwave',
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
          x: 100 + (devices.length % 5) * 80,
          y: 100 + Math.floor(devices.length / 5) * 80,
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
          devices.push({
            id: genId(),
            name: displayName,
            type: 'sign',
            subType: str(controller.DisplayProtocol) === 'LED' ? 'led' : 'static',
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
            x: 100 + (devices.length % 5) * 80,
            y: 100 + Math.floor(devices.length / 5) * 80,
          });
        }
      });

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
      address: '',
      city: '',
      state: '',
      zip: '',
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
