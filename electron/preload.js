const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kiro', {
  togglePanel: () => ipcRenderer.send('cat:toggle-panel'),
  moveCat: (dx, dy) => ipcRenderer.send('cat:move', { dx, dy }),
  closePanel: () => ipcRenderer.invoke('panel:close'),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),

  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),

  ask: (payload) => ipcRenderer.invoke('ai:ask', payload)
});
