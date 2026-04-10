const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the renderer (React app) via window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // Native file dialogs — return real filesystem paths
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
  openFolder: (options) => ipcRenderer.invoke('dialog:openFolder', options),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  // Local file system access
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),

  // Job execution via FastAPI backend
  runJob: (jobJson) => ipcRenderer.invoke('job:run', jobJson),

  // Backend health check
  backendStatus: () => ipcRenderer.invoke('backend:status'),

  // Flag to detect Electron environment
  isElectron: true,
});
