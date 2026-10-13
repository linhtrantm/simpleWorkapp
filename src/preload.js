const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('simpleWork', {
  // thanh bên
  onState: (cb) => ipcRenderer.on('tabs:state', (_e, s) => cb(s)),
  ready: () => ipcRenderer.send('tabs:ready'),
  select: (id) => ipcRenderer.send('tabs:select', id),
  reload: (id) => ipcRenderer.send('tabs:reload', id),
  openExternal: () => ipcRenderer.send('tabs:open-external'),
  itemMenu: (id) => ipcRenderer.send('tabs:menu', id),
  onHandoff: (cb) => ipcRenderer.on('handoff:show', (_e, d) => cb(d)),
  releaseHandoff: () => ipcRenderer.send('handoff:release'),
  toggleSettings: () => ipcRenderer.send('settings:toggle'),
  // cài đặt
  getSettings: () => ipcRenderer.invoke('settings:get'),
  onSettings: (cb) => ipcRenderer.on('settings:state', (_e, s) => cb(s)),
  setEnabled: (id, enabled) => ipcRenderer.send('settings:set-enabled', id, enabled),
  setIconSize: (size) => ipcRenderer.send('settings:set-icon-size', size),
  setNotifySound: (on) => ipcRenderer.send('settings:set-notify-sound', on),
  setTheme: (theme) => ipcRenderer.send('settings:set-theme', theme),
  setAccent: (accent) => ipcRenderer.send('settings:set-accent', accent),
  setOrder: (ids) => ipcRenderer.send('settings:set-order', ids),
  onShown: (cb) => ipcRenderer.on('settings:shown', cb),
  setLang: (lang) => ipcRenderer.send('settings:set-lang', lang),
  addApp: (data) => ipcRenderer.invoke('settings:add-app', data),
  removeApp: (id) => ipcRenderer.invoke('settings:remove-app', id),
  closeSettings: () => ipcRenderer.send('settings:close'),
  // loader
  onSplashHide: (cb) => ipcRenderer.on('splash:hide', cb)
});
