import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import MapCanvas from './MapCanvas';
import InspectorPanel from './InspectorPanel';
import { jsPDF } from 'jspdf';

const EditorView = () => {
  const {
    garages,
    setGarages,
    selectedGarageId,
    selectedLevelId,
    setSelectedLevelId,
    selectedDevice,
    setSelectedDevice,
    goBack,
    mode,
    setMode
  } = useContext(AppContext);

  const [activeTab, setActiveTab] = useState('cameras');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showLevelSettings, setShowLevelSettings] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [newDevice, setNewDevice] = useState({
    type: '',
    name: '',
    ipAddress: '',
    port: '',
    direction: 'in',
    rotation: 0,
    flowDestination: 'garage-entry',
    viewImage: null,
    // Sign-specific fields
    previewUrl: '',
    displayMapping: [],
    overrideState: 'auto',
    // Sensor-specific fields
    serialAddress: '',
    spotNumber: '',
    parkingType: 'regular',
    sensorImage: null,
    // External URL for cameras and signs
    externalUrl: ''
  });
  const fileInputRef = useRef(null);
  const sensorImageRef = useRef(null);

  const garage = garages.find(g => g.id === selectedGarageId);
  const level = garage?.levels.find(l => l.id === selectedLevelId);

  if (!garage || !level) {
    return null;
  }

  const deviceTypes = {
    cameras: [
      { id: 'cam-dome', name: 'Dome Camera', icon: 'dome' },
      { id: 'cam-ptz', name: 'PTZ Camera', icon: 'ptz' },
      { id: 'cam-lpr', name: 'LPR Camera', icon: 'lpr' }
    ],
    sensors: [
      { id: 'sensor-space', name: 'Space Sensor', icon: 'space' }
    ],
    signs: [
      { id: 'sign-designable', name: 'Designable Sign', icon: 'designable' },
      { id: 'sign-static', name: 'Static Sign', icon: 'static' }
    ]
  };

  const levelDevices = level.devices || [];
  const cameras = levelDevices.filter(d => d.type.startsWith('cam-'));
  const sensors = levelDevices.filter(d => d.type.startsWith('sensor-'));
  const signs = levelDevices.filter(d => d.type.startsWith('sign-'));

  const allLevels = garage?.levels || [];

  // Fetch weather data based on garage address
  useEffect(() => {
    const fetchWeather = async () => {
      if (!garage?.address) return;

      setWeatherLoading(true);
      try {
        // First, geocode the address to get coordinates
        const geocodeResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(garage.address)}&format=json&limit=1`
        );
        const geocodeData = await geocodeResponse.json();

        if (geocodeData && geocodeData.length > 0) {
          const { lat, lon } = geocodeData[0];

          // Fetch weather data from Open-Meteo API (no API key required)
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
              lat,
              lon
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
  }, [garage?.address]);

  // Get weather icon based on weather code
  const getWeatherIcon = (code) => {
    if (code === 0) return '☀️'; // Clear sky
    if (code <= 3) return '⛅'; // Partly cloudy
    if (code <= 48) return '🌫️'; // Fog
    if (code <= 67) return '🌧️'; // Rain
    if (code <= 77) return '🌨️'; // Snow
    if (code <= 82) return '🌦️'; // Rain showers
    if (code <= 86) return '🌨️'; // Snow showers
    return '⛈️'; // Thunderstorm
  };

  // Get flow destination options based on direction
  const getFlowOptions = (direction) => {
    const options = [];
    if (direction === 'in') {
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

  const handleNewDeviceImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewDevice({ ...newDevice, viewImage: event.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const addDevice = () => {
    if (!newDevice.type || !newDevice.name) return;

    const updatedGarages = garages.map(g => {
      if (g.id === selectedGarageId) {
        return {
          ...g,
          levels: g.levels.map(l => {
            if (l.id === selectedLevelId) {
              const isCamera = newDevice.type.startsWith('cam-');
              const isSensor = newDevice.type.startsWith('sensor-');
              const isSign = newDevice.type.startsWith('sign-');
              const isDesignableSign = newDevice.type === 'sign-designable';
              const isStaticSign = newDevice.type === 'sign-static';
              const isSpaceSensor = newDevice.type === 'sensor-space';
              const device = {
                id: `device-${Date.now()}`,
                type: newDevice.type,
                name: newDevice.name,
                ipAddress: newDevice.ipAddress,
                port: isSign ? (newDevice.port || (isStaticSign ? '10001' : '80')) : undefined,
                direction: isCamera ? newDevice.direction : undefined,
                rotation: isCamera ? (newDevice.rotation || 0) : undefined,
                flowDestination: isCamera ? newDevice.flowDestination : undefined,
                viewImage: isCamera ? newDevice.viewImage : undefined,
                // External URL for cameras and signs
                externalUrl: (isCamera || isSign) ? newDevice.externalUrl : undefined,
                // Sign-specific fields
                previewUrl: isDesignableSign ? newDevice.previewUrl : undefined,
                displayMapping: isStaticSign ? (newDevice.displayMapping.length > 0 ? newDevice.displayMapping : [selectedLevelId]) : undefined,
                overrideState: isSign ? 'auto' : undefined,
                displayStatus: isStaticSign ? 'OPEN' : undefined,
                // Sensor-specific fields
                serialAddress: isSpaceSensor ? newDevice.serialAddress : undefined,
                spotNumber: isSpaceSensor ? newDevice.spotNumber : undefined,
                parkingType: isSpaceSensor ? newDevice.parkingType : undefined,
                sensorImage: isSpaceSensor ? newDevice.sensorImage : undefined,
                garageName: isSpaceSensor ? garage.name : undefined,
                levelName: isSpaceSensor ? level.name : undefined,
                x: 150 + Math.random() * 200,
                y: 150 + Math.random() * 200
              };
              return {
                ...l,
                devices: [...(l.devices || []), device]
              };
            }
            return l;
          })
        };
      }
      return g;
    });
    setGarages(updatedGarages);
    setNewDevice({ type: '', name: '', ipAddress: '', port: '', direction: 'in', rotation: 0, flowDestination: 'garage-entry', viewImage: null, previewUrl: '', displayMapping: [], overrideState: 'auto', serialAddress: '', spotNumber: '', parkingType: 'regular', sensorImage: null, externalUrl: '' });
    setShowAddForm(false);
  };

  // Export PDF with all levels - Premium professional design
  const exportLayoutPDF = async () => {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let levelIndex = 0; levelIndex < garage.levels.length; levelIndex++) {
      const currentLevel = garage.levels[levelIndex];

      if (levelIndex > 0) {
        pdf.addPage();
      }

      // === BACKGROUND - Subtle gradient effect ===
      // Main dark background
      pdf.setFillColor(18, 20, 28);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');

      // Subtle vignette overlay at edges
      pdf.setFillColor(12, 14, 20);
      pdf.rect(0, 0, pageWidth, 8, 'F');
      pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');

      // === HEADER - Modern sleek design ===
      const headerHeight = 55;

      // Header background with subtle gradient
      pdf.setFillColor(28, 32, 42);
      pdf.rect(0, 0, pageWidth, headerHeight, 'F');

      // Accent line under header
      pdf.setFillColor(59, 130, 246);
      pdf.rect(0, headerHeight - 2, pageWidth, 2, 'F');

      // Logo/Brand area indicator
      pdf.setFillColor(59, 130, 246);
      pdf.roundedRect(20, 12, 4, 30, 2, 2, 'F');

      // Garage name - Large bold
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

      // === STATS BAR - Clean pill design ===
      const statsY = headerHeight + 12;
      const levelDevices = currentLevel.devices || [];
      const cameraCount = levelDevices.filter(d => d.type.startsWith('cam-')).length;
      const sensorCount = levelDevices.filter(d => d.type.startsWith('sensor-')).length;
      const signCount = levelDevices.filter(d => d.type.startsWith('sign-')).length;

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');

      let statsX = 20;
      const drawStatPill = (label, value, color) => {
        const text = `${label}: ${value}`;
        const textW = pdf.getTextWidth(text) + 16;
        pdf.setFillColor(...color);
        pdf.roundedRect(statsX, statsY, textW, 20, 10, 10, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.text(text, statsX + 8, statsY + 14);
        statsX += textW + 8;
      };

      drawStatPill('Spots', currentLevel.totalSpots || 0, [55, 65, 81]);
      drawStatPill('EV', currentLevel.evSpots || 0, [22, 101, 52]);
      drawStatPill('ADA', currentLevel.adaSpots || 0, [88, 28, 135]);
      drawStatPill('Cameras', cameraCount, [30, 64, 175]);
      drawStatPill('Sensors', sensorCount, [161, 98, 7]);
      drawStatPill('Signs', signCount, [21, 128, 61]);

      // Date/time on right
      pdf.setFillColor(40, 44, 52);
      const dateText = new Date().toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const dateW = pdf.getTextWidth(dateText) + 16;
      pdf.roundedRect(pageWidth - dateW - 20, statsY, dateW, 20, 10, 10, 'F');
      pdf.setTextColor(160, 170, 180);
      pdf.text(dateText, pageWidth - dateW / 2 - 20, statsY + 14, { align: 'center' });

      // === MAIN CANVAS AREA ===
      const canvasMargin = 20;
      const canvasY = statsY + 35;
      const legendHeight = 50;
      const canvasHeight = pageHeight - canvasY - legendHeight - 25;
      const canvasWidth = pageWidth - canvasMargin * 2;

      // Canvas container with subtle border
      pdf.setFillColor(22, 24, 32);
      pdf.setDrawColor(40, 45, 55);
      pdf.setLineWidth(1);
      pdf.roundedRect(canvasMargin, canvasY, canvasWidth, canvasHeight, 8, 8, 'FD');

      // Inner canvas area
      const innerPad = 8;
      pdf.setFillColor(16, 18, 26);
      pdf.roundedRect(canvasMargin + innerPad, canvasY + innerPad,
        canvasWidth - innerPad * 2, canvasHeight - innerPad * 2, 4, 4, 'F');

      // Background image if exists
      if (currentLevel.bgImage) {
        try {
          pdf.addImage(currentLevel.bgImage, 'JPEG',
            canvasMargin + innerPad, canvasY + innerPad,
            canvasWidth - innerPad * 2, canvasHeight - innerPad * 2);
        } catch (e) { /* Continue on error */ }
      }

      // === CALCULATE BOUNDS ===
      const layoutElements = currentLevel.layoutElements || [];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let hasContent = false;

      // Get element bounds accounting for rotation
      const getElementBounds = (el) => {
        const rotation = el.rotation || 0;
        const isRotated90 = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;
        let w, h;

        switch (el.type) {
          case 'lane': {
            const isVertical = el.direction === 'up' || el.direction === 'down';
            w = isVertical ? (el.width || 60) : (el.length || 200);
            h = isVertical ? (el.length || 200) : (el.width || 60);
            break;
          }
          case 'spot': {
            w = el.width || 40;
            h = el.height || 60;
            // Swap dimensions if rotated 90 degrees
            if (isRotated90) {
              [w, h] = [h, w];
            }
            break;
          }
          case 'entrance': {
            w = el.width || 80;
            h = 30;
            if (isRotated90) {
              [w, h] = [h, w];
            }
            break;
          }
          case 'curve': w = (el.width || 60) + 20; h = el.height || 120; break;
          case 'ramp': {
            w = el.width || 60;
            h = el.length || 100;
            if (isRotated90) {
              [w, h] = [h, w];
            }
            break;
          }
          default: w = el.width || 60; h = el.height || 60;
        }
        return { w, h };
      };

      layoutElements.forEach(el => {
        hasContent = true;
        const { w, h } = getElementBounds(el);
        minX = Math.min(minX, el.x - w / 2);
        minY = Math.min(minY, el.y - h / 2);
        maxX = Math.max(maxX, el.x + w / 2);
        maxY = Math.max(maxY, el.y + h / 2);
      });

      levelDevices.forEach(d => {
        hasContent = true;
        minX = Math.min(minX, d.x - 40);
        minY = Math.min(minY, d.y - 40);
        maxX = Math.max(maxX, d.x + 40);
        maxY = Math.max(maxY, d.y + 40);
      });

      if (!hasContent) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

      const padding = 30;
      minX -= padding; minY -= padding; maxX += padding; maxY += padding;

      const contentW = maxX - minX;
      const contentH = maxY - minY;
      const drawableW = canvasWidth - innerPad * 2 - 20;
      const drawableH = canvasHeight - innerPad * 2 - 20;
      const scale = Math.min(drawableW / contentW, drawableH / contentH);

      const scaledW = contentW * scale;
      const scaledH = contentH * scale;
      const offsetX = canvasMargin + innerPad + 10 + (drawableW - scaledW) / 2 - minX * scale;
      const offsetY = canvasY + innerPad + 10 + (drawableH - scaledH) / 2 - minY * scale;

      // === DRAW ELEMENTS ===
      const lanes = layoutElements.filter(el => el.type === 'lane');
      const curves = layoutElements.filter(el => el.type === 'curve');
      const spots = layoutElements.filter(el => el.type === 'spot');
      const entrances = layoutElements.filter(el => el.type === 'entrance');
      const ramps = layoutElements.filter(el => el.type === 'ramp');

      // --- LANES ---
      lanes.forEach(el => {
        const x = offsetX + el.x * scale;
        const y = offsetY + el.y * scale;
        const isVertical = el.direction === 'up' || el.direction === 'down';
        const laneW = (isVertical ? (el.width || 60) : (el.length || 120)) * scale;
        const laneH = (isVertical ? (el.length || 120) : (el.width || 60)) * scale;

        // Shadow
        pdf.setFillColor(10, 12, 18);
        pdf.roundedRect(x - laneW / 2 + 2, y - laneH / 2 + 2, laneW, laneH, 4, 4, 'F');

        // Lane body
        pdf.setFillColor(65, 75, 95);
        pdf.roundedRect(x - laneW / 2, y - laneH / 2, laneW, laneH, 4, 4, 'F');

        // Center dashed line
        pdf.setDrawColor(120, 130, 150);
        pdf.setLineWidth(Math.max(1, 1.5 * scale));
        pdf.setLineDashPattern([6 * scale, 4 * scale], 0);
        if (isVertical) {
          pdf.line(x, y - laneH / 2 + 8, x, y + laneH / 2 - 8);
        } else {
          pdf.line(x - laneW / 2 + 8, y, x + laneW / 2 - 8, y);
        }
        pdf.setLineDashPattern([], 0);

        // Direction arrow
        pdf.setFillColor(140, 150, 170);
        const arrSize = Math.max(4, 6 * scale);
        const arrOffset = 12 * scale;
        if (el.direction === 'right') drawTriangle(pdf, x + laneW / 2 - arrOffset, y, arrSize, 90);
        else if (el.direction === 'left') drawTriangle(pdf, x - laneW / 2 + arrOffset, y, arrSize, -90);
        else if (el.direction === 'up') drawTriangle(pdf, x, y - laneH / 2 + arrOffset, arrSize, 0);
        else if (el.direction === 'down') drawTriangle(pdf, x, y + laneH / 2 - arrOffset, arrSize, 180);
      });

      // --- CURVES (U-turn connectors) ---
      // jsPDF doesn't support per-corner radii in roundedRect, so we draw a one-sided rounded
      // shape (flat on one side, rounded on the other) using cubic bezier segments.
      curves.forEach(el => {
        const x = offsetX + el.x * scale;
        const y = offsetY + el.y * scale;
        const w = (el.width || 60) * scale;
        const curveW = w + 20 * scale;
        const curveH = (el.height || 120) * scale;
        const isRight = el.direction === 'right';

        // Position matches canvas: isRight ? -w/2 : -curveW + w/2
        const left = isRight ? (x - w / 2) : (x - curveW + w / 2);
        const top = y - curveH / 2;
        const r = Math.max(0, Math.min(curveH / 2, curveW));
        const k = 4 / 3 * (Math.SQRT2 - 1); // cubic bezier quarter-circle constant

        const drawOneSidedRounded = (ox, oy) => {
          const L = left + ox;
          const T = top + oy;
          const W = curveW;
          const H = curveH;
          const R = r;
          const kr = k * R;

          if (isRight) {
            // Flat on left, rounded on right
            // Start at top-left
            pdf.lines(
              [
                [W - R, 0],
                // top-right quarter curve
                [kr, 0, R, R - kr, R, R],
                [0, H - 2 * R],
                // bottom-right quarter curve
                [0, kr, -R + kr, R, -R, R],
                [-(W - R), 0],
                [0, -H]
              ],
              L,
              T,
              [1, 1],
              'F',
              true
            );
          } else {
            // Rounded on left, flat on right
            // Start at top-left + radius
            pdf.lines(
              [
                [W - R, 0],
                [0, H],
                [-(W - R), 0],
                // bottom-left quarter curve
                [-kr, 0, -R, -R + kr, -R, -R],
                [0, -(H - 2 * R)],
                // top-left quarter curve
                [0, -kr, R - kr, -R, R, -R]
              ],
              L + R,
              T,
              [1, 1],
              'F',
              true
            );
          }
        };

        // Shadow
        pdf.setFillColor(10, 12, 18);
        drawOneSidedRounded(2, 2);

        // Curve body
        pdf.setFillColor(65, 75, 95);
        drawOneSidedRounded(0, 0);
      });

      // --- SPOTS ---
      spots.forEach(el => {
        const x = offsetX + el.x * scale;
        const y = offsetY + el.y * scale;
        const rotation = el.rotation || 0;
        const isRotated90 = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;

        // Swap width/height if rotated 90 degrees
        let spotW = (el.width || 40) * scale;
        let spotH = (el.height || 60) * scale;
        if (isRotated90) {
          [spotW, spotH] = [spotH, spotW];
        }

        let fillColor, strokeColor, iconColor;
        if (el.spotType === 'ev') {
          fillColor = [20, 60, 35]; strokeColor = [34, 197, 94]; iconColor = [74, 222, 128];
        } else if (el.spotType === 'ada') {
          fillColor = [50, 30, 70]; strokeColor = [168, 85, 247]; iconColor = [192, 132, 252];
        } else {
          fillColor = [30, 45, 70]; strokeColor = [59, 130, 246]; iconColor = [96, 165, 250];
        }

        // Spot fill
        pdf.setFillColor(...fillColor);
        pdf.rect(x - spotW / 2, y - spotH / 2, spotW, spotH, 'F');

        // Dashed border
        pdf.setDrawColor(...strokeColor);
        pdf.setLineWidth(Math.max(0.75, 1.2 * scale));
        pdf.setLineDashPattern([3 * scale, 2 * scale], 0);
        pdf.rect(x - spotW / 2, y - spotH / 2, spotW, spotH, 'D');
        pdf.setLineDashPattern([], 0);

        // Icons/Numbers
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

      // --- ENTRANCES ---
      entrances.forEach(el => {
        const x = offsetX + el.x * scale;
        const y = offsetY + el.y * scale;
        const rotation = el.rotation || 0;
        const isRotated90 = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;
        const isEntry = el.direction === 'in';

        let entW = (el.width || 80) * scale;
        let entH = 16 * scale;
        if (isRotated90) {
          [entW, entH] = [entH, entW];
        }

        const color = isEntry ? [34, 197, 94] : [239, 68, 68];
        const darkColor = isEntry ? [22, 101, 52] : [153, 27, 27];

        // Shadow/glow
        pdf.setFillColor(...darkColor);
        pdf.roundedRect(x - entW / 2, y - entH / 2, entW, entH, 4, 4, 'F');

        // Main bar
        pdf.setFillColor(...color);
        pdf.roundedRect(x - entW / 2 + 2, y - entH / 2 + 2, entW - 4, entH - 4, 3, 3, 'F');

        // Arrow line
        const arrowLen = (isRotated90 ? entH : entW) * 0.35;
        pdf.setDrawColor(...color);
        pdf.setLineWidth(Math.max(1.5, 2 * scale));
        pdf.setLineDashPattern([4 * scale, 3 * scale], 0);

        if (isRotated90) {
          // Vertical arrow
          if (isEntry) {
            pdf.line(x, y - arrowLen, x, y + arrowLen);
          } else {
            pdf.line(x, y + arrowLen, x, y - arrowLen);
          }
        } else {
          // Horizontal arrow
          if (isEntry) {
            pdf.line(x - arrowLen, y, x + arrowLen, y);
          } else {
            pdf.line(x + arrowLen, y, x - arrowLen, y);
          }
        }
        pdf.setLineDashPattern([], 0);

        // Arrow head direction based on rotation
        pdf.setFillColor(...color);
        let arrowAngle;
        if (isRotated90) {
          arrowAngle = isEntry ? 180 : 0;
          drawTriangle(pdf, x, isEntry ? y + arrowLen : y - arrowLen, 5 * scale, arrowAngle);
        } else {
          arrowAngle = isEntry ? 90 : -90;
          drawTriangle(pdf, isEntry ? x + arrowLen : x - arrowLen, y, 5 * scale, arrowAngle);
        }

        // Label
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(Math.max(7, 9 * scale));
        pdf.setFont('helvetica', 'bold');
        pdf.text(isEntry ? 'ENTRY' : 'EXIT', x, y + 3 * scale, { align: 'center' });
      });

      // --- RAMPS ---
      ramps.forEach(el => {
        const x = offsetX + el.x * scale;
        const y = offsetY + el.y * scale;
        const rotation = el.rotation || 0;
        const isRotated90 = Math.abs(rotation) === 90 || Math.abs(rotation) === 270;

        let rampW = (el.width || 60) * scale;
        let rampH = (el.length || 100) * scale;
        if (isRotated90) {
          [rampW, rampH] = [rampH, rampW];
        }

        pdf.setFillColor(80, 50, 20);
        pdf.roundedRect(x - rampW / 2, y - rampH / 2, rampW, rampH, 4, 4, 'F');

        // Striped pattern - based on orientation
        pdf.setDrawColor(120, 80, 40);
        pdf.setLineWidth(1);
        if (isRotated90) {
          // Vertical stripes for horizontal ramp
          for (let i = 0; i < rampW; i += 8 * scale) {
            pdf.line(x - rampW / 2 + i, y - rampH / 2 + 4, x - rampW / 2 + i, y + rampH / 2 - 4);
          }
        } else {
          // Horizontal stripes for vertical ramp
          for (let i = 0; i < rampH; i += 8 * scale) {
            pdf.line(x - rampW / 2 + 4, y - rampH / 2 + i, x + rampW / 2 - 4, y - rampH / 2 + i);
          }
        }

        pdf.setTextColor(251, 191, 36);
        pdf.setFontSize(Math.max(7, 9 * scale));
        pdf.setFont('helvetica', 'bold');
        pdf.text('RAMP', x, y + 3 * scale, { align: 'center' });
      });

      // --- DEVICES ---
      levelDevices.forEach(device => {
        const x = offsetX + device.x * scale;
        const y = offsetY + device.y * scale;
        const r = Math.max(6, 10 * scale);

        // Camera view cone
        if (device.type.startsWith('cam-')) {
          const coneR = 50 * scale;
          const rot = ((device.rotation || 0) - 90) * Math.PI / 180;
          const coneAngle = 35 * Math.PI / 180;

          const x1 = x + Math.cos(rot - coneAngle) * coneR;
          const y1 = y + Math.sin(rot - coneAngle) * coneR;
          const x2 = x + Math.cos(rot + coneAngle) * coneR;
          const y2 = y + Math.sin(rot + coneAngle) * coneR;

          pdf.setFillColor(59, 130, 246);
          pdf.setGState(new pdf.GState({ opacity: 0.2 }));
          pdf.triangle(x, y, x1, y1, x2, y2, 'F');
          pdf.setGState(new pdf.GState({ opacity: 1 }));
        }

        // Device glow
        let deviceColor;
        if (device.type.startsWith('cam-')) deviceColor = [59, 130, 246];
        else if (device.type.startsWith('sensor-')) deviceColor = [245, 158, 11];
        else deviceColor = [34, 197, 94];

        // Outer glow
        pdf.setFillColor(deviceColor[0] * 0.3, deviceColor[1] * 0.3, deviceColor[2] * 0.3);
        pdf.circle(x, y, r + 3, 'F');

        // Main circle
        pdf.setFillColor(...deviceColor);
        pdf.circle(x, y, r, 'F');

        // Inner highlight
        pdf.setFillColor(Math.min(255, deviceColor[0] + 60), Math.min(255, deviceColor[1] + 60), Math.min(255, deviceColor[2] + 60));
        pdf.circle(x - r * 0.2, y - r * 0.2, r * 0.35, 'F');

        // White border
        pdf.setDrawColor(255, 255, 255);
        pdf.setLineWidth(1.5);
        pdf.circle(x, y, r, 'D');

        // Device name
        pdf.setTextColor(200, 210, 220);
        pdf.setFontSize(Math.max(6, 8 * scale));
        pdf.setFont('helvetica', 'normal');
        pdf.text(device.name, x, y + r + 12 * scale, { align: 'center' });
      });

      // === LEGEND BAR ===
      const legendY = pageHeight - legendHeight - 12;

      // Legend container
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

      // === PAGE FOOTER ===
      pdf.setFillColor(59, 130, 246);
      pdf.roundedRect(pageWidth / 2 - 30, pageHeight - 18, 60, 16, 8, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${levelIndex + 1} / ${garage.levels.length}`, pageWidth / 2, pageHeight - 7, { align: 'center' });
    }

    // Save the PDF
    pdf.save(`${garage.name.replace(/\s+/g, '_')}_Layout_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Helper function to draw triangles for arrows
  const drawTriangle = (pdf, x, y, size, rotation) => {
    const angle = rotation * Math.PI / 180;
    const points = [
      { x: 0, y: -size },
      { x: -size * 0.7, y: size * 0.5 },
      { x: size * 0.7, y: size * 0.5 }
    ];

    const rotated = points.map(p => ({
      x: x + p.x * Math.cos(angle) - p.y * Math.sin(angle),
      y: y + p.x * Math.sin(angle) + p.y * Math.cos(angle)
    }));

    pdf.triangle(rotated[0].x, rotated[0].y, rotated[1].x, rotated[1].y, rotated[2].x, rotated[2].y, 'F');
  };

  const getDeviceIcon = (type) => {
    switch (type) {
      case 'cam-dome':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        );
      case 'cam-ptz':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4" />
            <circle cx="12" cy="10" r="4" />
            <path d="M8 13l-2 6h12l-2-6" />
            <ellipse cx="12" cy="20" rx="5" ry="2" />
          </svg>
        );
      case 'cam-lpr':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 8h12l4 4v0l-4 4H4a2 2 0 01-2-2v-4a2 2 0 012-2z" />
            <circle cx="7" cy="12" r="2" />
            <path d="M20 12h2" />
          </svg>
        );
      case 'sign-designable':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M7 8h10M7 12h10M7 16h6" />
          </svg>
        );
      case 'sign-static':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="6" width="18" height="12" rx="2" />
            <path d="M8 12h8" />
          </svg>
        );
      case 'sensor-space':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <text x="12" y="15" textAnchor="middle" fontSize="10" fill="currentColor" stroke="none" fontWeight="bold">P</text>
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
    }
  };

  return (
    <div className="editor-view">
      {/* Header */}
      <header className="editor-header">
        <div className="header-left">
          <button className="back-btn" onClick={goBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="breadcrumb">
            <span className="breadcrumb-item">{garage.name}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
            <select
              className="level-dropdown"
              value={selectedLevelId}
              onChange={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedLevelId(e.target.value);
                setSelectedDevice(null);
              }}
            >
              {garage.levels.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          {garage.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(garage.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="garage-address-link"
              title="Open in Google Maps"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {garage.address}
            </a>
          )}
        </div>
        <div className="header-right">
          {/* Weather Widget */}
          {weatherData && (
            <div className="weather-widget">
              <span className="weather-icon">{getWeatherIcon(weatherData.weatherCode)}</span>
              <span className="weather-temp">{weatherData.temperature}°F</span>
              <span className="weather-details">
                💧 {weatherData.humidity}% · 💨 {weatherData.windSpeed} mph
              </span>
            </div>
          )}

          {/* Device Counts */}
          <div className="level-stats-enhanced">
            <div className="stat-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{level.totalSpots || 0} spots</span>
            </div>
            <div className="stat-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" />
              </svg>
              <span>{cameras.length} cameras</span>
            </div>
            <div className="stat-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4" />
              </svg>
              <span>{sensors.length} sensors</span>
            </div>
            <div className="stat-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 12h6" />
              </svg>
              <span>{signs.length} signs</span>
            </div>
          </div>
          <button
            className="export-btn"
            onClick={exportLayoutPDF}
            title="Export layout as PDF"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" />
              <path d="M9 15l3 3 3-3" />
            </svg>
            Export PDF
          </button>
          <button
            className={`settings-btn ${showLevelSettings ? 'active' : ''}`}
            onClick={() => setShowLevelSettings(!showLevelSettings)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Level Settings
          </button>
          <button
            className="icon-btn"
            onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          >
            {mode === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Main Editor Layout */}
      <div className="editor-layout">
        {/* Device Palette - Left Panel */}
        <aside className="device-palette">
          {/* Tabs */}
          <div className="palette-tabs">
            <button
              className={`palette-tab ${activeTab === 'cameras' ? 'active' : ''}`}
              onClick={() => { setActiveTab('cameras'); setShowAddForm(false); }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" />
              </svg>
              <span className="tab-label">Cameras</span>
              {cameras.length > 0 && <span className="tab-badge">{cameras.length}</span>}
            </button>
            <button
              className={`palette-tab ${activeTab === 'signs' ? 'active' : ''}`}
              onClick={() => { setActiveTab('signs'); setShowAddForm(false); }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 12h6" />
              </svg>
              <span className="tab-label">Signs</span>
              {signs.length > 0 && <span className="tab-badge">{signs.length}</span>}
            </button>
            <button
              className={`palette-tab ${activeTab === 'sensors' ? 'active' : ''}`}
              onClick={() => { setActiveTab('sensors'); setShowAddForm(false); }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4" />
              </svg>
              <span className="tab-label">Sensors</span>
              {sensors.length > 0 && <span className="tab-badge">{sensors.length}</span>}
            </button>
          </div>

          {/* Tab Content */}
          <div className="palette-content">
            {/* Existing Devices List */}
            {!showAddForm && (
              <>
                <div className="palette-section-header">
                  <span>{activeTab === 'cameras' ? 'Cameras' : activeTab === 'sensors' ? 'Space Sensors' : 'Signs'} on this level</span>
                  <button
                    className="add-device-btn"
                    onClick={() => {
                      // Auto-select sensor type since there's only one
                      if (activeTab === 'sensors') {
                        setNewDevice(prev => ({ ...prev, type: 'sensor-space', name: prev.name || 'Space Sensor' }));
                      }
                      setShowAddForm(true);
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add
                  </button>
                </div>

                <div className="device-list">
                  {activeTab === 'cameras' && cameras.length === 0 && (
                    <div className="empty-state">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="4" />
                      </svg>
                      <p>No cameras added yet</p>
                      <button className="btn-add-first" onClick={() => setShowAddForm(true)}>
                        Add your first camera
                      </button>
                    </div>
                  )}
                  {activeTab === 'sensors' && sensors.length === 0 && (
                    <div className="empty-state">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <text x="12" y="15" textAnchor="middle" fontSize="10" fill="currentColor" fontWeight="bold">P</text>
                      </svg>
                      <p>No space sensors added yet</p>
                      <button className="btn-add-first" onClick={() => {
                        setNewDevice(prev => ({ ...prev, type: 'sensor-space', name: prev.name || 'Space Sensor' }));
                        setShowAddForm(true);
                      }}>
                        Add your first sensor
                      </button>
                    </div>
                  )}
                  {activeTab === 'signs' && signs.length === 0 && (
                    <div className="empty-state">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M9 12h6" />
                      </svg>
                      <p>No signs added yet</p>
                      <button className="btn-add-first" onClick={() => setShowAddForm(true)}>
                        Add your first sign
                      </button>
                    </div>
                  )}

                  {activeTab === 'cameras' && cameras.map(device => (
                    <button
                      key={device.id}
                      className={`device-list-item ${selectedDevice?.id === device.id ? 'selected' : ''}`}
                      onClick={() => setSelectedDevice(device)}
                    >
                      <span className="device-list-icon">{getDeviceIcon(device.type)}</span>
                      <div className="device-list-info">
                        <span className="device-list-name">{device.name}</span>
                        <span className="device-list-meta">
                          {device.direction === 'in' ? 'Inbound' : 'Outbound'}
                          {device.rotation !== undefined && ` · ${device.rotation}°`}
                          {device.ipAddress && ` · ${device.ipAddress}`}
                        </span>
                      </div>
                      <div className="device-badges">
                        <span className={`direction-badge ${device.direction}`}>
                          {device.direction === 'in' ? '↓' : '↑'}
                        </span>
                        {device.rotation !== undefined && (
                          <span className="facing-badge">{device.rotation}°</span>
                        )}
                      </div>
                    </button>
                  ))}

                  {activeTab === 'sensors' && sensors.map(device => (
                    <button
                      key={device.id}
                      className={`device-list-item ${selectedDevice?.id === device.id ? 'selected' : ''}`}
                      onClick={() => setSelectedDevice(device)}
                    >
                      <span className="device-list-icon">{getDeviceIcon(device.type)}</span>
                      <div className="device-list-info">
                        <span className="device-list-name">{device.name}</span>
                        <span className="device-list-meta">
                          {device.spotNumber && `Spot ${device.spotNumber}`}
                          {device.parkingType && device.parkingType !== 'regular' && ` · ${device.parkingType.toUpperCase()}`}
                          {device.serialAddress && ` · ${device.serialAddress}`}
                        </span>
                      </div>
                      {device.parkingType && device.parkingType !== 'regular' && (
                        <span className={`parking-type-badge ${device.parkingType}`}>
                          {device.parkingType === 'ev' ? '⚡' : '♿'}
                        </span>
                      )}
                    </button>
                  ))}

                  {activeTab === 'signs' && signs.map(device => (
                    <button
                      key={device.id}
                      className={`device-list-item ${selectedDevice?.id === device.id ? 'selected' : ''}`}
                      onClick={() => setSelectedDevice(device)}
                    >
                      <span className="device-list-icon">{getDeviceIcon(device.type)}</span>
                      <div className="device-list-info">
                        <span className="device-list-name">{device.name}</span>
                        <span className="device-list-meta">
                          {deviceTypes.signs.find(s => s.id === device.type)?.name}
                          {device.ipAddress && ` · ${device.ipAddress}`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Add Device Form - Compact */}
            {showAddForm && (
              <div className="add-device-form-compact">
                <div className="form-header-compact">
                  <button className="back-link" onClick={() => {
                    setShowAddForm(false);
                    setNewDevice({ type: '', name: '', ipAddress: '', port: '', direction: 'in', rotation: 0, flowDestination: 'garage-entry', viewImage: null, previewUrl: '', displayMapping: [], overrideState: 'auto', serialAddress: '', spotNumber: '', parkingType: 'regular', sensorImage: null, externalUrl: '' });
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="form-title">Add {activeTab === 'cameras' ? 'Camera' : activeTab === 'sensors' ? 'Space Sensor' : 'Sign'}</span>
                </div>

                <div className="form-scroll">
                  {/* Type Selection - Hide for sensors (only one type) */}
                  {activeTab !== 'sensors' && (
                    <div className="form-section">
                      <label className="form-label-small">Type</label>
                      <div className="type-selector-compact">
                        {deviceTypes[activeTab].map(type => (
                          <button
                            key={type.id}
                            className={`type-chip ${newDevice.type === type.id ? 'selected' : ''}`}
                            onClick={() => setNewDevice({ ...newDevice, type: type.id, name: newDevice.name || type.name })}
                          >
                            {getDeviceIcon(type.id)}
                            <span>{type.name.replace(' Camera', '').replace(' Detector', '').replace(' Sensor', '').replace(' Sign', '')}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Name & IP - Compact rows */}
                  <div className="form-section">
                    <div className="compact-input-row">
                      <label>Name</label>
                      <input
                        type="text"
                        placeholder={activeTab === 'cameras' ? 'Entry Cam 1' : activeTab === 'sensors' ? 'Space Sensor 1' : 'Lobby Display'}
                        value={newDevice.name}
                        onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                      />
                    </div>
                    {activeTab !== 'sensors' && (
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
                            placeholder={activeTab === 'signs' && newDevice.type === 'sign-static' ? '10001' : '80'}
                            value={newDevice.port}
                            onChange={(e) => setNewDevice({ ...newDevice, port: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                    {activeTab === 'cameras' && (
                      <div className="compact-input-row">
                        <label>Rotation</label>
                        <div className="rotation-inline">
                          <input
                            type="number"
                            value={newDevice.rotation || 0}
                            onChange={(e) => setNewDevice({ ...newDevice, rotation: parseFloat(e.target.value) || 0 })}
                            min="0"
                            max="360"
                            step="15"
                          />
                          <span>°</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Traffic Flow - Only for cameras */}
                  {activeTab === 'cameras' && (
                    <div className="form-section">
                      <label className="form-label-small">Traffic Flow</label>
                      <p className="flow-hint">Where are cars going when detected by this device?</p>

                      <div className="flow-setup-compact">
                        <div className="flow-direction-buttons">
                          <button
                            className={`flow-btn ${newDevice.direction === 'in' ? 'active in' : ''}`}
                            onClick={() => setNewDevice({ ...newDevice, direction: 'in', flowDestination: 'garage-entry' })}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                            INTO {level.name}
                          </button>
                          <button
                            className={`flow-btn ${newDevice.direction === 'out' ? 'active out' : ''}`}
                            onClick={() => setNewDevice({ ...newDevice, direction: 'out', flowDestination: 'garage-exit' })}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            OUT OF {level.name}
                          </button>
                        </div>

                        <div className="flow-destination-row">
                          <span className="flow-context">
                            {newDevice.direction === 'in' ? 'Coming from:' : 'Going to:'}
                          </span>
                          <select
                            value={newDevice.flowDestination}
                            onChange={(e) => setNewDevice({ ...newDevice, flowDestination: e.target.value })}
                          >
                            {getFlowOptions(newDevice.direction).map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Camera View Image - Only for cameras */}
                  {activeTab === 'cameras' && (
                    <div className="form-section">
                      <label className="form-label-small">Camera View (optional)</label>
                      {newDevice.viewImage ? (
                        <div className="image-preview-small">
                          <img src={newDevice.viewImage} alt="Camera view preview" />
                          <button
                            className="remove-preview"
                            onClick={() => setNewDevice({ ...newDevice, viewImage: null })}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button className="add-image-btn" onClick={() => fileInputRef.current?.click()}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="M21 15l-5-5L5 21" />
                          </svg>
                          Add image
                        </button>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleNewDeviceImageUpload}
                      />
                    </div>
                  )}

                  {/* External URL - for cameras and signs */}
                  {(activeTab === 'cameras' || activeTab === 'signs') && (
                    <div className="form-section">
                      <label className="form-label-small">External URL (optional)</label>
                      <div className="compact-input-row">
                        <label>URL</label>
                        <input
                          type="text"
                          placeholder="https://device-admin.local/..."
                          value={newDevice.externalUrl}
                          onChange={(e) => setNewDevice({ ...newDevice, externalUrl: e.target.value })}
                        />
                      </div>
                      <p className="form-hint">Link to device admin panel or web interface</p>
                    </div>
                  )}

                  {/* Designable Sign - Preview URL */}
                  {newDevice.type === 'sign-designable' && (
                    <div className="form-section">
                      <label className="form-label-small">Design / Content</label>
                      <div className="compact-input-row">
                        <label>URL</label>
                        <input
                          type="text"
                          placeholder="https://sign-preview.example.com/..."
                          value={newDevice.previewUrl}
                          onChange={(e) => setNewDevice({ ...newDevice, previewUrl: e.target.value })}
                        />
                      </div>
                      <p className="form-hint">HTML preview URL for the sign content</p>
                    </div>
                  )}

                  {/* Static Sign - Display Mapping */}
                  {newDevice.type === 'sign-static' && (
                    <div className="form-section">
                      <label className="form-label-small">Display Mapping</label>
                      <p className="form-hint">Select which levels this sign represents</p>
                      <div className="display-mapping-list">
                        {allLevels.map(lvl => (
                          <label key={lvl.id} className="mapping-checkbox">
                            <input
                              type="checkbox"
                              checked={newDevice.displayMapping.includes(lvl.id)}
                              onChange={(e) => {
                                const updated = e.target.checked
                                  ? [...newDevice.displayMapping, lvl.id]
                                  : newDevice.displayMapping.filter(id => id !== lvl.id);
                                setNewDevice({ ...newDevice, displayMapping: updated });
                              }}
                            />
                            <span className="checkbox-mark"></span>
                            <span className="checkbox-label">{lvl.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Space Sensor - Specific fields */}
                  {activeTab === 'sensors' && (
                    <div className="form-section">
                      <label className="form-label-small">Space Configuration</label>
                      <div className="compact-input-row">
                        <label>Serial</label>
                        <input
                          type="text"
                          placeholder="SN-001234"
                          value={newDevice.serialAddress}
                          onChange={(e) => setNewDevice({ ...newDevice, serialAddress: e.target.value })}
                        />
                      </div>
                      <div className="compact-input-row">
                        <label>Spot #</label>
                        <input
                          type="text"
                          placeholder="A-101"
                          value={newDevice.spotNumber}
                          onChange={(e) => setNewDevice({ ...newDevice, spotNumber: e.target.value })}
                        />
                      </div>
                      <div className="compact-input-row">
                        <label>Type</label>
                        <div className="parking-type-buttons">
                          <button
                            className={`parking-type-btn ${newDevice.parkingType === 'regular' ? 'active' : ''}`}
                            onClick={() => setNewDevice({ ...newDevice, parkingType: 'regular' })}
                          >
                            Regular
                          </button>
                          <button
                            className={`parking-type-btn ev ${newDevice.parkingType === 'ev' ? 'active' : ''}`}
                            onClick={() => setNewDevice({ ...newDevice, parkingType: 'ev' })}
                          >
                            EV
                          </button>
                          <button
                            className={`parking-type-btn ada ${newDevice.parkingType === 'ada' ? 'active' : ''}`}
                            onClick={() => setNewDevice({ ...newDevice, parkingType: 'ada' })}
                          >
                            ADA
                          </button>
                        </div>
                      </div>
                      <div className="compact-input-row">
                        <label>Image</label>
                        {newDevice.sensorImage ? (
                          <div className="sensor-image-preview">
                            <img src={newDevice.sensorImage} alt="Sensor location" />
                            <button
                              className="remove-preview-mini"
                              onClick={() => setNewDevice({ ...newDevice, sensorImage: null })}
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button className="add-image-btn-mini" onClick={() => sensorImageRef.current?.click()}>
                            + Photo
                          </button>
                        )}
                        <input
                          ref={sensorImageRef}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                setNewDevice({ ...newDevice, sensorImage: event.target.result });
                              };
                              reader.readAsDataURL(file);
                            }
                            e.target.value = '';
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit - Fixed at bottom */}
                <div className="form-footer">
                  <button
                    className="btn-add-device"
                    onClick={addDevice}
                    disabled={!newDevice.type || !newDevice.name}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add {activeTab === 'cameras' ? 'Camera' : activeTab === 'sensors' ? 'Sensor' : 'Sign'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Canvas - Center */}
        <main className="canvas-container">
          <MapCanvas />
        </main>

        {/* Inspector - Right Panel (only when device selected) */}
        {selectedDevice && (
          <aside className="inspector-container">
            <InspectorPanel />
          </aside>
        )}
      </div>

      {/* Level Settings Modal */}
      {showLevelSettings && (
        <div className="modal-overlay" onClick={() => setShowLevelSettings(false)}>
          <div className="level-settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Level Settings</h3>
              <button className="modal-close" onClick={() => setShowLevelSettings(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Level Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={level.name || ''}
                  onChange={(e) => {
                    const updatedGarages = garages.map(g => {
                      if (g.id === selectedGarageId) {
                        return {
                          ...g,
                          levels: g.levels.map(l => l.id === selectedLevelId ? { ...l, name: e.target.value } : l)
                        };
                      }
                      return g;
                    });
                    setGarages(updatedGarages);
                  }}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Total Spots</label>
                  <input
                    type="number"
                    className="form-input"
                    value={level.totalSpots || 0}
                    onChange={(e) => {
                      const updatedGarages = garages.map(g => {
                        if (g.id === selectedGarageId) {
                          return {
                            ...g,
                            levels: g.levels.map(l => l.id === selectedLevelId ? { ...l, totalSpots: parseInt(e.target.value) || 0 } : l)
                          };
                        }
                        return g;
                      });
                      setGarages(updatedGarages);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">EV Spots</label>
                  <input
                    type="number"
                    className="form-input"
                    value={level.evSpots || 0}
                    onChange={(e) => {
                      const updatedGarages = garages.map(g => {
                        if (g.id === selectedGarageId) {
                          return {
                            ...g,
                            levels: g.levels.map(l => l.id === selectedLevelId ? { ...l, evSpots: parseInt(e.target.value) || 0 } : l)
                          };
                        }
                        return g;
                      });
                      setGarages(updatedGarages);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">ADA Spots</label>
                  <input
                    type="number"
                    className="form-input"
                    value={level.handicapSpots || 0}
                    onChange={(e) => {
                      const updatedGarages = garages.map(g => {
                        if (g.id === selectedGarageId) {
                          return {
                            ...g,
                            levels: g.levels.map(l => l.id === selectedLevelId ? { ...l, handicapSpots: parseInt(e.target.value) || 0 } : l)
                          };
                        }
                        return g;
                      });
                      setGarages(updatedGarages);
                    }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Background Image</label>
                <div className="bg-upload-area">
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const updatedGarages = garages.map(g => {
                          if (g.id === selectedGarageId) {
                            return {
                              ...g,
                              levels: g.levels.map(l => l.id === selectedLevelId ? { ...l, bgImage: event.target.result } : l)
                            };
                          }
                          return g;
                        });
                        setGarages(updatedGarages);
                      };
                      reader.readAsDataURL(file);
                    }}
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="bg-upload-modal"
                  />
                  {level.bgImage ? (
                    <div className="bg-uploaded">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <span>Image uploaded</span>
                      <button
                        className="btn-remove"
                        onClick={() => {
                          const updatedGarages = garages.map(g => {
                            if (g.id === selectedGarageId) {
                              return {
                                ...g,
                                levels: g.levels.map(l => l.id === selectedLevelId ? { ...l, bgImage: null } : l)
                              };
                            }
                            return g;
                          });
                          setGarages(updatedGarages);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <label htmlFor="bg-upload-modal" className="bg-upload-label">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                      <span>Click to upload floor plan</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditorView;
