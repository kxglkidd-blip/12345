const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('andruxDesktop', {
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  openExternal: (url) => ipcRenderer.invoke('open-external', String(url || '')),
  robloxJson: (url, options) => ipcRenderer.invoke('roblox-json', String(url || ''), options || {})
});
