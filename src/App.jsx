// src/App.jsx
import React, { useState, createContext, useEffect, useCallback, useRef } from 'react';
import { CssVarsProvider, useColorScheme, extendTheme } from '@mui/joy/styles';
import CssBaseline from '@mui/joy/CssBaseline';
import GarageSelector from './components/GarageSelector';
import LevelSelector from './components/LevelSelector';
import EditorView from './components/EditorView';
import './App.css';

export const AppContext = createContext();

// Professional enterprise theme
const enterpriseTheme = extendTheme({
  fontFamily: {
    display: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  colorSchemes: {
    light: {
      palette: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        neutral: {
          50: '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
        },
        success: {
          500: '#22c55e',
          600: '#16a34a',
        },
        warning: {
          500: '#f59e0b',
        },
        background: {
          body: '#f8fafc',
          surface: '#ffffff',
        },
      },
    },
    dark: {
      palette: {
        primary: {
          50: '#1e3a5f',
          100: '#1e40af',
          200: '#1d4ed8',
          300: '#2563eb',
          400: '#3b82f6',
          500: '#60a5fa',
          600: '#93c5fd',
          700: '#bfdbfe',
          800: '#dbeafe',
          900: '#eff6ff',
        },
        neutral: {
          50: '#18181b',
          100: '#27272a',
          200: '#3f3f46',
          300: '#52525b',
          400: '#71717a',
          500: '#a1a1aa',
          600: '#d4d4d8',
          700: '#e4e4e7',
          800: '#f4f4f5',
          900: '#fafafa',
        },
        danger: {
          500: '#ef4444',
          600: '#f87171',
        },
        success: {
          500: '#22c55e',
          600: '#4ade80',
        },
        background: {
          body: '#0a0a0b',
          surface: '#18181b',
          level1: '#27272a',
          level2: '#3f3f46',
        },
      },
    },
  },
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
});

function AppContent() {
  const { mode, setMode } = useColorScheme();

  // App state
  const [garages, setGarages] = useState([
    {
      id: 1,
      name: 'Main Parking Garage',
      address: '123 N Main St',
      city: 'Allentown',
      state: 'PA',
      zip: '18102',
      image: '',
      contacts: [
        { id: 1, name: 'Security Desk', title: 'Emergency', phone: '(555) 555-5555', email: '', type: 'emergency' },
        { id: 2, name: 'John Doe', title: 'Maintenance Lead', phone: '(555) 555-5555', email: '', type: 'phone' },
        { id: 3, name: 'IT Support', title: 'Help Desk', phone: '', email: 'support@garage.com', type: 'email' }
      ],
      servers: [],
      levels: [
        { id: 1, name: 'Level 1', totalSpots: 150, evSpots: 10, handicapSpots: 8, bgImage: null, devices: [] },
        { id: 2, name: 'Level 2', totalSpots: 150, evSpots: 8, handicapSpots: 6, bgImage: null, devices: [] },
      ]
    }
  ]);

  // Navigation state
  const [currentView, setCurrentView] = useState('garages'); // 'garages', 'levels', 'editor'
  const [selectedGarage, setSelectedGarage] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const initialLoadRef = useRef(true);

  // Helper to create URL-friendly slug
  const toSlug = (str) => str?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || '';

  // Update browser URL based on current state
  const updateUrl = useCallback((garageId, levelId) => {
    const garage = garages.find(g => g.id === garageId);
    if (!garage) {
      window.history.pushState({}, '', '/');
      return;
    }

    const level = garage.levels.find(l => l.id === levelId);
    if (level) {
      window.history.pushState({}, '', `/${toSlug(garage.name)}/${toSlug(level.name)}`);
    } else {
      window.history.pushState({}, '', `/${toSlug(garage.name)}`);
    }
  }, [garages]);

  // Parse URL and restore state on mount only
  useEffect(() => {
    // Only parse URL on initial load, not on every garages change
    if (!initialLoadRef.current) return;

    const parseUrl = () => {
      const path = window.location.pathname;
      const parts = path.split('/').filter(Boolean);

      if (parts.length >= 1) {
        const garageSlug = parts[0];
        const garage = garages.find(g => toSlug(g.name) === garageSlug);
        if (garage) {
          setSelectedGarage(garage.id);

          if (parts.length >= 2) {
            const levelSlug = parts[1];
            const level = garage.levels.find(l => toSlug(l.name) === levelSlug);
            if (level) {
              setSelectedLevel(level.id);
              setCurrentView('editor');
            } else {
              setCurrentView('levels');
            }
          } else {
            setCurrentView('levels');
          }
        }
      }
      initialLoadRef.current = false;
    };

    parseUrl();

    // Handle browser back/forward
    const handlePopState = () => {
      const path = window.location.pathname;
      const parts = path.split('/').filter(Boolean);

      if (parts.length === 0) {
        setSelectedGarage(null);
        setSelectedLevel(null);
        setCurrentView('garages');
      } else if (parts.length >= 1) {
        const garageSlug = parts[0];
        const garage = garages.find(g => toSlug(g.name) === garageSlug);
        if (garage) {
          setSelectedGarage(garage.id);

          if (parts.length >= 2) {
            const levelSlug = parts[1];
            const level = garage.levels.find(l => toSlug(l.name) === levelSlug);
            if (level) {
              setSelectedLevel(level.id);
              setCurrentView('editor');
            } else {
              setSelectedLevel(null);
              setCurrentView('levels');
            }
          } else {
            setSelectedLevel(null);
            setCurrentView('levels');
          }
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [garages]);

  // Get current data
  const currentGarage = garages.find(g => g.id === selectedGarage);
  const levels = currentGarage?.levels || [];
  const currentLevel = levels.find(l => l.id === selectedLevel);

  // Update levels for current garage
  const setLevels = (newLevels) => {
    setGarages(garages.map(g =>
      g.id === selectedGarage ? { ...g, levels: newLevels } : g
    ));
  };

  // Navigation handlers
  const selectGarage = (garageId) => {
    setSelectedGarage(garageId);
    setSelectedLevel(null);
    setCurrentView('levels');
    updateUrl(garageId, null);
  };

  const selectLevel = (levelId) => {
    setSelectedLevel(levelId);
    setCurrentView('editor');
    updateUrl(selectedGarage, levelId);
  };

  // Wrapper for setSelectedLevel that also updates URL
  const setSelectedLevelWithUrl = (levelId) => {
    // Convert to number if it's a string (from dropdown)
    const numericLevelId = typeof levelId === 'string' ? parseInt(levelId, 10) : levelId;
    setSelectedLevel(numericLevelId);
    updateUrl(selectedGarage, numericLevelId);
  };

  const goBack = () => {
    if (currentView === 'editor') {
      setSelectedLevel(null);
      setSelectedDevice(null);
      setCurrentView('levels');
      updateUrl(selectedGarage, null);
    } else if (currentView === 'levels') {
      setSelectedGarage(null);
      setCurrentView('garages');
      window.history.pushState({}, '', '/');
    }
  };

  return (
    <AppContext.Provider value={{
      garages, setGarages,
      selectedGarageId: selectedGarage,
      setSelectedGarageId: setSelectedGarage,
      selectGarage,
      levels, setLevels,
      selectedLevelId: selectedLevel,
      setSelectedLevelId: setSelectedLevelWithUrl,
      selectLevel,
      currentLevel,
      selectedDevice, setSelectedDevice,
      currentView, setCurrentView,
      goBack,
      mode, setMode
    }}>
      <div className="app-container">
        {currentView === 'garages' && <GarageSelector />}
        {currentView === 'levels' && <LevelSelector />}
        {currentView === 'editor' && <EditorView />}
      </div>
    </AppContext.Provider>
  );
}

function App() {
  return (
    <CssVarsProvider theme={enterpriseTheme} defaultMode="dark">
      <CssBaseline />
      <AppContent />
    </CssVarsProvider>
  );
}

export default App;