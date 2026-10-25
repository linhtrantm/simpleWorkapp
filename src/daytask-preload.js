const { contextBridge, ipcRenderer } = require('electron');

const call = (name) => (...args) => ipcRenderer.invoke('daytask:' + name, ...args);

contextBridge.exposeInMainWorld('dayTask', {
  view: call('view'),
  add: call('add'),
  update: call('update'),
  remove: call('remove'),
  toggle: call('toggle'),
  reorder: call('reorder'),
  addTemplate: call('tpl-add'),
  removeTemplate: call('tpl-remove'),
  setPrefs: call('prefs'),
  openPage: () => ipcRenderer.send('daytask:open'),
  widgetSize: (h) => ipcRenderer.send('daytask:widget-size', h),
  widgetHide: () => ipcRenderer.send('daytask:widget-hide'),
  start: call('start'),
  pause: call('pause'),
  done: call('done'),
  carry: call('carry'),
  skipCarry: call('skip-carry'),
  close: () => ipcRenderer.send('daytask:close'),
  onChanged: (cb) => ipcRenderer.on('daytask:changed', cb),
  onShown: (cb) => ipcRenderer.on('daytask:shown', cb)
});
