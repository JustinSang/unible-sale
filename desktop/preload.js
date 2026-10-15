const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('unibleDesktop', {
  getUrl: () => ipcRenderer.invoke('unible:get-url'),
  setUrl: u => ipcRenderer.invoke('unible:set-url', u),
  retry: () => ipcRenderer.invoke('unible:retry'),
  openSettings: () => ipcRenderer.invoke('unible:open-settings'),
  platform: process.platform
});
