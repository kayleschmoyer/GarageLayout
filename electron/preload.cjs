const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Check if running in Electron
  isElectron: true,

  // Get app info
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // Config file operations
  readConfigFile: (filePath) => ipcRenderer.invoke('read-config-file', filePath),
  writeConfigFile: (filePath, content) => ipcRenderer.invoke('write-config-file', filePath, content),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),

  // Config paths
  getConfigPaths: () => ipcRenderer.invoke('get-config-paths'),
  checkConfigFiles: () => ipcRenderer.invoke('check-config-files'),

  // File watching
  watchConfigFile: (filePath) => ipcRenderer.invoke('watch-config-file', filePath),
  unwatchConfigFile: (filePath) => ipcRenderer.invoke('unwatch-config-file', filePath),

  // Listen for file changes
  onConfigFileChanged: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('config-file-changed', subscription);
    // Return unsubscribe function
    return () => ipcRenderer.removeListener('config-file-changed', subscription);
  }
});
