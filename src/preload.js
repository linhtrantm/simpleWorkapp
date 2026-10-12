const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('simpleWork', {
  // thanh bên
  onState: (cb) => ipcRenderer.on('tabs:state', (_e, s) => cb(s)),
  ready: () => ipcRenderer.send('tabs:ready'),
  select: (id) => ipcRenderer.send('tabs:select', id),
  reload: (id) => ipcRenderer.send('tabs:reload', id),
  openExternal: () => ipcRenderer.send('tabs:open-external'),
  toggleSettings: () => ipcRenderer.send('settings:toggle'),
  // cài đặt
  getSettings: () => ipcRenderer.invoke('settings:get'),
  onSettings: (cb) => ipcRenderer.on('settings:state', (_e, s) => cb(s)),
  setEnabled: (id, enabled) => ipcRenderer.send('settings:set-enabled', id, enabled),
  setIconSize: (size) => ipcRenderer.send('settings:set-icon-size', size),
  closeSettings: () => ipcRenderer.send('settings:close'),
  // loader
  onSplashHide: (cb) => ipcRenderer.on('splash:hide', cb)
});
