// Chạy trong mọi frame của tab: thay window.Notification của trang bằng cầu nối sang thông báo gốc macOS.
const { contextBridge, ipcRenderer, webFrame } = require('electron');

const listeners = new Map(); // id -> callback khi bấm vào thông báo
let nextId = 1;

ipcRenderer.on('notify:click', (_e, id) => {
  const cb = listeners.get(id);
  if (cb) cb();
});

contextBridge.exposeInMainWorld('__swNotify', {
  show: (title, body, onClick) => {
    const id = nextId++;
    listeners.set(id, onClick);
    ipcRenderer.send('notify:show', { id, title, body });
    return id;
  },
  forget: (id) => listeners.delete(id)
});

webFrame.executeJavaScript(`(() => {
  const bridge = window.__swNotify;
  class SWNotification extends EventTarget {
    constructor(title, options = {}) {
      super();
      this.title = String(title);
      this.body = options.body ? String(options.body) : '';
      this.tag = options.tag || '';
      this.data = options.data;
      this.icon = options.icon || '';
      this.onclick = null; this.onshow = null; this.onclose = null; this.onerror = null;
      this._id = bridge.show(this.title, this.body, () => {
        const ev = new Event('click');
        if (typeof this.onclick === 'function') this.onclick(ev);
        this.dispatchEvent(ev);
      });
      setTimeout(() => { const ev = new Event('show'); if (typeof this.onshow === 'function') this.onshow(ev); this.dispatchEvent(ev); }, 0);
    }
    close() { bridge.forget(this._id); }
    static requestPermission(cb) { if (typeof cb === 'function') cb('granted'); return Promise.resolve('granted'); }
    static get permission() { return 'granted'; }
    static get maxActions() { return 0; }
  }
  Object.defineProperty(window, 'Notification', { value: SWNotification, configurable: true, writable: true });
  // Nhiều trang (Teams, Messenger...) gửi thông báo qua Service Worker thay vì new Notification
  try {
    if (window.ServiceWorkerRegistration) {
      ServiceWorkerRegistration.prototype.showNotification = function (title, options) {
        new SWNotification(title, options);
        return Promise.resolve();
      };
      ServiceWorkerRegistration.prototype.getNotifications = function () { return Promise.resolve([]); };
    }
  } catch (e) {}
})();`);
