import React, { useContext, useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Rect, Text, Group, Wedge, Line } from 'react-konva';
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
  const fileInputRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [showGrid, setShowGrid] = useState(true);

  // Tooltip state
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || containerRef.current.offsetWidth,
          height: rect.height || containerRef.current.offsetHeight
        });
      }
    };
    updateSize();

    // Use ResizeObserver for better resize detection
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      resizeObserver.disconnect();
    };
  }, []);

  // Snap to grid function
  const snapToGrid = (value) => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
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

  const handleDeviceDragEnd = (id, e) => {
    const snappedX = snapToGrid(e.target.x());
    const snappedY = snapToGrid(e.target.y());
    e.target.x(snappedX);
    e.target.y(snappedY);
    updateDevice(id, { x: snappedX, y: snappedY });
  };

  const handleStageClick = (e) => {
    // Check if clicking on empty area (stage or background rect)
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.attrs?.name === 'background';

    if (clickedOnEmpty) {
      setSelectedDevice(null);
    }
  };

  const handleBackgroundUpload = (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const updatedGarages = garages.map(g => {
        if (g.id === selectedGarageId) {
          return {
            ...g,
            levels: g.levels.map(l => {
              if (l.id === selectedLevelId) {
                return { ...l, bgImage: event.target.result };
              }
              return l;
            })
          };
        }
        return g;
      });
      setGarages(updatedGarages);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBackground = () => {
    const updatedGarages = garages.map(g => {
      if (g.id === selectedGarageId) {
        return {
          ...g,
          levels: g.levels.map(l => {
            if (l.id === selectedLevelId) {
              return { ...l, bgImage: null };
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

  // Build tooltip content for a device
  const getTooltipContent = (device) => {
    const isCamera = device.type?.startsWith('cam-');
    const isDualLens = device.hardwareType === 'dual-lens';
    let content = device.name || 'Unnamed Device';

    if (isCamera) {
      if (isDualLens) {
        const stream1Type = device.stream1?.streamType || device.type;
        const stream2Type = device.stream2?.streamType || device.type;
        const typeLabel1 = stream1Type === 'cam-fli' ? 'FLI' : stream1Type === 'cam-lpr' ? 'LPR' : 'CAM';
        const typeLabel2 = stream2Type === 'cam-fli' ? 'FLI' : stream2Type === 'cam-lpr' ? 'LPR' : 'CAM';
        content += ` (${typeLabel1}/${typeLabel2})`;
      } else {
        const typeLabel = device.type === 'cam-fli' ? 'FLI' : device.type === 'cam-lpr' ? 'LPR' : 'Camera';
        content += ` (${typeLabel})`;
      }
    }

    return content;
  };

  // Show tooltip for a device
  const showTooltip = (device, e) => {
    const stage = e.target.getStage();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    // Get position relative to stage
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    setTooltip({
      visible: true,
      x: pointerPos.x,
      y: pointerPos.y - 40, // Position above the cursor
      content: getTooltipContent(device)
    });
  };

  // Hide tooltip
  const hideTooltip = () => {
    setTooltip({ visible: false, x: 0, y: 0, content: '' });
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
    for (let y = 0; y <= dimensions.height; y += GRID_SIZE) {
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

  // Render device (cameras, space monitors, signs)
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
        }}
        onMouseEnter={(e) => {
          e.target.getStage().container().style.cursor = 'grab';
          showTooltip(device, e);
        }}
        onMouseLeave={(e) => {
          e.target.getStage().container().style.cursor = 'default';
          hideTooltip();
        }}
        onMouseMove={(e) => {
          // Update tooltip position as mouse moves
          showTooltip(device, e);
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

        {device.type?.startsWith('sensor-') && (
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
    <div className="map-canvas-wrapper" ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Hidden file input for background upload */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={handleBackgroundUpload}
      />

      {/* Simple Toolbar */}
      <div className="layout-toolbar">
        <button
          className="layout-tool-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Upload Site Drawing"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        {currentLevel.bgImage && (
          <button
            className="layout-tool-btn delete"
            onClick={handleRemoveBackground}
            title="Remove Background"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        )}
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
      </div>

      {/* Prompt to upload if no background */}
      {!currentLevel.bgImage && (
        <div
          className="upload-prompt"
          onClick={() => fileInputRef.current?.click()}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            cursor: 'pointer',
            zIndex: 10,
            padding: '40px',
            borderRadius: 12,
            border: `2px dashed ${isDark ? '#3f3f46' : '#d4d4d8'}`,
            background: isDark ? 'rgba(24, 24, 27, 0.8)' : 'rgba(255, 255, 255, 0.9)',
            color: isDark ? '#a1a1aa' : '#71717a'
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.6 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Upload Site Drawing</div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>Click to upload a floor plan or site layout image</div>
        </div>
      )}

      <Stage
        width={dimensions.width}
        height={dimensions.height}
        onClick={handleStageClick}
        style={{ cursor: 'default' }}
      >
        <Layer>
          {/* Background */}
          {bgImg && (
            <KonvaImage
              image={bgImg}
              width={dimensions.width}
              height={dimensions.height}
              listening={false}
            />
          )}
          {!bgImg && (
            <Rect
              name="background"
              width={dimensions.width}
              height={dimensions.height}
              fill={isDark ? '#1a1a1c' : '#f4f4f5'}
            />
          )}
          {bgImg && (
            <Rect
              name="background"
              width={dimensions.width}
              height={dimensions.height}
              fill="transparent"
            />
          )}

          {/* Grid */}
          {renderGrid()}

          {/* Devices (cameras, signs, space monitors) - skip devices pending placement */}
          {currentLevel.devices?.filter(device => !device.pendingPlacement).map(device => renderDevice(device))}
        </Layer>
      </Stage>

      {/* Hover Tooltip */}
      {tooltip.visible && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translateX(-50%)',
            background: isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            color: isDark ? '#fafafa' : '#18181b',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            border: isDark ? '1px solid #3f3f46' : '1px solid #e4e4e7',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap'
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
};

export default MapCanvas;
