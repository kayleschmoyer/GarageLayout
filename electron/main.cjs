const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Content Security Policy - stricter in production, relaxed for development HMR
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

// Weather API domains needed for the Weather component
const WEATHER_API_DOMAINS = 'https://api.open-meteo.com https://geocoding-api.open-meteo.com https://nominatim.openstreetmap.org';

const CSP_POLICY = isDev
  ? [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      `connect-src 'self' ws://localhost:* http://localhost:* ${WEATHER_API_DOMAINS}`,
    ].join('; ')
  : [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      `connect-src 'self' ${WEATHER_API_DOMAINS}`,
    ].join('; ');

// Default config file paths for EnSight
const CONFIG_PATHS = {
  cameraHub: 'C:\\Ensight\\CameraHub\\CameraHub-config.xml',
  devicesConfig: 'C:\\Ensight\\EPIC\\Config\\DevicesConfig.xml'
};

let mainWindow = null;
let fileWatchers = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '../public/icon.ico'),
    title: 'EnSight Admin Console'
  });

  // Load the app - dev server or built files
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopAllWatchers();
  });
}

app.whenReady().then(() => {
  // Set Content Security Policy headers
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP_POLICY]
      }
    });
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ============= IPC Handlers for File System Access =============

// Read a config file
ipcMain.handle('read-config-file', async (event, filePath) => {
  try {
    const resolvedPath = filePath || CONFIG_PATHS.cameraHub;
    if (!fs.existsSync(resolvedPath)) {
      return { success: false, error: 'File not found', path: resolvedPath };
    }
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    return { success: true, content, path: resolvedPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Write a config file
ipcMain.handle('write-config-file', async (event, filePath, content) => {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Check if a file exists
ipcMain.handle('file-exists', async (event, filePath) => {
  return fs.existsSync(filePath);
});

// Get default config paths
ipcMain.handle('get-config-paths', async () => {
  return CONFIG_PATHS;
});

// Check which config files exist
ipcMain.handle('check-config-files', async () => {
  const results = {};
  for (const [key, filePath] of Object.entries(CONFIG_PATHS)) {
    results[key] = {
      path: filePath,
      exists: fs.existsSync(filePath)
    };
  }
  return results;
});

// ============= File Watching for Real-time Updates =============

ipcMain.handle('watch-config-file', async (event, filePath) => {
  try {
    const resolvedPath = filePath || CONFIG_PATHS.cameraHub;

    // Don't watch if already watching
    if (fileWatchers.has(resolvedPath)) {
      return { success: true, message: 'Already watching', path: resolvedPath };
    }

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      return { success: false, error: 'File not found', path: resolvedPath };
    }

    // Create watcher
    const watcher = fs.watch(resolvedPath, (eventType) => {
      if (eventType === 'change') {
        // Debounce - wait a bit for file to finish writing
        setTimeout(() => {
          try {
            const content = fs.readFileSync(resolvedPath, 'utf-8');
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('config-file-changed', {
                path: resolvedPath,
                content
              });
            }
          } catch (err) {
            console.error('Error reading changed file:', err);
          }
        }, 100);
      }
    });

    fileWatchers.set(resolvedPath, watcher);
    return { success: true, path: resolvedPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('unwatch-config-file', async (event, filePath) => {
  const resolvedPath = filePath || CONFIG_PATHS.cameraHub;
  const watcher = fileWatchers.get(resolvedPath);
  if (watcher) {
    watcher.close();
    fileWatchers.delete(resolvedPath);
  }
  return { success: true };
});

function stopAllWatchers() {
  for (const watcher of fileWatchers.values()) {
    watcher.close();
  }
  fileWatchers.clear();
}

// ============= App Info =============

ipcMain.handle('get-app-info', async () => {
  return {
    isElectron: true,
    platform: process.platform,
    version: app.getVersion(),
    configPaths: CONFIG_PATHS
  };
});
