import React, { useContext, useState, useRef } from 'react';
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
    selectedDevice,
    setSelectedDevice,
    goBack, 
    mode, 
    setMode 
  } = useContext(AppContext);

  const [activeTab, setActiveTab] = useState('cameras');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showLevelSettings, setShowLevelSettings] = useState(false);
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
    sensorImage: null
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
    setNewDevice({ type: '', name: '', ipAddress: '', port: '', direction: 'in', rotation: 0, flowDestination: 'garage-entry', viewImage: null, previewUrl: '', displayMapping: [], overrideState: 'auto', serialAddress: '', spotNumber: '', parkingType: 'regular', sensorImage: null });
    setShowAddForm(false);
  };

  // Export PDF with all levels - matches canvas dark mode style
  const exportLayoutPDF = async () => {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 30;

    for (let levelIndex = 0; levelIndex < garage.levels.length; levelIndex++) {
      const currentLevel = garage.levels[levelIndex];
      
      if (levelIndex > 0) {
        pdf.addPage();
      }

      // Dark background for entire page
      pdf.setFillColor(30, 32, 38);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');

      // Header bar
      pdf.setFillColor(45, 48, 56);
      pdf.rect(0, 0, pageWidth, 50, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(garage.name, margin, 32);
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(180, 180, 180);
      pdf.text(`${currentLevel.name} - Layout Plan`, pageWidth - margin, 32, { align: 'right' });

      // Stats bar
      pdf.setFillColor(38, 40, 48);
      pdf.rect(0, 50, pageWidth, 25, 'F');
      
      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(9);
      const levelDevices = currentLevel.devices || [];
      const cameraCount = levelDevices.filter(d => d.type.startsWith('cam-')).length;
      const sensorCount = levelDevices.filter(d => d.type.startsWith('sensor-')).length;
      const signCount = levelDevices.filter(d => d.type.startsWith('sign-')).length;
      const statsText = `Spots: ${currentLevel.totalSpots || 0}  |  EV: ${currentLevel.evSpots || 0}  |  ADA: ${currentLevel.adaSpots || 0}  |  Cameras: ${cameraCount}  |  Sensors: ${sensorCount}  |  Signs: ${signCount}`;
      pdf.text(statsText, margin, 66);
      
      const dateText = `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
      pdf.text(dateText, pageWidth - margin, 66, { align: 'right' });

      // Canvas area
      const canvasY = 85;
      const legendHeight = 70;
      const canvasHeight = pageHeight - canvasY - legendHeight - 20;
      const canvasWidth = pageWidth - margin * 2;

      // Draw canvas background (darker area)
      pdf.setFillColor(24, 26, 32);
      pdf.rect(margin, canvasY, canvasWidth, canvasHeight, 'F');

      // Draw background image if exists
      if (currentLevel.bgImage) {
        try {
          pdf.addImage(currentLevel.bgImage, 'JPEG', margin + 1, canvasY + 1, canvasWidth - 2, canvasHeight - 2);
        } catch (e) {
          // Background image failed, continue
        }
      }

      // Calculate layout bounds to properly scale
      const layoutElements = currentLevel.layoutElements || [];
      let maxX = 800, maxY = 600;
      layoutElements.forEach(el => {
        const elRight = el.x + (el.width || el.length || 100);
        const elBottom = el.y + (el.height || el.length || 100);
        maxX = Math.max(maxX, elRight + 100);
        maxY = Math.max(maxY, elBottom + 100);
      });
      
      // Scale to fit canvas area
      const scaleX = canvasWidth / maxX;
      const scaleY = canvasHeight / maxY;
      const scale = Math.min(scaleX, scaleY) * 0.95;
      const offsetX = margin + (canvasWidth - maxX * scale) / 2;
      const offsetY = canvasY + (canvasHeight - maxY * scale) / 2;

      // Draw layout elements in order: lanes first, then curves, then spots, then entrances
      const lanes = layoutElements.filter(el => el.type === 'lane');
      const curves = layoutElements.filter(el => el.type === 'curve');
      const spots = layoutElements.filter(el => el.type === 'spot');
      const entrances = layoutElements.filter(el => el.type === 'entrance');
      const ramps = layoutElements.filter(el => el.type === 'ramp');

      // Draw lanes (semi-transparent gray)
      lanes.forEach(element => {
        const x = offsetX + element.x * scale;
        const y = offsetY + element.y * scale;
        const isVertical = element.direction === 'up' || element.direction === 'down';
        const laneW = (isVertical ? (element.width || 60) : (element.length || 120)) * scale;
        const laneH = (isVertical ? (element.length || 120) : (element.width || 60)) * scale;
        
        pdf.setFillColor(80, 90, 110);
        pdf.setDrawColor(100, 110, 130);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(x - laneW/2, y - laneH/2, laneW, laneH, 3, 3, 'FD');
        
        // Draw dashed center line
        pdf.setDrawColor(150, 160, 180);
        pdf.setLineWidth(1);
        pdf.setLineDashPattern([4, 3], 0);
        if (isVertical) {
          pdf.line(x, y - laneH/2 + 10, x, y + laneH/2 - 10);
        } else {
          pdf.line(x - laneW/2 + 10, y, x + laneW/2 - 10, y);
        }
        pdf.setLineDashPattern([], 0);
        
        // Draw direction arrow
        const arrowSize = 6 * scale;
        pdf.setFillColor(150, 160, 180);
        if (element.direction === 'right') {
          drawTriangle(pdf, x + laneW/2 - 15, y, arrowSize, 90);
        } else if (element.direction === 'left') {
          drawTriangle(pdf, x - laneW/2 + 15, y, arrowSize, -90);
        } else if (element.direction === 'up') {
          drawTriangle(pdf, x, y - laneH/2 + 15, arrowSize, 0);
        } else if (element.direction === 'down') {
          drawTriangle(pdf, x, y + laneH/2 - 15, arrowSize, 180);
        }
      });

      // Draw curves
      curves.forEach(element => {
        const x = offsetX + element.x * scale;
        const y = offsetY + element.y * scale;
        const curveW = ((element.width || 60) + 20) * scale;
        const curveH = (element.height || 120) * scale;
        const isRight = element.direction === 'right';
        
        pdf.setFillColor(80, 90, 110);
        pdf.setDrawColor(100, 110, 130);
        pdf.setLineWidth(0.5);
        
        const rx = isRight ? x - (element.width || 60) * scale / 2 : x - curveW + (element.width || 60) * scale / 2;
        pdf.roundedRect(rx, y - curveH/2, curveW, curveH, curveH/4, curveH/4, 'FD');
      });

      // Draw spots with dashed outlines
      spots.forEach(element => {
        const x = offsetX + element.x * scale;
        const y = offsetY + element.y * scale;
        const spotW = (element.width || 40) * scale;
        const spotH = (element.height || 60) * scale;
        
        // Set colors based on spot type
        let fillColor, strokeColor;
        if (element.spotType === 'ev') {
          fillColor = [34, 70, 50]; // Dark green tint
          strokeColor = [34, 197, 94]; // Green
        } else if (element.spotType === 'ada') {
          fillColor = [60, 40, 80]; // Dark purple tint
          strokeColor = [168, 85, 247]; // Purple
        } else {
          fillColor = [40, 55, 80]; // Dark blue tint
          strokeColor = [59, 130, 246]; // Blue
        }
        
        // Fill with dark tinted color
        pdf.setFillColor(...fillColor);
        pdf.rect(x - spotW/2, y - spotH/2, spotW, spotH, 'F');
        
        // Dashed outline
        pdf.setDrawColor(...strokeColor);
        pdf.setLineWidth(1);
        pdf.setLineDashPattern([4, 2], 0);
        pdf.rect(x - spotW/2, y - spotH/2, spotW, spotH, 'D');
        pdf.setLineDashPattern([], 0);
        
        // EV indicator
        if (element.spotType === 'ev') {
          pdf.setTextColor(34, 197, 94);
          pdf.setFontSize(Math.max(8, 10 * scale));
          pdf.text('⚡', x - 4 * scale, y + 3 * scale);
        }
        
        // ADA indicator
        if (element.spotType === 'ada') {
          pdf.setTextColor(168, 85, 247);
          pdf.setFontSize(Math.max(8, 10 * scale));
          pdf.text('♿', x - 4 * scale, y + 3 * scale);
        }
        
        // Spot number
        if (element.spotNumber && element.spotType === 'regular') {
          pdf.setTextColor(180, 190, 200);
          pdf.setFontSize(Math.max(6, 7 * scale));
          pdf.text(element.spotNumber, x, y + spotH/2 - 5 * scale, { align: 'center' });
        }
      });

      // Draw entrances
      entrances.forEach(element => {
        const x = offsetX + element.x * scale;
        const y = offsetY + element.y * scale;
        const entW = (element.width || 60) * scale;
        const isEntry = element.direction === 'in';
        
        if (isEntry) {
          pdf.setFillColor(34, 197, 94);
        } else {
          pdf.setFillColor(239, 68, 68);
        }
        
        // Draw gate bar
        pdf.roundedRect(x - entW/2, y - 6 * scale, entW, 12 * scale, 3, 3, 'F');
        
        // Draw arrow
        const arrowLen = 20 * scale;
        pdf.setDrawColor(isEntry ? 34 : 239, isEntry ? 197 : 68, isEntry ? 94 : 68);
        pdf.setLineWidth(2);
        pdf.line(x - arrowLen, y, x + arrowLen, y);
        drawTriangle(pdf, isEntry ? x + arrowLen : x - arrowLen, y, 6 * scale, isEntry ? 90 : -90);
        
        // Label
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(Math.max(7, 9 * scale));
        pdf.setFont('helvetica', 'bold');
        pdf.text(isEntry ? 'ENTRY' : 'EXIT', x, y + 3 * scale, { align: 'center' });
        pdf.setFont('helvetica', 'normal');
      });

      // Draw ramps
      ramps.forEach(element => {
        const x = offsetX + element.x * scale;
        const y = offsetY + element.y * scale;
        const rampW = (element.width || 60) * scale;
        const rampH = (element.length || 100) * scale;
        
        pdf.setFillColor(100, 70, 40);
        pdf.roundedRect(x - rampW/2, y - rampH/2, rampW, rampH, 3, 3, 'F');
        
        pdf.setTextColor(251, 146, 60);
        pdf.setFontSize(Math.max(7, 8 * scale));
        pdf.text('RAMP', x, y + 3 * scale, { align: 'center' });
      });

      // Draw devices
      levelDevices.forEach(device => {
        const x = offsetX + device.x * scale;
        const y = offsetY + device.y * scale;
        const r = Math.max(5, 8 * scale);

        // Draw camera view cone
        if (device.type.startsWith('cam-')) {
          const coneRadius = 35 * scale;
          const rotation = ((device.rotation || 0) - 90) * Math.PI / 180;
          const coneAngle = 30 * Math.PI / 180;
          
          // Draw cone as triangle
          const x1 = x + Math.cos(rotation - coneAngle) * coneRadius;
          const y1 = y + Math.sin(rotation - coneAngle) * coneRadius;
          const x2 = x + Math.cos(rotation + coneAngle) * coneRadius;
          const y2 = y + Math.sin(rotation + coneAngle) * coneRadius;
          
          pdf.setFillColor(59, 130, 246);
          pdf.setGState(new pdf.GState({ opacity: 0.25 }));
          pdf.triangle(x, y, x1, y1, x2, y2, 'F');
          pdf.setGState(new pdf.GState({ opacity: 1 }));
        }

        // Device circle
        if (device.type.startsWith('cam-')) {
          pdf.setFillColor(59, 130, 246);
        } else if (device.type.startsWith('sensor-')) {
          pdf.setFillColor(245, 158, 11);
        } else if (device.type.startsWith('sign-')) {
          pdf.setFillColor(34, 197, 94);
        }

        // White border
        pdf.setDrawColor(255, 255, 255);
        pdf.setLineWidth(1.5);
        pdf.circle(x, y, r, 'FD');

        // Device label
        pdf.setTextColor(220, 220, 220);
        pdf.setFontSize(Math.max(6, 7 * scale));
        pdf.text(device.name, x, y + r + 10 * scale, { align: 'center' });
      });

      // Legend bar at bottom
      const legendY = pageHeight - legendHeight - 10;
      pdf.setFillColor(38, 40, 48);
      pdf.roundedRect(margin, legendY, pageWidth - margin * 2, legendHeight, 5, 5, 'F');

      pdf.setTextColor(220, 220, 220);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Legend', margin + 15, legendY + 18);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);

      // Legend items - Row 1
      let legendX = margin + 15;
      const legendItemY = legendY + 38;

      // Camera
      pdf.setFillColor(59, 130, 246);
      pdf.circle(legendX + 5, legendItemY, 5, 'F');
      pdf.setTextColor(180, 180, 180);
      pdf.text('Camera', legendX + 15, legendItemY + 3);
      legendX += 70;

      // Sensor
      pdf.setFillColor(245, 158, 11);
      pdf.circle(legendX + 5, legendItemY, 5, 'F');
      pdf.text('Sensor', legendX + 15, legendItemY + 3);
      legendX += 65;

      // Sign
      pdf.setFillColor(34, 197, 94);
      pdf.circle(legendX + 5, legendItemY, 5, 'F');
      pdf.text('Sign', legendX + 15, legendItemY + 3);
      legendX += 55;

      // Entry
      pdf.setFillColor(34, 197, 94);
      pdf.roundedRect(legendX, legendItemY - 4, 25, 8, 2, 2, 'F');
      pdf.text('Entry', legendX + 30, legendItemY + 3);
      legendX += 60;

      // Exit
      pdf.setFillColor(239, 68, 68);
      pdf.roundedRect(legendX, legendItemY - 4, 25, 8, 2, 2, 'F');
      pdf.text('Exit', legendX + 30, legendItemY + 3);
      legendX += 55;

      // Lane
      pdf.setFillColor(80, 90, 110);
      pdf.roundedRect(legendX, legendItemY - 4, 25, 8, 2, 2, 'F');
      pdf.text('Lane', legendX + 30, legendItemY + 3);
      legendX += 55;

      // Row 2 - Spot types
      legendX = margin + 15;
      const legendItemY2 = legendY + 55;

      // Regular Spot
      pdf.setFillColor(40, 55, 80);
      pdf.setDrawColor(59, 130, 246);
      pdf.setLineDashPattern([3, 2], 0);
      pdf.rect(legendX, legendItemY2 - 6, 12, 12, 'FD');
      pdf.setLineDashPattern([], 0);
      pdf.setTextColor(180, 180, 180);
      pdf.text('Regular', legendX + 18, legendItemY2 + 3);
      legendX += 65;

      // EV Spot
      pdf.setFillColor(34, 70, 50);
      pdf.setDrawColor(34, 197, 94);
      pdf.setLineDashPattern([3, 2], 0);
      pdf.rect(legendX, legendItemY2 - 6, 12, 12, 'FD');
      pdf.setLineDashPattern([], 0);
      pdf.setTextColor(34, 197, 94);
      pdf.text('⚡', legendX + 2, legendItemY2 + 3);
      pdf.setTextColor(180, 180, 180);
      pdf.text('EV', legendX + 18, legendItemY2 + 3);
      legendX += 50;

      // ADA Spot
      pdf.setFillColor(60, 40, 80);
      pdf.setDrawColor(168, 85, 247);
      pdf.setLineDashPattern([3, 2], 0);
      pdf.rect(legendX, legendItemY2 - 6, 12, 12, 'FD');
      pdf.setLineDashPattern([], 0);
      pdf.setTextColor(168, 85, 247);
      pdf.text('♿', legendX + 2, legendItemY2 + 3);
      pdf.setTextColor(180, 180, 180);
      pdf.text('ADA', legendX + 18, legendItemY2 + 3);

      // Page number
      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(9);
      pdf.text(`Page ${levelIndex + 1} of ${garage.levels.length}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
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
    switch(type) {
      case 'cam-dome':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="4"/>
          </svg>
        );
      case 'cam-ptz':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4"/>
            <circle cx="12" cy="10" r="4"/>
            <path d="M8 13l-2 6h12l-2-6"/>
            <ellipse cx="12" cy="20" rx="5" ry="2"/>
          </svg>
        );
      case 'cam-lpr':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 8h12l4 4v0l-4 4H4a2 2 0 01-2-2v-4a2 2 0 012-2z"/>
            <circle cx="7" cy="12" r="2"/>
            <path d="M20 12h2"/>
          </svg>
        );
      case 'sign-designable':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M7 8h10M7 12h10M7 16h6"/>
          </svg>
        );
      case 'sign-static':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="6" width="18" height="12" rx="2"/>
            <path d="M8 12h8"/>
          </svg>
        );
      case 'sensor-space':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
            <text x="12" y="15" textAnchor="middle" fontSize="10" fill="currentColor" stroke="none" fontWeight="bold">P</text>
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
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
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div className="breadcrumb">
            <span className="breadcrumb-item">{garage.name}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
            <span className="breadcrumb-item current">{level.name}</span>
          </div>
        </div>
        <div className="header-right">
          <div className="level-stats-mini">
            <span>{level.totalSpots} spots</span>
            <span className="divider">·</span>
            <span>{level.devices?.length || 0} devices</span>
          </div>
          <button 
            className="export-btn"
            onClick={exportLayoutPDF}
            title="Export layout as PDF"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <path d="M12 18v-6"/>
              <path d="M9 15l3 3 3-3"/>
            </svg>
            Export PDF
          </button>
          <button 
            className={`settings-btn ${showLevelSettings ? 'active' : ''}`}
            onClick={() => setShowLevelSettings(!showLevelSettings)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Level Settings
          </button>
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
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="4"/>
              </svg>
              <span className="tab-label">Cameras</span>
              {cameras.length > 0 && <span className="tab-badge">{cameras.length}</span>}
            </button>
            <button 
              className={`palette-tab ${activeTab === 'signs' ? 'active' : ''}`}
              onClick={() => { setActiveTab('signs'); setShowAddForm(false); }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M9 12h6"/>
              </svg>
              <span className="tab-label">Signs</span>
              {signs.length > 0 && <span className="tab-badge">{signs.length}</span>}
            </button>
            <button 
              className={`palette-tab ${activeTab === 'sensors' ? 'active' : ''}`}
              onClick={() => { setActiveTab('sensors'); setShowAddForm(false); }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4"/>
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
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Add
                  </button>
                </div>

                <div className="device-list">
                  {activeTab === 'cameras' && cameras.length === 0 && (
                    <div className="empty-state">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10"/>
                        <circle cx="12" cy="12" r="4"/>
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
                        <rect x="3" y="5" width="18" height="14" rx="2"/>
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
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <path d="M9 12h6"/>
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
                    setNewDevice({ type: '', name: '', ipAddress: '', port: '', direction: 'in', rotation: 0, flowDestination: 'garage-entry', viewImage: null, previewUrl: '', displayMapping: [], overrideState: 'auto', serialAddress: '', spotNumber: '', parkingType: 'regular', sensorImage: null });
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7"/>
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
                              <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                            INTO {level.name}
                          </button>
                          <button
                            className={`flow-btn ${newDevice.direction === 'out' ? 'active out' : ''}`}
                            onClick={() => setNewDevice({ ...newDevice, direction: 'out', flowDestination: 'garage-exit' })}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M19 12H5M12 19l-7-7 7-7"/>
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
                              <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button className="add-image-btn" onClick={() => fileInputRef.current?.click()}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <path d="M21 15l-5-5L5 21"/>
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
                      <path d="M12 5v14M5 12h14"/>
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
                  <path d="M18 6L6 18M6 6l12 12"/>
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
                        <path d="M20 6L9 17l-5-5"/>
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
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <label htmlFor="bg-upload-modal" className="bg-upload-label">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <path d="M21 15l-5-5L5 21"/>
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
