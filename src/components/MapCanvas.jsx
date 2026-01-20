import React, { useContext, useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Rect, Text, Group, Wedge, Line, Arrow, RegularPolygon } from 'react-konva';
import useImage from 'use-image';
import { useColorScheme } from '@mui/joy/styles';
import { AppContext } from '../App';

const GRID_SIZE = 20;

const MapCanvas = () => {
  const { 
    garages, 
    setGarages, 
    selectedGarageId, 
    selectedLevelId, 
    selectedDevice, 
    setSelectedDevice 
  } = useContext(AppContext);

  const { mode } = useColorScheme();
  const isDark = mode === 'dark';

  const garage = garages.find(g => g.id === selectedGarageId);
  const currentLevel = garage?.levels.find(l => l.id === selectedLevelId);
  const [bgImg] = useImage(currentLevel?.bgImage);
  
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedLayoutElement, setSelectedLayoutElement] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [activeTool, setActiveTool] = useState(null); // null, 'entrance', 'lane', 'spot', 'ramp'

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Snap to grid function
  const snapToGrid = (value) => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  // Smart snap - finds nearby elements and snaps to their edges, also sets rotation
  const smartSnap = (x, y, currentElementId, currentType) => {
    const layoutElements = currentLevel?.layoutElements || [];
    const SNAP_THRESHOLD = 40; // Distance to trigger smart snap
    
    let snapX = snapToGrid(x);
    let snapY = snapToGrid(y);
    let snapRotation = null; // null means don't change rotation
    
    // Get dimensions of current element type
    const getCurrentDimensions = () => {
      switch(currentType) {
        case 'spot': return { w: 40, h: 60 };
        case 'lane': return { w: 60, h: 200 };
        case 'curve': return { w: 80, h: 160 };
        case 'entrance': return { w: 80, h: 30 };
        case 'ramp': return { w: 60, h: 100 };
        default: return { w: 40, h: 40 };
      }
    };
    
    const current = getCurrentDimensions();
    
    // Find elements
    const lanes = layoutElements.filter(el => el.type === 'lane' && el.id !== currentElementId);
    const spots = layoutElements.filter(el => el.type === 'spot' && el.id !== currentElementId);
    
    if (currentType === 'spot') {
      let bestSnap = null;
      let bestDistance = Infinity;
      
      // Find the closest lane edge to snap to
      for (const lane of lanes) {
        const laneW = lane.width || 60;
        const laneLen = lane.length || 200;
        const isVertical = lane.direction === 'up' || lane.direction === 'down';
        
        if (!isVertical) { // Horizontal lane (left/right direction)
          const laneHalfW = laneLen / 2;
          const laneHalfH = laneW / 2;
          
          // Check if x is within lane's horizontal span
          if (x >= lane.x - laneHalfW - current.w && x <= lane.x + laneHalfW + current.w) {
            // Top edge of lane - spots face down (rotation 180)
            const topY = lane.y - laneHalfH - current.h / 2;
            const topDist = Math.abs(y - topY);
            if (topDist < SNAP_THRESHOLD && topDist < bestDistance) {
              bestDistance = topDist;
              bestSnap = { y: topY, rotation: 180, laneX: lane.x, laneHalfW };
            }
            
            // Bottom edge of lane - spots face up (rotation 0)
            const bottomY = lane.y + laneHalfH + current.h / 2;
            const bottomDist = Math.abs(y - bottomY);
            if (bottomDist < SNAP_THRESHOLD && bottomDist < bestDistance) {
              bestDistance = bottomDist;
              bestSnap = { y: bottomY, rotation: 0, laneX: lane.x, laneHalfW };
            }
          }
        } else { // Vertical lane (up/down direction)
          const laneHalfW = laneW / 2;
          const laneHalfH = laneLen / 2;
          
          // Check if y is within lane's vertical span
          if (y >= lane.y - laneHalfH - current.h && y <= lane.y + laneHalfH + current.h) {
            // Left edge of lane - spots face right (rotation 90)
            const leftX = lane.x - laneHalfW - current.w / 2;
            const leftDist = Math.abs(x - leftX);
            if (leftDist < SNAP_THRESHOLD && leftDist < bestDistance) {
              bestDistance = leftDist;
              bestSnap = { x: leftX, rotation: 90, laneY: lane.y, laneHalfH };
            }
            
            // Right edge of lane - spots face left (rotation -90)
            const rightX = lane.x + laneHalfW + current.w / 2;
            const rightDist = Math.abs(x - rightX);
            if (rightDist < SNAP_THRESHOLD && rightDist < bestDistance) {
              bestDistance = rightDist;
              bestSnap = { x: rightX, rotation: -90, laneY: lane.y, laneHalfH };
            }
          }
        }
      }
      
      if (bestSnap) {
        if (bestSnap.y !== undefined) snapY = bestSnap.y;
        if (bestSnap.x !== undefined) snapX = bestSnap.x;
        snapRotation = bestSnap.rotation;
      }
      
      // Snap spots to align with other spots (same row/column)
      for (const spot of spots) {
        const spotW = spot.width || 40;
        
        // If same row (similar Y), align and snap adjacent
        if (Math.abs(snapY - spot.y) < SNAP_THRESHOLD / 2) {
          snapY = spot.y;
          
          // Snap to be adjacent horizontally
          const rightOfSpot = spot.x + spotW;
          const leftOfSpot = spot.x - spotW;
          
          if (Math.abs(x - rightOfSpot) < SNAP_THRESHOLD) {
            snapX = rightOfSpot;
          } else if (Math.abs(x - leftOfSpot) < SNAP_THRESHOLD) {
            snapX = leftOfSpot;
          }
          
          // Copy rotation from adjacent spot
          if (snapRotation === null) {
            snapRotation = spot.rotation || 0;
          }
        }
        
        // If same column (similar X), align vertically
        if (Math.abs(snapX - spot.x) < SNAP_THRESHOLD / 2) {
          snapX = spot.x;
        }
      }
    }
    
    if (currentType === 'lane') {
      // Snap lanes to align with other lanes (parallel stacking)
      for (const lane of lanes) {
        const laneW = lane.width || 60;
        const laneLen = lane.length || 200;
        const isVertical = lane.direction === 'up' || lane.direction === 'down';
        
        if (!isVertical) {
          // Align X centers
          if (Math.abs(x - lane.x) < SNAP_THRESHOLD) {
            snapX = lane.x;
          }
          
          // Stack below with proper spacing (lane width + 2 spot heights + gap)
          const stackDistance = laneW + 60 * 2 + 40; // lane + spots on both sides + gap
          const belowY = lane.y + stackDistance;
          if (Math.abs(y - belowY) < SNAP_THRESHOLD) {
            snapY = belowY;
          }
        }
      }
    }
    
    // Final grid snap
    snapX = snapToGrid(snapX);
    snapY = snapToGrid(snapY);
    
    return { x: snapX, y: snapY, rotation: snapRotation };
  };

  const updateDevice = (deviceId, updates) => {
    const updatedGarages = garages.map(g => {
      if (g.id === selectedGarageId) {
        return {
          ...g,
          levels: g.levels.map(l => {
            if (l.id === selectedLevelId) {
              return {
                ...l,
                devices: l.devices.map(d => d.id === deviceId ? { ...d, ...updates } : d)
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

  const updateLayoutElement = (elementId, updates) => {
    const updatedGarages = garages.map(g => {
      if (g.id === selectedGarageId) {
        return {
          ...g,
          levels: g.levels.map(l => {
            if (l.id === selectedLevelId) {
              return {
                ...l,
                layoutElements: (l.layoutElements || []).map(el => 
                  el.id === elementId ? { ...el, ...updates } : el
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
    // Update local selected element state too
    if (selectedLayoutElement?.id === elementId) {
      setSelectedLayoutElement(prev => ({ ...prev, ...updates }));
    }
  };

  const addLayoutElement = (type, x, y) => {
    // Use smart snap to align with existing elements
    const snapped = smartSnap(x, y, null, type);
    
    const newElement = {
      id: `layout-${Date.now()}`,
      type,
      x: snapped.x,
      y: snapped.y,
      rotation: snapped.rotation !== null ? snapped.rotation : 0,
      // Dimensions match auto-mapper for consistency
      ...(type === 'spot' && { spotType: 'regular', width: 40, height: 60 }),
      ...(type === 'lane' && { width: 60, length: 200, direction: 'right' }),
      ...(type === 'entrance' && { direction: 'in', width: 80 }),
      ...(type === 'ramp' && { width: 60, length: 100, targetLevel: null }),
      ...(type === 'curve' && { width: 60, height: 160, direction: 'right' })
    };

    const updatedGarages = garages.map(g => {
      if (g.id === selectedGarageId) {
        return {
          ...g,
          levels: g.levels.map(l => {
            if (l.id === selectedLevelId) {
              return {
                ...l,
                layoutElements: [...(l.layoutElements || []), newElement]
              };
            }
            return l;
          })
        };
      }
      return g;
    });
    setGarages(updatedGarages);
    setSelectedLayoutElement(newElement);
    setActiveTool(null);
  };

  const deleteLayoutElement = (elementId) => {
    const updatedGarages = garages.map(g => {
      if (g.id === selectedGarageId) {
        return {
          ...g,
          levels: g.levels.map(l => {
            if (l.id === selectedLevelId) {
              return {
                ...l,
                layoutElements: (l.layoutElements || []).filter(el => el.id !== elementId)
              };
            }
            return l;
          })
        };
      }
      return g;
    });
    setGarages(updatedGarages);
    setSelectedLayoutElement(null);
  };

  const handleDeviceDragEnd = (id, e) => {
    const snappedX = snapToGrid(e.target.x());
    const snappedY = snapToGrid(e.target.y());
    e.target.x(snappedX);
    e.target.y(snappedY);
    updateDevice(id, { x: snappedX, y: snappedY });
  };

  const handleLayoutDragEnd = (id, e) => {
    // Find current element to get its type
    const element = (currentLevel?.layoutElements || []).find(el => el.id === id);
    const elementType = element?.type || 'spot';
    
    // Use smart snap for intelligent alignment and auto-rotation
    const snapped = smartSnap(e.target.x(), e.target.y(), id, elementType);
    e.target.x(snapped.x);
    e.target.y(snapped.y);
    
    const updates = { x: snapped.x, y: snapped.y };
    // Apply rotation if smart snap determined one
    if (snapped.rotation !== null) {
      updates.rotation = snapped.rotation;
      e.target.rotation(snapped.rotation);
    }
    updateLayoutElement(id, updates);
  };

  const handleStageClick = (e) => {
    // Check if clicking on empty area (stage or background rect)
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.attrs?.name === 'background';
    
    if (clickedOnEmpty) {
      if (activeTool) {
        const stage = e.target.getStage();
        const pos = stage.getPointerPosition();
        addLayoutElement(activeTool, pos.x, pos.y);
      } else {
        setSelectedDevice(null);
        setSelectedLayoutElement(null);
      }
    }
  };

  const autoCreateSpots = () => {
    // Get spot counts from level settings
    const totalSpots = currentLevel?.totalSpots || 150;
    const evSpots = currentLevel?.evSpots || 0;
    const adaSpots = currentLevel?.adaSpots || 0;
    
    // Layout dimensions - all divisible by GRID_SIZE (20) for proper snapping
    const spotWidth = 40;  // 2 grid units
    const spotHeight = 60; // 3 grid units  
    const laneWidth = 60;  // 3 grid units
    const margin = 100;    // 5 grid units - extra space for curves
    const aisleGap = 40;   // 2 grid units between aisles
    const curveSpace = 80; // Extra space at ends for curves
    
    // Calculate layout - double-loaded aisle (spots on both sides of lane)
    const aisleHeight = spotHeight + laneWidth + spotHeight; // 180
    const usableWidth = dimensions.width - margin * 2 - curveSpace; // Leave room for curves
    const spotsPerAisleSide = Math.floor(usableWidth / spotWidth);
    const spotsPerAisle = spotsPerAisleSide * 2; // Both sides
    const aislesNeeded = Math.ceil(totalSpots / spotsPerAisle);
    
    // Calculate required canvas dimensions
    const requiredHeight = margin + (aislesNeeded * aisleHeight) + ((aislesNeeded - 1) * aisleGap) + margin;
    const canvasHeight = Math.max(dimensions.height, requiredHeight);
    
    const newElements = [];
    let spotCount = 0;
    let evAssigned = 0;
    let adaAssigned = 0;
    const timestamp = Date.now();
    
    // Entry point - at the left side
    newElements.push({
      id: `layout-${timestamp}-entry`,
      type: 'entrance',
      x: 40,
      y: margin + spotHeight + laneWidth / 2,
      rotation: 90,
      direction: 'in',
      width: 60
    });
    
    // Create aisles
    for (let aisle = 0; aisle < aislesNeeded && spotCount < totalSpots; aisle++) {
      const aisleY = margin + aisle * (aisleHeight + aisleGap);
      const isLastAisle = aisle === aislesNeeded - 1;
      const laneDirection = aisle % 2 === 0 ? 'right' : 'left';
      
      // Top row of spots (facing down into the aisle)
      for (let i = 0; i < spotsPerAisleSide && spotCount < totalSpots; i++) {
        const spotX = margin + i * spotWidth + spotWidth / 2;
        
        let spotType = 'regular';
        if (adaAssigned < adaSpots && aisle === 0 && i < 4) {
          spotType = 'ada'; // ADA spots near entrance
          adaAssigned++;
        } else if (evAssigned < evSpots) {
          spotType = 'ev';
          evAssigned++;
        }
        
        spotCount++;
        newElements.push({
          id: `layout-${timestamp}-A${aisle}-T${i}`,
          type: 'spot',
          x: spotX,
          y: aisleY + spotHeight / 2,
          rotation: 180,
          spotType,
          width: spotWidth,
          height: spotHeight,
          spotNumber: `${spotCount}`
        });
      }
      
      // Driving lane - extends to edges for curves
      const laneLength = usableWidth + curveSpace;
      const laneX = margin + usableWidth / 2;
      newElements.push({
        id: `layout-${timestamp}-lane-${aisle}`,
        type: 'lane',
        x: laneX,
        y: aisleY + spotHeight + laneWidth / 2,
        direction: laneDirection,
        width: laneWidth,
        length: laneLength
      });
      
      // Bottom row of spots (facing up into the aisle)
      for (let i = 0; i < spotsPerAisleSide && spotCount < totalSpots; i++) {
        const spotX = margin + i * spotWidth + spotWidth / 2;
        
        let spotType = 'regular';
        if (evAssigned < evSpots) {
          spotType = 'ev';
          evAssigned++;
        }
        
        spotCount++;
        newElements.push({
          id: `layout-${timestamp}-A${aisle}-B${i}`,
          type: 'spot',
          x: spotX,
          y: aisleY + spotHeight + laneWidth + spotHeight / 2,
          rotation: 0,
          spotType,
          width: spotWidth,
          height: spotHeight,
          spotNumber: `${spotCount}`
        });
      }
      
      // Add turnaround curve at the end of each aisle (except the last)
      if (!isLastAisle) {
        // Curve spans from bottom of current aisle to top of next aisle
        const curveHeight = aisleGap + spotHeight * 2;
        const curveX = aisle % 2 === 0 
          ? margin + usableWidth + curveSpace / 2
          : margin - curveSpace / 2;
        const curveY = aisleY + aisleHeight + aisleGap / 2;
        
        newElements.push({
          id: `layout-${timestamp}-curve-${aisle}`,
          type: 'curve',
          x: curveX,
          y: curveY,
          rotation: 0,
          width: laneWidth,
          height: curveHeight,
          direction: aisle % 2 === 0 ? 'right' : 'left'
        });
      }
    }
    
    // Exit point - at the opposite end from entry
    const lastAisleIndex = aislesNeeded - 1;
    const exitY = margin + lastAisleIndex * (aisleHeight + aisleGap) + spotHeight + laneWidth / 2;
    const exitX = lastAisleIndex % 2 === 0 
      ? margin + usableWidth + curveSpace + 20
      : 40;
    
    newElements.push({
      id: `layout-${timestamp}-exit`,
      type: 'entrance',
      x: exitX,
      y: exitY,
      rotation: lastAisleIndex % 2 === 0 ? 90 : -90,
      direction: 'out',
      width: 60
    });
    
    const updatedGarages = garages.map(g => {
      if (g.id === selectedGarageId) {
        return {
          ...g,
          levels: g.levels.map(l => {
            if (l.id === selectedLevelId) {
              return {
                ...l,
                layoutElements: [...newElements],
                canvasHeight: canvasHeight // Store calculated height
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

  const getDeviceColor = (type) => {
    if (type.startsWith('cam-')) return '#3b82f6';
    if (type.startsWith('sensor-')) return '#f59e0b';
    if (type.startsWith('sign-')) return '#22c55e';
    return '#6b7280';
  };

  const getConeRotation = (rotation) => {
    return (rotation || 0) - 30;
  };

  // Render grid
  const renderGrid = () => {
    if (!showGrid) return null;
    const lines = [];
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    
    // Vertical lines
    for (let x = 0; x <= dimensions.width; x += GRID_SIZE) {
      lines.push(
        <Line
          key={`v-${x}`}
          points={[x, 0, x, dimensions.height]}
          stroke={gridColor}
          strokeWidth={1}
          listening={false}
        />
      );
    }
    // Horizontal lines
    const canvasHeight = Math.max(dimensions.height, currentLevel?.canvasHeight || dimensions.height);
    for (let y = 0; y <= canvasHeight; y += GRID_SIZE) {
      lines.push(
        <Line
          key={`h-${y}`}
          points={[0, y, dimensions.width, y]}
          stroke={gridColor}
          strokeWidth={1}
          listening={false}
        />
      );
    }
    return lines;
  };

  // Render entrance
  const renderEntrance = (element) => {
    const isSelected = selectedLayoutElement?.id === element.id;
    const isEntry = element.direction === 'in';
    const color = isEntry ? '#22c55e' : '#ef4444';
    
    return (
      <Group
        key={element.id}
        x={element.x}
        y={element.y}
        rotation={element.rotation || 0}
        draggable
        onDragEnd={(e) => handleLayoutDragEnd(element.id, e)}
        onClick={(e) => {
          e.cancelBubble = true;
          setSelectedLayoutElement(element);
          setSelectedDevice(null);
        }}
      >
        {/* Gate/entrance bar */}
        <Rect
          x={-element.width / 2}
          y={-8}
          width={element.width}
          height={16}
          fill={color}
          stroke={isSelected ? '#fff' : 'rgba(255,255,255,0.3)'}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={4}
          shadowColor="black"
          shadowBlur={isSelected ? 8 : 4}
          shadowOpacity={0.3}
        />
        {/* Direction arrow */}
        <Arrow
          points={isEntry ? [0, -30, 0, 20] : [0, 20, 0, -30]}
          fill={color}
          stroke={color}
          strokeWidth={3}
          pointerLength={10}
          pointerWidth={10}
        />
        {/* Label */}
        <Text
          text={isEntry ? 'ENTRY' : 'EXIT'}
          x={-20}
          y={25}
          fontSize={11}
          fill={isDark ? '#fff' : '#333'}
          fontStyle="bold"
        />
      </Group>
    );
  };

  // Render lane
  const renderLane = (element) => {
    const isSelected = selectedLayoutElement?.id === element.id;
    const laneColor = isDark ? 'rgba(100, 116, 139, 0.5)' : 'rgba(148, 163, 184, 0.6)';
    const arrowColor = isDark ? '#94a3b8' : '#64748b';
    
    // Direction to arrow points
    const getArrowPoints = () => {
      const len = element.length || 120;
      switch (element.direction) {
        case 'up': return [0, len/2, 0, -len/2];
        case 'down': return [0, -len/2, 0, len/2];
        case 'left': return [len/2, 0, -len/2, 0];
        case 'right': return [-len/2, 0, len/2, 0];
        default: return [0, len/2, 0, -len/2];
      }
    };

    const isVertical = element.direction === 'up' || element.direction === 'down';
    const w = isVertical ? (element.width || 60) : (element.length || 120);
    const h = isVertical ? (element.length || 120) : (element.width || 60);

    return (
      <Group
        key={element.id}
        x={element.x}
        y={element.y}
        draggable
        onDragEnd={(e) => handleLayoutDragEnd(element.id, e)}
        onClick={(e) => {
          e.cancelBubble = true;
          setSelectedLayoutElement(element);
          setSelectedDevice(null);
        }}
      >
        {/* Lane surface */}
        <Rect
          x={-w/2}
          y={-h/2}
          width={w}
          height={h}
          fill={laneColor}
          stroke={isSelected ? '#3b82f6' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={4}
        />
        {/* Direction arrow */}
        <Arrow
          points={getArrowPoints()}
          fill={arrowColor}
          stroke={arrowColor}
          strokeWidth={2}
          pointerLength={12}
          pointerWidth={12}
          dash={[8, 4]}
        />
      </Group>
    );
  };

  // Render parking spot
  const renderSpot = (element) => {
    const isSelected = selectedLayoutElement?.id === element.id;
    const spotColors = {
      regular: { fill: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.15)', stroke: '#3b82f6' },
      ev: { fill: isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.15)', stroke: '#22c55e' },
      ada: { fill: isDark ? 'rgba(168, 85, 247, 0.2)' : 'rgba(168, 85, 247, 0.15)', stroke: '#a855f7' }
    };
    const colors = spotColors[element.spotType] || spotColors.regular;
    
    return (
      <Group
        key={element.id}
        x={element.x}
        y={element.y}
        rotation={element.rotation || 0}
        draggable
        onDragEnd={(e) => handleLayoutDragEnd(element.id, e)}
        onClick={(e) => {
          e.cancelBubble = true;
          setSelectedLayoutElement(element);
          setSelectedDevice(null);
        }}
      >
        {/* Spot outline */}
        <Rect
          x={-(element.width || 40) / 2}
          y={-(element.height || 60) / 2}
          width={element.width || 40}
          height={element.height || 60}
          fill={colors.fill}
          stroke={isSelected ? '#fff' : colors.stroke}
          strokeWidth={isSelected ? 2 : 1.5}
          dash={[6, 3]}
        />
        {/* Spot type indicator */}
        {element.spotType === 'ev' && (
          <Text
            text="⚡"
            fontSize={16}
            offsetX={6}
            offsetY={8}
          />
        )}
        {element.spotType === 'ada' && (
          <Text
            text="♿"
            fontSize={16}
            offsetX={8}
            offsetY={8}
          />
        )}
        {element.spotNumber && (
          <Text
            text={element.spotNumber}
            fontSize={10}
            fill={isDark ? '#fff' : '#333'}
            offsetX={element.spotNumber.length * 3}
            y={(element.height || 60) / 2 - 15}
          />
        )}
      </Group>
    );
  };

  // Render ramp
  const renderRamp = (element) => {
    const isSelected = selectedLayoutElement?.id === element.id;
    const rampColor = isDark ? 'rgba(251, 146, 60, 0.4)' : 'rgba(251, 146, 60, 0.3)';
    
    return (
      <Group
        key={element.id}
        x={element.x}
        y={element.y}
        rotation={element.rotation || 0}
        draggable
        onDragEnd={(e) => handleLayoutDragEnd(element.id, e)}
        onClick={(e) => {
          e.cancelBubble = true;
          setSelectedLayoutElement(element);
          setSelectedDevice(null);
        }}
      >
        {/* Ramp surface with gradient effect */}
        <Rect
          x={-(element.width || 60) / 2}
          y={-(element.length || 100) / 2}
          width={element.width || 60}
          height={element.length || 100}
          fill={rampColor}
          stroke={isSelected ? '#fff' : '#fb923c'}
          strokeWidth={isSelected ? 2 : 1.5}
          cornerRadius={4}
        />
        {/* Ramp stripes */}
        {[0, 1, 2, 3, 4].map(i => (
          <Line
            key={i}
            points={[
              -(element.width || 60) / 2 + 8, 
              -(element.length || 100) / 2 + 15 + i * 18, 
              (element.width || 60) / 2 - 8, 
              -(element.length || 100) / 2 + 15 + i * 18
            ]}
            stroke={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}
            strokeWidth={2}
          />
        ))}
        {/* Arrow indicator */}
        <RegularPolygon
          y={-(element.length || 100) / 2 + 8}
          sides={3}
          radius={8}
          fill="#fb923c"
          rotation={0}
        />
        {/* Label */}
        <Text
          text="RAMP"
          x={-16}
          y={(element.length || 100) / 2 - 18}
          fontSize={10}
          fill={isDark ? '#fff' : '#333'}
          fontStyle="bold"
        />
      </Group>
    );
  };

  // Render curve (for turnarounds between aisles)
  const renderCurve = (element) => {
    const isSelected = selectedLayoutElement?.id === element.id;
    const curveColor = isDark ? 'rgba(100, 116, 139, 0.5)' : 'rgba(148, 163, 184, 0.6)';
    const strokeColor = isDark ? 'rgba(148, 163, 184, 0.8)' : 'rgba(100, 116, 139, 0.8)';
    const w = element.width || 60; // Width of the curve (matches lane width)
    const h = element.height || 120; // Height to span between aisles
    const isRight = element.direction === 'right';
    
    // For a proper U-turn, we need the curved end piece
    const curveW = w + 20; // Extra width for the curve
    
    return (
      <Group
        key={element.id}
        x={element.x}
        y={element.y}
        rotation={element.rotation || 0}
        draggable
        onDragEnd={(e) => handleLayoutDragEnd(element.id, e)}
        onClick={(e) => {
          e.cancelBubble = true;
          setSelectedLayoutElement(element);
          setSelectedDevice(null);
        }}
      >
        {/* Simple rounded rectangle for the turn */}
        <Rect
          x={isRight ? -w/2 : -curveW + w/2}
          y={-h / 2}
          width={curveW}
          height={h}
          fill={curveColor}
          stroke={isSelected ? '#fff' : strokeColor}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={isRight ? [0, h/2, h/2, 0] : [h/2, 0, 0, h/2]}
        />
        {/* Dashed center line showing the path */}
        <Line
          points={isRight 
            ? [0, -h/2 + w/2, curveW/2 - w/2, -h/2 + w/2 + 10, curveW/2 - w/2, h/2 - w/2 - 10, 0, h/2 - w/2]
            : [0, -h/2 + w/2, -(curveW/2 - w/2), -h/2 + w/2 + 10, -(curveW/2 - w/2), h/2 - w/2 - 10, 0, h/2 - w/2]
          }
          stroke={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.25)'}
          strokeWidth={2}
          dash={[6, 4]}
          tension={0.4}
          listening={false}
        />
      </Group>
    );
  };

  // Render device (cameras, sensors, signs)
  const renderDevice = (device) => {
    const isSelected = selectedDevice?.id === device.id;
    const isCamera = device.type.startsWith('cam-');
    const color = getDeviceColor(device.type);
    const coneRotation = getConeRotation(device.rotation);
    
    return (
      <Group
        key={device.id}
        x={device.x}
        y={device.y}
        draggable
        onDragStart={(e) => {
          // Bring device to front when dragging
          e.target.moveToTop();
        }}
        onDragEnd={(e) => handleDeviceDragEnd(device.id, e)}
        onClick={(e) => {
          e.cancelBubble = true;
          setSelectedDevice(device);
          setSelectedLayoutElement(null);
        }}
        onMouseEnter={(e) => {
          e.target.getStage().container().style.cursor = 'grab';
        }}
        onMouseLeave={(e) => {
          e.target.getStage().container().style.cursor = activeTool ? 'crosshair' : 'default';
        }}
      >
        {/* Larger hit area for easier clicking/dragging */}
        <Circle
          radius={20}
          fill="transparent"
          listening={true}
        />
        {isCamera && (
          <Wedge
            rotation={coneRotation}
            angle={60}
            radius={isSelected ? 50 : 40}
            fill={color}
            opacity={isSelected ? 0.25 : 0.15}
            listening={false}
          />
        )}
        
        <Circle
          radius={isSelected ? 14 : 10}
          fill={color}
          stroke={isSelected ? '#fff' : 'rgba(255,255,255,0.3)'}
          strokeWidth={isSelected ? 2 : 1}
          shadowColor="black"
          shadowBlur={isSelected ? 10 : 4}
          shadowOpacity={0.4}
        />
        
        {device.type === 'cam-lpr' && (
          <Rect x={-3} y={-2} width={6} height={4} fill="rgba(255,255,255,0.8)" cornerRadius={1} />
        )}
        {device.type === 'cam-ptz' && (
          <Circle radius={4} fill="rgba(255,255,255,0.8)" />
        )}
        {device.type === 'cam-dome' && (
          <Circle radius={5} stroke="rgba(255,255,255,0.8)" strokeWidth={1.5} fill="transparent" />
        )}
        
        {device.type === 'sign-designable' && (
          <Text text="D" fontSize={10} fill="white" fontStyle="bold" offsetX={3} offsetY={5} />
        )}
        {device.type === 'sign-static' && (
          <Text text="S" fontSize={10} fill="white" fontStyle="bold" offsetX={3} offsetY={5} />
        )}
        
        {device.type === 'sensor-space' && (
          <>
            <Text text="P" fontSize={11} fill="white" fontStyle="bold" offsetX={4} offsetY={5} />
            {device.parkingType === 'ev' && (
              <Circle x={8} y={-8} radius={5} fill="#22c55e" stroke="white" strokeWidth={1} />
            )}
            {device.parkingType === 'ada' && (
              <Circle x={8} y={-8} radius={5} fill="#3b82f6" stroke="white" strokeWidth={1} />
            )}
          </>
        )}
      </Group>
    );
  };

  // Render layout element based on type
  const renderLayoutElement = (element) => {
    switch (element.type) {
      case 'entrance': return renderEntrance(element);
      case 'lane': return renderLane(element);
      case 'spot': return renderSpot(element);
      case 'ramp': return renderRamp(element);
      case 'curve': return renderCurve(element);
      default: return null;
    }
  };

  if (!currentLevel) {
    return (
      <div className="map-canvas-wrapper" ref={containerRef}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          color: 'var(--joy-palette-neutral-400)',
          fontSize: 14
        }}>
          No level selected
        </div>
      </div>
    );
  }

  return (
    <div className="map-canvas-wrapper" ref={containerRef} style={{ overflow: 'auto' }}>
      {/* Layout Toolbar */}
      <div className="layout-toolbar">
        <button
          className={`layout-tool-btn ${activeTool === 'entrance' ? 'active' : ''}`}
          onClick={() => setActiveTool(activeTool === 'entrance' ? null : 'entrance')}
          title="Add Entrance/Exit"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
        <button
          className={`layout-tool-btn ${activeTool === 'lane' ? 'active' : ''}`}
          onClick={() => setActiveTool(activeTool === 'lane' ? null : 'lane')}
          title="Add Lane"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14"/>
            <path d="M5 12h14"/>
            <path d="M12 5l-3 3"/>
            <path d="M12 5l3 3"/>
          </svg>
        </button>
        <button
          className={`layout-tool-btn ${activeTool === 'spot' ? 'active' : ''}`}
          onClick={() => setActiveTool(activeTool === 'spot' ? null : 'spot')}
          title="Add Parking Spot"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
            <text x="12" y="16" textAnchor="middle" fontSize="10" fill="currentColor" stroke="none" fontWeight="bold">P</text>
          </svg>
        </button>
        <button
          className={`layout-tool-btn ${activeTool === 'curve' ? 'active' : ''}`}
          onClick={() => setActiveTool(activeTool === 'curve' ? null : 'curve')}
          title="Add Curve"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 12a8 8 0 0 1 8-8"/>
            <path d="M12 4l-3 3"/>
            <path d="M12 4l3 3"/>
          </svg>
        </button>
        <button
          className={`layout-tool-btn ${activeTool === 'ramp' ? 'active' : ''}`}
          onClick={() => setActiveTool(activeTool === 'ramp' ? null : 'ramp')}
          title="Add Ramp"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 20L20 4"/>
            <path d="M20 4v8"/>
            <path d="M20 4h-8"/>
          </svg>
        </button>
        <div className="toolbar-divider" />
        <button
          className={`layout-tool-btn ${showGrid ? 'active' : ''}`}
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle Grid"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
            <line x1="15" y1="3" x2="15" y2="21"/>
          </svg>
        </button>
        <div className="toolbar-divider" />
        <button
          className="layout-tool-btn auto-create"
          onClick={autoCreateSpots}
          title="Auto Create Layout"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </button>
        {selectedLayoutElement && (
          <>
            <div className="toolbar-divider" />
            <button
              className="layout-tool-btn delete"
              onClick={() => deleteLayoutElement(selectedLayoutElement.id)}
              title="Delete Selected"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Active Tool Indicator */}
      {activeTool && (
        <div className="tool-indicator">
          Click on canvas to place {activeTool}
        </div>
      )}

      <Stage
        width={dimensions.width}
        height={Math.max(dimensions.height, currentLevel.canvasHeight || dimensions.height)}
        onClick={handleStageClick}
        style={{ cursor: activeTool ? 'crosshair' : 'default' }}
      >
        <Layer>
          {/* Background */}
          {bgImg && <KonvaImage image={bgImg} />}
          {!bgImg && (
            <Rect 
              name="background"
              width={dimensions.width} 
              height={Math.max(dimensions.height, currentLevel.canvasHeight || dimensions.height)}
              fill={isDark ? '#1a1a1c' : '#f4f4f5'}
            />
          )}
          {bgImg && (
            <Rect 
              name="background"
              width={dimensions.width} 
              height={Math.max(dimensions.height, currentLevel.canvasHeight || dimensions.height)}
              fill="transparent"
            />
          )}
          
          {/* Grid */}
          {renderGrid()}
          
          {/* Layout Elements (rendered below devices) */}
          {currentLevel.layoutElements?.map(element => renderLayoutElement(element))}
          
          {/* Devices (rendered on top) */}
          {currentLevel.devices?.map(device => renderDevice(device))}
        </Layer>
      </Stage>

      {/* Selected Layout Element Properties */}
      {selectedLayoutElement && (
        <div className="layout-properties-panel">
          <div className="layout-props-header">
            <span>{selectedLayoutElement.type.charAt(0).toUpperCase() + selectedLayoutElement.type.slice(1)} Properties</span>
            <button onClick={() => setSelectedLayoutElement(null)}>×</button>
          </div>
          <div className="layout-props-body">
            {selectedLayoutElement.type === 'entrance' && (
              <div className="prop-row">
                <label>Direction</label>
                <div className="prop-buttons">
                  <button 
                    className={selectedLayoutElement.direction === 'in' ? 'active' : ''}
                    onClick={() => updateLayoutElement(selectedLayoutElement.id, { direction: 'in' })}
                  >Entry</button>
                  <button 
                    className={selectedLayoutElement.direction === 'out' ? 'active' : ''}
                    onClick={() => updateLayoutElement(selectedLayoutElement.id, { direction: 'out' })}
                  >Exit</button>
                </div>
              </div>
            )}
            {selectedLayoutElement.type === 'lane' && (
              <div className="prop-row">
                <label>Direction</label>
                <div className="prop-buttons direction-grid">
                  <button 
                    className={selectedLayoutElement.direction === 'up' ? 'active' : ''}
                    onClick={() => updateLayoutElement(selectedLayoutElement.id, { direction: 'up' })}
                  >↑</button>
                  <button 
                    className={selectedLayoutElement.direction === 'down' ? 'active' : ''}
                    onClick={() => updateLayoutElement(selectedLayoutElement.id, { direction: 'down' })}
                  >↓</button>
                  <button 
                    className={selectedLayoutElement.direction === 'left' ? 'active' : ''}
                    onClick={() => updateLayoutElement(selectedLayoutElement.id, { direction: 'left' })}
                  >←</button>
                  <button 
                    className={selectedLayoutElement.direction === 'right' ? 'active' : ''}
                    onClick={() => updateLayoutElement(selectedLayoutElement.id, { direction: 'right' })}
                  >→</button>
                </div>
              </div>
            )}
            {selectedLayoutElement.type === 'spot' && (
              <>
                <div className="prop-row">
                  <label>Type</label>
                  <div className="prop-buttons">
                    <button 
                      className={selectedLayoutElement.spotType === 'regular' ? 'active' : ''}
                      onClick={() => updateLayoutElement(selectedLayoutElement.id, { spotType: 'regular' })}
                    >Regular</button>
                    <button 
                      className={`ev ${selectedLayoutElement.spotType === 'ev' ? 'active' : ''}`}
                      onClick={() => updateLayoutElement(selectedLayoutElement.id, { spotType: 'ev' })}
                    >EV</button>
                    <button 
                      className={`ada ${selectedLayoutElement.spotType === 'ada' ? 'active' : ''}`}
                      onClick={() => updateLayoutElement(selectedLayoutElement.id, { spotType: 'ada' })}
                    >ADA</button>
                  </div>
                </div>
                <div className="prop-row">
                  <label>Spot #</label>
                  <input 
                    type="text" 
                    value={selectedLayoutElement.spotNumber || ''}
                    placeholder="A-101"
                    onChange={(e) => updateLayoutElement(selectedLayoutElement.id, { spotNumber: e.target.value })}
                  />
                </div>
              </>
            )}
            {selectedLayoutElement.type === 'curve' && (
              <div className="prop-row">
                <label>Direction</label>
                <div className="prop-buttons">
                  <button 
                    className={selectedLayoutElement.direction === 'left' ? 'active' : ''}
                    onClick={() => updateLayoutElement(selectedLayoutElement.id, { direction: 'left' })}
                  >↰ Left</button>
                  <button 
                    className={selectedLayoutElement.direction === 'right' ? 'active' : ''}
                    onClick={() => updateLayoutElement(selectedLayoutElement.id, { direction: 'right' })}
                  >↱ Right</button>
                </div>
              </div>
            )}
            {selectedLayoutElement.type === 'ramp' && (
              <div className="prop-row">
                <label>Target Level</label>
                <select 
                  value={selectedLayoutElement.targetLevel || ''}
                  onChange={(e) => updateLayoutElement(selectedLayoutElement.id, { targetLevel: e.target.value })}
                  style={{
                    padding: '8px 10px',
                    border: '1px solid var(--joy-palette-neutral-300)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: 'var(--joy-palette-background-surface)',
                    color: 'var(--joy-palette-neutral-800)'
                  }}
                >
                  <option value="">Select level...</option>
                  {garage?.levels?.filter(l => l.id !== selectedLevelId).map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="prop-row">
              <label>Rotation</label>
              <div className="rotation-input">
                <input 
                  type="number" 
                  value={selectedLayoutElement.rotation || 0}
                  onChange={(e) => updateLayoutElement(selectedLayoutElement.id, { rotation: parseInt(e.target.value) || 0 })}
                  min="0"
                  max="360"
                  step="15"
                />
                <span>°</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapCanvas;
