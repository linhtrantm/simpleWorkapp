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
  onAbout: (cb) => ipcRenderer.on('about:data', (_e, d) => cb(d)),
  toggleSettings: () => ipcRenderer.send('settings:toggle'),
  // cài đặt
  getSettings: () => ipcRenderer.invoke('settings:get'),
  onSettings: (cb) => ipcRenderer.on('settings:state', (_e, s) => cb(s)),
  setEnabled: (id, enabled) => ipcRenderer.send('settings:set-enabled', id, enabled),
  setIconSize: (size) => ipcRenderer.send('settings:set-icon-size', size),
  setKeepAwake: (opts) => ipcRenderer.send('settings:set-keep-awake', opts),
  setReloadOnWake: (on) => ipcRenderer.send('settings:set-reload-on-wake', on),
  setNotifySound: (on) => ipcRenderer.send('settings:set-notify-sound', on),
  setTheme: (theme) => ipcRenderer.send('settings:set-theme', theme),
  setLook: (id) => ipcRenderer.send('settings:set-look', id),
  setLookCustom: (hex) => ipcRenderer.send('settings:set-look-custom', hex),
  getUpdate: () => ipcRenderer.invoke('update:get'),
  onUpdatePopup: (cb) => ipcRenderer.on('update:popup', (_e, d) => cb(d)),
  updateLater: () => ipcRenderer.send('update:later'),
  updateOpenPage: () => ipcRenderer.send('update:open-page'),
  updateCheck: () => ipcRenderer.send('update:check'),
  updateDownload: () => ipcRenderer.send('update:download'),
  updateInstall: () => ipcRenderer.send('update:install'),
  setAutoUpdate: (on) => ipcRenderer.send('settings:set-auto-update', on),
  setOrder: (ids) => ipcRenderer.send('settings:set-order', ids),
  onShown: (cb) => ipcRenderer.on('settings:shown', cb),
  setLang: (lang) => ipcRenderer.send('settings:set-lang', lang),
  addApp: (data) => ipcRenderer.invoke('settings:add-app', data),
  removeApp: (id) => ipcRenderer.invoke('settings:remove-app', id),
  closeSettings: () => ipcRenderer.send('settings:close'),
  // loader
  onSplashHide: (cb) => ipcRenderer.on('splash:hide', cb)
});
