import React, { useContext, useState, useRef, useMemo, useCallback } from 'react';
import { Modal, ModalDialog, Input, Button } from '@mui/joy';
import { AppContext } from '../App';
import MapCanvas from './MapCanvas';
import InspectorPanel from './InspectorPanel';
import { jsPDF } from 'jspdf';

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
  sensors: [
    { id: 'sensor-space', name: 'Space Sensor' }
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

// ========================= PDF EXPORT HELPER FUNCTIONS =========================

const drawTriangle = (pdf, cx, cy, size, rotation) => {
  const angleRad = (rotation - 90) * Math.PI / 180;
  const points = [];
  for (let i = 0; i < 3; i++) {
    const angle = angleRad + (i * 2 * Math.PI / 3);
    points.push({
      x: cx + size * Math.cos(angle),
      y: cy + size * Math.sin(angle)
    });
  }
  pdf.triangle(
    points[0].x, points[0].y,
    points[1].x, points[1].y,
    points[2].x, points[2].y,
    'F'
  );
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

  // Safe context extraction
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
  const [activeTab, setActiveTab] = useState('cameras');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showLevelSettings, setShowLevelSettings] = useState(false);
  const [toolMode, setToolMode] = useState('select');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [cameraFormStep, setCameraFormStep] = useState(1); // 1: hardware, 2: type, 3: config
  const [activeStreamTab, setActiveStreamTab] = useState(1); // For dual lens: 1 or 2
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
      externalUrl: ''
    },
    // Stream 2 settings (for dual lens)
    stream2: {
      ipAddress: '',
      port: '',
      direction: 'in',
      rotation: 0,
      flowDestination: 'garage-entry',
      viewImage: null,
      externalUrl: ''
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
    parkingType: 'regular',
    sensorImage: null,
    externalUrl: ''
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
  const sensors = useMemo(() => levelDevices.filter(d => d.type?.startsWith('sensor-')), [levelDevices]);
  const signs = useMemo(() => levelDevices.filter(d => d.type?.startsWith('sign-')), [levelDevices]);

  // Stats
  const stats = useMemo(() => ({
    spots: safeNumber(level?.totalSpots, 0),
    cameras: cameras.length,
    sensors: sensors.length,
    signs: signs.length
  }), [level, cameras, sensors, signs]);

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
        externalUrl: ''
      },
      stream2: {
        ipAddress: '',
        port: '',
        direction: 'in',
        rotation: 0,
        flowDestination: 'garage-entry',
        viewImage: null,
        externalUrl: ''
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
      parkingType: 'regular',
      sensorImage: null,
      externalUrl: ''
    });
  }, []);

  const addDevice = useCallback(() => {
    if (!newDevice.name.trim()) return;
    const deviceToAdd = {
      id: Date.now(),
      ...newDevice,
      type: newDevice.type || (activeTab === 'sensors' ? 'sensor-space' : activeTab === 'cameras' ? 'cam-fli' : 'sign-led'),
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

  // ========================= PDF EXPORT =========================

  const exportLayoutPDF = useCallback(async () => {
    if (!garage) return;

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let levelIndex = 0; levelIndex < garage.levels.length; levelIndex++) {
      const currentLevel = garage.levels[levelIndex];
      if (levelIndex > 0) pdf.addPage();

      // Background
      pdf.setFillColor(18, 20, 28);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');

      // Header
      const headerHeight = 55;
      pdf.setFillColor(28, 32, 42);
      pdf.rect(0, 0, pageWidth, headerHeight, 'F');
      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, headerHeight - 2, pageWidth, 2, 'F');

      // Brand accent
      pdf.setFillColor(59, 130, 246);
      pdf.roundedRect(20, 12, 4, 30, 2, 2, 'F');

      // Garage name
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text(garage.name, 34, 35);

      // Level badge
      const levelText = currentLevel.name;
      pdf.setFontSize(11);
      const levelTextWidth = pdf.getTextWidth(levelText) + 20;
      pdf.setFillColor(59, 130, 246);
      pdf.roundedRect(pageWidth - levelTextWidth - 20, 15, levelTextWidth, 26, 13, 13, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.text(levelText, pageWidth - levelTextWidth / 2 - 20, 33, { align: 'center' });

      // Canvas area
      const layoutElements = safeArray(currentLevel.layoutElements);
      const levelDevicesPdf = safeArray(currentLevel.devices);
      const canvasMargin = 32;
      const legendHeight = 36;
      const canvasY = headerHeight + 20;
      const canvasWidth = pageWidth - canvasMargin * 2;
      const canvasHeight = pageHeight - canvasY - legendHeight - 20;

      // Canvas container
      pdf.setFillColor(22, 26, 36);
      pdf.setDrawColor(38, 44, 58);
      pdf.setLineWidth(1);
      pdf.roundedRect(canvasMargin, canvasY, canvasWidth, canvasHeight, 8, 8, 'FD');

      // Calculate bounds for scaling
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let hasContent = false;

      const getElementBounds = (el) => {
        const rotation = el.rotation || 0;
        const isRotated90 = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;
        let w, h;
        switch (el.type) {
          case 'lane': {
            const laneW = el.width || 60;
            const laneL = el.length || 120;
            const isVertical = el.direction === 'up' || el.direction === 'down';
            w = isVertical ? laneW : laneL;
            h = isVertical ? laneL : laneW;
            break;
          }
          case 'curve':
            w = (el.width || 60) + 20;
            h = el.height || 120;
            break;
          case 'spot':
            w = isRotated90 ? (el.height || 60) : (el.width || 40);
            h = isRotated90 ? (el.width || 40) : (el.height || 60);
            break;
          case 'entrance':
            w = isRotated90 ? 16 : (el.width || 80);
            h = isRotated90 ? (el.width || 80) : 16;
            break;
          case 'ramp':
            w = isRotated90 ? (el.height || 100) : (el.width || 60);
            h = isRotated90 ? (el.width || 60) : (el.height || 100);
            break;
          default:
            w = 40;
            h = 40;
        }
        return { minX: el.x - w / 2, minY: el.y - h / 2, maxX: el.x + w / 2, maxY: el.y + h / 2 };
      };

      layoutElements.forEach(el => {
        const bounds = getElementBounds(el);
        minX = Math.min(minX, bounds.minX);
        minY = Math.min(minY, bounds.minY);
        maxX = Math.max(maxX, bounds.maxX);
        maxY = Math.max(maxY, bounds.maxY);
        hasContent = true;
      });

      levelDevicesPdf.forEach(device => {
        minX = Math.min(minX, device.x - 20);
        minY = Math.min(minY, device.y - 20);
        maxX = Math.max(maxX, device.x + 20);
        maxY = Math.max(maxY, device.y + 20);
        hasContent = true;
      });

      if (!hasContent) {
        minX = 0; minY = 0; maxX = 800; maxY = 600;
      }

      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;
      const innerPad = 16;
      const availableWidth = canvasWidth - innerPad * 2;
      const availableHeight = canvasHeight - innerPad * 2;
      const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1.2);
      const offsetX = canvasMargin + innerPad + (availableWidth - contentWidth * scale) / 2 - minX * scale;
      const offsetY = canvasY + innerPad + (availableHeight - contentHeight * scale) / 2 - minY * scale;

      // Draw elements
      const lanes = layoutElements.filter(el => el.type === 'lane');
      const curves = layoutElements.filter(el => el.type === 'curve');
      const spots = layoutElements.filter(el => el.type === 'spot');
      const entrances = layoutElements.filter(el => el.type === 'entrance');

      // Lanes
      lanes.forEach(el => {
        const x = offsetX + el.x * scale;
        const y = offsetY + el.y * scale;
        const isVertical = el.direction === 'up' || el.direction === 'down';
        const laneW = (isVertical ? (el.width || 60) : (el.length || 120)) * scale;
        const laneH = (isVertical ? (el.length || 120) : (el.width || 60)) * scale;

        pdf.setFillColor(10, 12, 18);
        pdf.roundedRect(x - laneW / 2 + 2, y - laneH / 2 + 2, laneW, laneH, 4, 4, 'F');
        pdf.setFillColor(65, 75, 95);
        pdf.roundedRect(x - laneW / 2, y - laneH / 2, laneW, laneH, 4, 4, 'F');

        pdf.setDrawColor(120, 130, 150);
        pdf.setLineWidth(Math.max(1, 1.5 * scale));
        pdf.setLineDashPattern([6 * scale, 4 * scale], 0);
        if (isVertical) {
          pdf.line(x, y - laneH / 2 + 8, x, y + laneH / 2 - 8);
        } else {
          pdf.line(x - laneW / 2 + 8, y, x + laneW / 2 - 8, y);
        }
        pdf.setLineDashPattern([], 0);

        pdf.setFillColor(140, 150, 170);
        const arrSize = Math.max(4, 6 * scale);
        const arrOffset = 12 * scale;
        if (el.direction === 'right') drawTriangle(pdf, x + laneW / 2 - arrOffset, y, arrSize, 90);
        else if (el.direction === 'left') drawTriangle(pdf, x - laneW / 2 + arrOffset, y, arrSize, -90);
        else if (el.direction === 'up') drawTriangle(pdf, x, y - laneH / 2 + arrOffset, arrSize, 0);
        else if (el.direction === 'down') drawTriangle(pdf, x, y + laneH / 2 - arrOffset, arrSize, 180);
      });

      // Curves
      curves.forEach(el => {
        const x = offsetX + el.x * scale;
        const y = offsetY + el.y * scale;
        const w = (el.width || 60) * scale;
        const curveW = w + 20 * scale;
        const curveH = (el.height || 120) * scale;
        const isRight = el.direction === 'right';
        const left = isRight ? (x - w / 2) : (x - curveW + w / 2);
        const top = y - curveH / 2;
        const r = Math.max(0, Math.min(curveH / 2, curveW));
        const k = 4 / 3 * (Math.SQRT2 - 1);

        const drawOneSidedRounded = (ox, oy) => {
          const L = left + ox;
          const T = top + oy;
          const W = curveW;
          const H = curveH;
          const R = r;
          const kr = k * R;

          if (isRight) {
            pdf.lines([
              [W - R, 0],
              [kr, 0, R, R - kr, R, R],
              [0, H - 2 * R],
              [0, kr, -R + kr, R, -R, R],
              [-(W - R), 0],
              [0, -H]
            ], L, T, [1, 1], 'F', true);
          } else {
            pdf.lines([
              [W - R, 0],
              [0, H],
              [-(W - R), 0],
              [-kr, 0, -R, -R + kr, -R, -R],
              [0, -(H - 2 * R)],
              [0, -kr, R - kr, -R, R, -R]
            ], L + R, T, [1, 1], 'F', true);
          }
        };

        pdf.setFillColor(10, 12, 18);
        drawOneSidedRounded(2, 2);
        pdf.setFillColor(65, 75, 95);
        drawOneSidedRounded(0, 0);
      });

      // Spots
      spots.forEach(el => {
        const x = offsetX + el.x * scale;
        const y = offsetY + el.y * scale;
        const rotation = el.rotation || 0;
        const isRotated90 = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;
        let spotW = (el.width || 40) * scale;
        let spotH = (el.height || 60) * scale;
        if (isRotated90) [spotW, spotH] = [spotH, spotW];

        let fillColor, strokeColor, iconColor;
        if (el.spotType === 'ev') {
          fillColor = [20, 60, 35]; strokeColor = [34, 197, 94]; iconColor = [74, 222, 128];
        } else if (el.spotType === 'ada') {
          fillColor = [50, 30, 70]; strokeColor = [168, 85, 247]; iconColor = [192, 132, 252];
        } else {
          fillColor = [30, 45, 70]; strokeColor = [59, 130, 246]; iconColor = [96, 165, 250];
        }

        pdf.setFillColor(...fillColor);
        pdf.rect(x - spotW / 2, y - spotH / 2, spotW, spotH, 'F');
        pdf.setDrawColor(...strokeColor);
        pdf.setLineWidth(Math.max(0.75, 1.2 * scale));
        pdf.setLineDashPattern([3 * scale, 2 * scale], 0);
        pdf.rect(x - spotW / 2, y - spotH / 2, spotW, spotH, 'D');
        pdf.setLineDashPattern([], 0);

        const fontSize = Math.max(6, Math.min(9, 8 * scale));
        pdf.setFontSize(fontSize);
        if (el.spotType === 'ev') {
          pdf.setTextColor(...iconColor);
          pdf.setFont('helvetica', 'bold');
          pdf.text('EV', x, y + fontSize / 3, { align: 'center' });
        } else if (el.spotType === 'ada') {
          pdf.setTextColor(...iconColor);
          pdf.setFont('helvetica', 'bold');
          pdf.text('ADA', x, y + fontSize / 3, { align: 'center' });
        } else if (el.spotNumber) {
          pdf.setTextColor(140, 160, 190);
          pdf.setFont('helvetica', 'normal');
          pdf.text(el.spotNumber, x, y + fontSize / 3, { align: 'center' });
        }
      });

      // Entrances
      entrances.forEach(el => {
        const x = offsetX + el.x * scale;
        const y = offsetY + el.y * scale;
        const rotation = el.rotation || 0;
        const isRotated90 = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;
        const isEntry = el.direction === 'in';
        let entW = (el.width || 80) * scale;
        let entH = 16 * scale;
        if (isRotated90) [entW, entH] = [entH, entW];

        const color = isEntry ? [34, 197, 94] : [239, 68, 68];
        const darkColor = isEntry ? [22, 101, 52] : [153, 27, 27];

        pdf.setFillColor(...darkColor);
        pdf.roundedRect(x - entW / 2, y - entH / 2, entW, entH, 4, 4, 'F');
        pdf.setFillColor(...color);
        pdf.roundedRect(x - entW / 2 + 2, y - entH / 2 + 2, entW - 4, entH - 4, 3, 3, 'F');
      });

      // Devices
      levelDevicesPdf.forEach(device => {
        const x = offsetX + device.x * scale;
        const y = offsetY + device.y * scale;
        const r = Math.max(6, 10 * scale);

        let deviceColor;
        if (device.type?.startsWith('cam-')) deviceColor = [59, 130, 246];
        else if (device.type?.startsWith('sensor-')) deviceColor = [245, 158, 11];
        else deviceColor = [34, 197, 94];

        pdf.setFillColor(deviceColor[0] * 0.3, deviceColor[1] * 0.3, deviceColor[2] * 0.3);
        pdf.circle(x, y, r + 3, 'F');
        pdf.setFillColor(...deviceColor);
        pdf.circle(x, y, r, 'F');
        pdf.setFillColor(Math.min(255, deviceColor[0] + 60), Math.min(255, deviceColor[1] + 60), Math.min(255, deviceColor[2] + 60));
        pdf.circle(x - r * 0.2, y - r * 0.2, r * 0.35, 'F');
        pdf.setDrawColor(255, 255, 255);
        pdf.setLineWidth(1.5);
        pdf.circle(x, y, r, 'D');

        pdf.setTextColor(200, 210, 220);
        pdf.setFontSize(Math.max(6, 8 * scale));
        pdf.setFont('helvetica', 'normal');
        pdf.text(device.name || '', x, y + r + 12 * scale, { align: 'center' });
      });

      // Legend
      const legendY = pageHeight - legendHeight - 12;
      pdf.setFillColor(28, 32, 42);
      pdf.setDrawColor(45, 50, 60);
      pdf.setLineWidth(1);
      pdf.roundedRect(canvasMargin, legendY, canvasWidth, legendHeight, 6, 6, 'FD');

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      let lx = canvasMargin + 20;
      const ly = legendY + legendHeight / 2 + 3;

      const drawLegendItem = (label, type, color, secondary) => {
        if (type === 'circle') {
          pdf.setFillColor(...color);
          pdf.circle(lx, ly - 1, 5, 'F');
          pdf.setDrawColor(255, 255, 255);
          pdf.setLineWidth(0.75);
          pdf.circle(lx, ly - 1, 5, 'D');
          lx += 12;
        } else if (type === 'bar') {
          pdf.setFillColor(...color);
          pdf.roundedRect(lx - 2, ly - 5, 20, 10, 2, 2, 'F');
          lx += 24;
        } else if (type === 'spot') {
          pdf.setFillColor(...color);
          pdf.rect(lx - 2, ly - 6, 10, 12, 'F');
          pdf.setDrawColor(...secondary);
          pdf.setLineDashPattern([2, 1], 0);
          pdf.rect(lx - 2, ly - 6, 10, 12, 'D');
          pdf.setLineDashPattern([], 0);
          lx += 16;
        }
        pdf.setTextColor(170, 180, 190);
        pdf.text(label, lx, ly);
        lx += pdf.getTextWidth(label) + 20;
      };

      drawLegendItem('Camera', 'circle', [59, 130, 246]);
      drawLegendItem('Sensor', 'circle', [245, 158, 11]);
      drawLegendItem('Sign', 'circle', [34, 197, 94]);
      drawLegendItem('Entry', 'bar', [34, 197, 94]);
      drawLegendItem('Exit', 'bar', [239, 68, 68]);
      drawLegendItem('Lane', 'bar', [65, 75, 95]);
      drawLegendItem('Regular', 'spot', [30, 45, 70], [59, 130, 246]);
      drawLegendItem('EV', 'spot', [20, 60, 35], [34, 197, 94]);
      drawLegendItem('ADA', 'spot', [50, 30, 70], [168, 85, 247]);

      // Page footer
      pdf.setFillColor(59, 130, 246);
      pdf.roundedRect(pageWidth / 2 - 30, pageHeight - 18, 60, 16, 8, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${levelIndex + 1} / ${garage.levels.length}`, pageWidth / 2, pageHeight - 7, { align: 'center' });
    }

    pdf.save(`${garage.name.replace(/\s+/g, '_')}_Layout.pdf`);
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
            {/* Stats Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                background: theme.bgButton,
                border: `1px solid ${theme.borderSubtle}`,
                borderRadius: 8,
                fontSize: 13,
                color: theme.textSecondary
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                </svg>
                <span style={{ fontWeight: 600, color: theme.text }}>{stats.spots}</span>
                <span>Spots</span>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                background: theme.bgButton,
                border: `1px solid ${theme.borderSubtle}`,
                borderRadius: 8,
                fontSize: 13,
                color: theme.textSecondary
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
                </svg>
                <span style={{ fontWeight: 600, color: theme.text }}>{stats.cameras}</span>
                <span>Cameras</span>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                background: theme.bgButton,
                border: `1px solid ${theme.borderSubtle}`,
                borderRadius: 8,
                fontSize: 13,
                color: theme.textSecondary
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M2 12h20" />
                </svg>
                <span style={{ fontWeight: 600, color: theme.text }}>{stats.sensors}</span>
                <span>Sensors</span>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                background: theme.bgButton,
                border: `1px solid ${theme.borderSubtle}`,
                borderRadius: 8,
                fontSize: 13,
                color: theme.textSecondary
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                <span style={{ fontWeight: 600, color: theme.text }}>{stats.signs}</span>
                <span>Signs</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                        onClick={() => { setSidebarCollapsed(false); setActiveTab('sensors'); }}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          border: activeTab === 'sensors' ? '1px solid #3b82f6' : '1px solid transparent',
                          background: activeTab === 'sensors' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          color: activeTab === 'sensors' ? '#3b82f6' : theme.textMuted,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Sensors"
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
                        className={`palette-tab-modern ${activeTab === 'sensors' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('sensors'); setShowAddForm(false); }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M5.636 18.364a9 9 0 010-12.728" />
                          <path d="M8.464 15.536a5 5 0 010-7.072" />
                          <circle cx="12" cy="12" r="2" fill="currentColor" />
                          <path d="M15.536 8.464a5 5 0 010 7.072" />
                          <path d="M18.364 5.636a9 9 0 010 12.728" />
                        </svg>
                        <span className="tab-label-modern">Sensors</span>
                      </button>
                    </div>
                  </div>

                  <div className="palette-content-modern">
                    {!showAddForm ? (
                      <>
                        <div className="palette-title">
                          {activeTab === 'cameras' ? 'Cameras' : activeTab === 'signs' ? 'Signs' : 'Sensors'} on {level.name}
                        </div>

                        <button
                          className="btn-sidebar-action primary"
                          style={{ marginBottom: 16 }}
                          onClick={() => setShowAddForm(true)}
                        >
                          + Add {activeTab === 'cameras' ? 'Camera' : activeTab === 'signs' ? 'Sign' : 'Sensor'}
                        </button>

                        <div className="device-list-modern" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {activeTab === 'cameras' && cameras.length === 0 && (
                            <div className="sidebar-empty-state">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
                              </svg>
                              <p>No cameras added yet</p>
                            </div>
                          )}

                          {activeTab === 'cameras' && cameras.map(cam => (
                            <div key={cam.id} className="modern-device-item">
                              <div className="device-icon-wrapper">{getDeviceIcon(cam.type)}</div>
                              <div className="device-info-modern">
                                <span className="device-name-modern">{cam.name}</span>
                                <span className="device-type-modern">{cam.type}</span>
                              </div>
                            </div>
                          ))}

                          {activeTab === 'signs' && signs.length === 0 && (
                            <div className="sidebar-empty-state">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                              </svg>
                              <p>No signs added yet</p>
                            </div>
                          )}

                          {activeTab === 'signs' && signs.map(sign => (
                            <div key={sign.id} className="modern-device-item">
                              <div className="device-icon-wrapper">{getDeviceIcon(sign.type)}</div>
                              <div className="device-info-modern">
                                <span className="device-name-modern">{sign.name}</span>
                                <span className="device-type-modern">{sign.type}</span>
                              </div>
                            </div>
                          ))}

                          {activeTab === 'sensors' && sensors.length === 0 && (
                            <div className="sidebar-empty-state">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                <path d="M12 2v20M2 12h20" />
                              </svg>
                              <p>No sensors added yet</p>
                            </div>
                          )}

                          {activeTab === 'sensors' && sensors.map(sensor => (
                            <div key={sensor.id} className="modern-device-item">
                              <div className="device-icon-wrapper">{getDeviceIcon(sensor.type)}</div>
                              <div className="device-info-modern">
                                <span className="device-name-modern">{sensor.name}</span>
                                <span className="device-type-modern">{sensor.spotNumber || 'Sensor'}</span>
                              </div>
                            </div>
                          ))}
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
                            Add {activeTab === 'cameras' ? 'Camera' : activeTab === 'sensors' ? 'Sensor' : 'Sign'}
                            {activeTab === 'cameras' && cameraFormStep === 1 && ' - Hardware Type'}
                            {activeTab === 'cameras' && cameraFormStep === 2 && ' - Camera Type'}
                            {activeTab === 'cameras' && cameraFormStep === 3 && ' - Configuration'}
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

                          {/* === SIGNS & SENSORS FORMS (unchanged) === */}
                          {activeTab !== 'cameras' && (
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

                              <div className="form-section">
                                <div className="compact-input-row">
                                  <label>Name</label>
                                  <input
                                    type="text"
                                    placeholder={activeTab === 'sensors' ? 'Space Sensor 1' : 'Lobby Display'}
                                    value={newDevice.name}
                                    onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                                  />
                                </div>
                                {activeTab === 'signs' && (
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
                                  disabled={!newDevice.name.trim()}
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
                  <div className="canvas-toolbar">
                    <button
                      className={`toolbar-btn ${toolMode === 'select' ? 'active' : ''}`}
                      onClick={() => setToolMode('select')}
                      title="Select Tool"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /><path d="M13 13l6 6" />
                      </svg>
                    </button>
                    <button
                      className={`toolbar-btn ${toolMode === 'pan' ? 'active' : ''}`}
                      onClick={() => setToolMode('pan')}
                      title="Pan Tool"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M19 9l3 3-3 3M9 19l3 3 3-3M2 12h20M12 2v20" />
                      </svg>
                    </button>
                    <div className="toolbar-divider" />
                    <button className="toolbar-btn active" title="Grid Toggle">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                      </svg>
                    </button>
                  </div>

                  <MapCanvas />
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
              <label style={LABEL_STYLE}>Total Parking Spots</label>
              <Input
                size="sm"
                type="number"
                value={level.totalSpots || 0}
                onChange={(e) => {
                  const updatedGarages = garages.map(g => {
                    if (g.id === selectedGarageId) {
                      return {
                        ...g,
                        levels: safeArray(g.levels).map(l =>
                          l.id === selectedLevelId ? { ...l, totalSpots: parseInt(e.target.value) || 0 } : l
                        )
                      };
                    }
                    return g;
                  });
                  setGarages(updatedGarages);
                }}
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
                  value={level.evSpots || 0}
                  onChange={(e) => {
                    const updatedGarages = garages.map(g => {
                      if (g.id === selectedGarageId) {
                        return {
                          ...g,
                          levels: safeArray(g.levels).map(l =>
                            l.id === selectedLevelId ? { ...l, evSpots: parseInt(e.target.value) || 0 } : l
                          )
                        };
                      }
                      return g;
                    });
                    setGarages(updatedGarages);
                  }}
                  slotProps={{ input: { min: 0 } }}
                  sx={INPUT_SX}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>ADA/Handicap Spots</label>
                <Input
                  size="sm"
                  type="number"
                  value={level.handicapSpots || 0}
                  onChange={(e) => {
                    const updatedGarages = garages.map(g => {
                      if (g.id === selectedGarageId) {
                        return {
                          ...g,
                          levels: safeArray(g.levels).map(l =>
                            l.id === selectedLevelId ? { ...l, handicapSpots: parseInt(e.target.value) || 0 } : l
                          )
                        };
                      }
                      return g;
                    });
                    setGarages(updatedGarages);
                  }}
                  slotProps={{ input: { min: 0 } }}
                  sx={INPUT_SX}
                />
              </div>
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
    </div>
  );
};

export default EditorView;
