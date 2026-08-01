const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getProjectRoot: () => ipcRenderer.invoke('get-project-root'),
  getOutputBaseDir: () => ipcRenderer.invoke('get-output-base-dir'),
  readJson: (relativeFilePath) => ipcRenderer.invoke('read-json', relativeFilePath),
  readText: (relativeFilePath) => ipcRenderer.invoke('read-text', relativeFilePath),
  ensureDir: (relativeDirPath) => ipcRenderer.invoke('ensure-dir', relativeDirPath),
  saveText: (relativeFilePath, content) => ipcRenderer.invoke('save-text', relativeFilePath, content),
  ensureDirSync: (relativeDirPath) => ipcRenderer.sendSync('ensure-dir-sync', relativeDirPath),
  saveTextSync: (relativeFilePath, content) => ipcRenderer.sendSync('save-text-sync', relativeFilePath, content)
});
