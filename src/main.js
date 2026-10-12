const { app, BrowserWindow, WebContentsView, session, shell, ipcMain } = require('electron');
const path = require('path');
const allTabs = require('./tabs.config');
const settingsStore = require('./settings');

// Kích thước thanh bên theo cỡ icon (px)
const ICON_SIZES = {
  small: { width: 56, icon: 32, glyph: 18, label: false },
  medium: { width: 76, icon: 38, glyph: 21, label: true },
  large: { width: 84, icon: 42, glyph: 24, label: true }
};
const TOPBAR_HEIGHT = 30; // thanh kéo cửa sổ phía trên vùng nội dung
const SPLASH_MIN_MS = 1600;
const SPLASH_MAX_MS = 10000;
const BG = '#050810';
const USER_AGENT =
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;

let win;
let activeId = null;
let quitting = false;
let settingsView = null;
let settingsOpen = false;
let splashView = null;
let settings = { disabled: [], iconSize: 'medium' };
const views = new Map(); // id -> WebContentsView
const unread = new Map(); // id -> số tin chưa đọc

const ui = () => ICON_SIZES[settings.iconSize] || ICON_SIZES.medium;
const tabById = (id) => allTabs.find((t) => t.id === id);
const isEnabled = (id) => !settings.disabled.includes(id);
const enabledTabs = () => allTabs.filter((t) => isEnabled(t.id));

function hostMatches(url, hosts) {
  try {
    const h = new URL(url).hostname;
    return hosts.some((d) => h === d || h.endsWith('.' + d));
  } catch {
    return false;
  }
}

function layout() {
  if (!win) return;
  const [w, h] = win.getContentSize();
  const content = { x: ui().width, y: TOPBAR_HEIGHT, width: Math.max(0, w - ui().width), height: Math.max(0, h - TOPBAR_HEIGHT) };
  for (const v of views.values()) v.setBounds(content);
  if (settingsView) settingsView.setBounds(content);
  if (splashView) splashView.setBounds({ x: 0, y: 0, width: w, height: h });
}

function sendState() {
  if (!win) return;
  win.webContents.send('tabs:state', {
    tabs: enabledTabs().map((t) => ({
      id: t.id, name: t.name, icon: t.icon, color: t.color, unread: unread.get(t.id) || 0
    })),
    activeId,
    settingsOpen,
    ui: ui()
  });
}

function settingsState() {
  return {
    version: app.getVersion(),
    iconSize: settings.iconSize,
    apps: allTabs.map((t) => ({ id: t.id, name: t.name, icon: t.icon, color: t.color, enabled: isEnabled(t.id) }))
  };
}

function updateBadge() {
  const total = enabledTabs().reduce((sum, t) => sum + (unread.get(t.id) || 0), 0);
  if (app.dock) app.dock.setBadge(total > 0 ? String(total) : '');
}

function setupSession(tab) {
  const ses = session.fromPartition(tab.partition);
  ses.setUserAgent(USER_AGENT);
  if (tab.disableWebAuthn) {
    ses.registerPreloadScript({ type: 'frame', filePath: path.join(__dirname, 'no-webauthn.js') });
  }
  ses.setPermissionRequestHandler((_wc, permission, cb) => {
    cb(['notifications', 'media', 'clipboard-sanitized-write', 'fullscreen', 'mediaKeySystem'].includes(permission));
  });
  return ses;
}

const sessionsReady = new Set();

function createView(tab) {
  if (!sessionsReady.has(tab.id)) {
    setupSession(tab);
    sessionsReady.add(tab.id);
  }
  const view = new WebContentsView({
    webPreferences: {
      partition: tab.partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false // tab nền vẫn nhận tin
    }
  });
  view.setVisible(false);
  const wc = view.webContents;
  wc.setUserAgent(USER_AGENT);

  wc.setWindowOpenHandler(({ url }) => {
    // about:blank: popup đăng nhập (MSAL...) mở trống rồi mới điều hướng
    if (url === 'about:blank' || hostMatches(url, tab.internalHosts)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { parent: win, width: 520, height: 720, autoHideMenuBar: true }
      };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (e, url) => {
    if (!hostMatches(url, tab.internalHosts)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // Badge: tiêu đề trang dạng "(3) WhatsApp"
  wc.on('page-title-updated', (_e, title) => {
    const m = title.match(/^\((\d+)\)/);
    const n = m ? parseInt(m[1], 10) : 0;
    if (unread.get(tab.id) === n) return;
    unread.set(tab.id, n);
    updateBadge();
    sendState();
  });

  wc.on('did-fail-load', (_e, code, desc, url, isMain) => {
    if (isMain && code !== -3) console.error(`[${tab.id}] load fail ${code} ${desc} ${url}`);
  });
  wc.loadURL(tab.url);
  views.set(tab.id, view);
  win.contentView.addChildView(view);
  layout();
  return view;
}

function destroyView(id) {
  const view = views.get(id);
  if (!view) return;
  win.contentView.removeChildView(view);
  view.webContents.close();
  views.delete(id);
  unread.delete(id);
}

function selectTab(id) {
  if (!isEnabled(id)) return;
  const tab = tabById(id);
  if (!tab) return;
  let view = views.get(id);
  if (!view) view = createView(tab);
  for (const [vid, v] of views) v.setVisible(vid === id);
  activeId = id;
  setSettingsOpen(false);
  view.webContents.focus();
  sendState();
}

function ensureSettingsView() {
  if (settingsView) return;
  settingsView = new WebContentsView({
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  });
  settingsView.setBackgroundColor(BG);
  settingsView.setVisible(false);
  settingsView.webContents.loadFile(path.join(__dirname, 'settings.html'));
  win.contentView.addChildView(settingsView);
  layout();
}

function setSettingsOpen(open) {
  if (open === settingsOpen) return;
  if (open) {
    ensureSettingsView();
    win.contentView.addChildView(settingsView); // đưa lên trên cùng
    settingsView.setVisible(true);
    settingsView.webContents.focus();
  } else if (settingsView) {
    settingsView.setVisible(false);
  }
  settingsOpen = open;
  sendState();
}

function applyEnabledChange(id, enabled) {
  const disabled = new Set(settings.disabled);
  if (enabled) disabled.delete(id);
  else {
    if (enabledTabs().length <= 1) return; // luôn giữ ít nhất 1 app
    disabled.add(id);
  }
  settings.disabled = [...disabled];
  settingsStore.save(settings);

  if (enabled) {
    if (!views.has(id)) createView(tabById(id));
  } else {
    destroyView(id);
    if (activeId === id) {
      activeId = null;
      const first = enabledTabs()[0];
      for (const [vid, v] of views) v.setVisible(vid === first.id);
      activeId = first.id;
    }
  }
  updateBadge();
  sendState();
  if (settingsView) settingsView.webContents.send('settings:state', settingsState());
}

function showSplash(readyPromise) {
  splashView = new WebContentsView({
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  });
  splashView.setBackgroundColor(BG);
  splashView.webContents.loadFile(path.join(__dirname, 'splash.html'));
  win.contentView.addChildView(splashView);
  layout();

  const minDelay = new Promise((r) => setTimeout(r, SPLASH_MIN_MS));
  const maxDelay = new Promise((r) => setTimeout(r, SPLASH_MAX_MS));
  Promise.all([minDelay, Promise.race([readyPromise, maxDelay])]).then(() => {
    if (!splashView) return;
    splashView.webContents.send('splash:hide');
    setTimeout(() => {
      if (!win || !splashView) return;
      win.contentView.removeChildView(splashView);
      splashView.webContents.close();
      splashView = null;
    }, 450);
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 860,
    minHeight: 520,
    title: 'simpleWork',
    backgroundColor: BG,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('resize', layout);
  win.webContents.once('did-finish-load', () => {
    const first = enabledTabs()[0];
    // Mở hết các app đang bật ngay khi khởi động để không lỡ tin nhắn
    for (const t of enabledTabs()) if (!views.has(t.id)) createView(t);
    selectTab(first.id);
    const ready = new Promise((resolve) => views.get(first.id).webContents.once('did-finish-load', resolve));
    showSplash(ready);
  });
  // macOS: đóng cửa sổ chỉ ẩn đi, app + các tab vẫn chạy nền để nhận tin
  win.on('close', (e) => {
    if (process.platform === 'darwin' && !quitting) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => {
    win = null;
    views.clear();
    settingsView = null;
    splashView = null;
    settingsOpen = false;
  });
}

ipcMain.on('tabs:select', (_e, id) => selectTab(id));
ipcMain.on('tabs:reload', (_e, id) => {
  const v = views.get(id);
  if (v) v.webContents.reload();
  else selectTab(id);
});
ipcMain.on('tabs:ready', sendState);
ipcMain.on('settings:toggle', () => setSettingsOpen(!settingsOpen));
ipcMain.on('settings:close', () => setSettingsOpen(false));
ipcMain.handle('settings:get', settingsState);
ipcMain.on('settings:set-icon-size', (_e, size) => {
  if (!ICON_SIZES[size]) return;
  settings.iconSize = size;
  settingsStore.save(settings);
  layout();
  sendState();
  if (settingsView) settingsView.webContents.send('settings:state', settingsState());
});
ipcMain.on('settings:set-enabled', (_e, id, enabled) => {
  if (tabById(id)) applyEnabledChange(id, !!enabled);
});

app.whenReady().then(() => {
  settings = settingsStore.load();
  // Phòng trường hợp file settings tắt hết
  if (enabledTabs().length === 0) settings.disabled = [];
  createWindow();
  app.on('activate', () => {
    if (!win) createWindow();
    else win.show();
  });
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
