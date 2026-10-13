const { app, BrowserWindow, WebContentsView, Notification, Tray, Menu, nativeImage, nativeTheme, powerSaveBlocker, session, shell, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
// Không để Chromium làm chậm/đóng băng các tab chạy nền khi cửa sổ bị che hoặc ẩn,
// nếu không tin nhắn và thông báo sẽ đến chậm hoặc chập chờn.
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

const builtinTabs = require('./tabs.config');
const settingsStore = require('./settings');
const i18n = require('./i18n');

// Kích thước thanh bên theo cỡ icon (px)
const ICON_LEVELS = [
  { width: 52, icon: 30, glyph: 17, label: false, labelSize: 9.5 },
  { width: 60, icon: 34, glyph: 19, label: false, labelSize: 9.5 },
  { width: 70, icon: 36, glyph: 20, label: true, labelSize: 9.5 },
  { width: 76, icon: 40, glyph: 22, label: true, labelSize: 9.5 },
  { width: 86, icon: 46, glyph: 26, label: true, labelSize: 10 },
  { width: 98, icon: 54, glyph: 30, label: true, labelSize: 11 }
];
const TOPBAR_HEIGHT = 20; // dải kéo cửa sổ mỏng phía trên vùng nội dung
const CARD_RADIUS = 12; // góc bo của "tấm thẻ" chứa nội dung web
const CARD_MARGIN = 8; // khoảng cách tấm thẻ với mép phải/dưới cửa sổ
const LOAD_TIMEOUT_MS = 10000; // quá thời gian này vẫn hiện trang dù chưa báo tải xong
const SPLASH_MIN_MS = 1600;
const SPLASH_MAX_MS = 10000;
const bgColor = () => (nativeTheme.shouldUseDarkColors ? '#050810' : '#eef1f7');
const cardColor = () => (nativeTheme.shouldUseDarkColors ? '#0b1020' : '#ffffff');
const USER_AGENT =
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;

let win;
let activeId = null;
let quitting = false;
let settingsView = null;
let settingsOpen = false;
let splashView = null;
let settings = { notifySound: true, disabled: [], iconLevel: 4, customApps: [], lang: 'vi', theme: 'system', accent: 'orange', order: [] };
let tray = null;
let traySig = '';
const views = new Map(); // id -> WebContentsView
const unread = new Map(); // id -> số hiển thị trên badge
const titleUnread = new Map(); // id -> số đọc từ title trang "(3) ..."
const loadState = new Map(); // id -> 'loading' | 'ready' | 'failed'
const loadError = new Map();
const loadTimers = new Map();
const notifUnread = new Map(); // id -> số thông báo nhận khi chưa xem (dự phòng cho app title không có số)

const T = (key, vars) => i18n.t(settings.lang, key, vars);
const ui = () => ICON_LEVELS[(settings.iconLevel || 4) - 1] || ICON_LEVELS[3];
// App tuỳ ý (người dùng thêm trong Cài đặt) được chuyển thành entry giống tabs.config
function customToTab(c) {
  let host = '';
  try {
    host = new URL(c.url).hostname.replace(/^www\./, '');
  } catch {}
  return {
    id: c.id,
    name: c.name,
    url: c.url,
    partition: 'persist:Custom_' + c.id.replace(/\W/g, ''),
    letter: c.name.trim().charAt(0).toUpperCase(),
    color: c.color,
    custom: true,
    internalHosts: host ? [host] : []
  };
}
const allTabs = () => {
  const base = [...builtinTabs, ...settings.customApps.map(customToTab)];
  const rank = (t) => {
    const i = settings.order.indexOf(t.id);
    return i < 0 ? 1e6 + base.indexOf(t) : i;
  };
  return base.slice().sort((a, b) => rank(a) - rank(b));
};
const tabById = (id) => allTabs().find((t) => t.id === id);
const isEnabled = (id) => !settings.disabled.includes(id);
const enabledTabs = () => allTabs().filter((t) => isEnabled(t.id));

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
  const content = {
    x: ui().width,
    y: TOPBAR_HEIGHT,
    width: Math.max(0, w - ui().width - CARD_MARGIN),
    height: Math.max(0, h - TOPBAR_HEIGHT - CARD_MARGIN)
  };
  for (const v of views.values()) v.setBounds(content);
  if (settingsView) settingsView.setBounds(content);
  if (splashView) splashView.setBounds({ x: 0, y: 0, width: w, height: h });
}

function sendState() {
  refreshTray();
  if (!win) return;
  win.webContents.send('tabs:state', {
    tabs: enabledTabs().map((t) => ({
      id: t.id, name: t.name, icon: t.icon, letter: t.letter, color: t.color, unread: unread.get(t.id) || 0
    })),
    activeId,
    settingsOpen,
    canOpenExternal: !!activeId,
    load: { state: (activeId && loadState.get(activeId)) || 'ready', error: (activeId && loadError.get(activeId)) || '' },
    lang: settings.lang,
    accent: settings.accent,
    ui: ui()
  });
}

function settingsState() {
  return {
    version: app.getVersion(),
    iconLevel: settings.iconLevel,
    lang: settings.lang,
    theme: settings.theme,
    accent: settings.accent,
    notifySound: settings.notifySound,
    apps: allTabs().map((t) => ({
      id: t.id, name: t.name, icon: t.icon, letter: t.letter, color: t.color, custom: !!t.custom, enabled: isEnabled(t.id)
    }))
  };
}

// Badge = số trong title nếu có, không thì số thông báo chưa xem
function refreshUnread(id) {
  const t = titleUnread.get(id) || 0;
  const v = t > 0 ? t : notifUnread.get(id) || 0;
  if ((unread.get(id) || 0) === v) return;
  unread.set(id, v);
  updateBadge();
  sendState();
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
  ses.registerPreloadScript({ type: 'frame', filePath: path.join(__dirname, 'notify-bridge.js') });
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'notifications' || permission === 'clipboard-sanitized-write');
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
  view.setBorderRadius(CARD_RADIUS);
  view.setBackgroundColor(cardColor());
  view.setVisible(false);
  const wc = view.webContents;
  wc.setUserAgent(USER_AGENT);

  const isAuth = (url) => hostMatches(url, tab.authHosts || []);
  const isInternal = (url) => isAuth(url) || hostMatches(url, tab.internalHosts);

  // Chỉ popup đăng nhập mới mở trong app. about:blank: popup (MSAL...) mở trống rồi mới điều hướng.
  // Link người dùng bấm trong chat mở bằng trình duyệt mặc định của macOS.
  wc.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || isAuth(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { parent: win, width: 520, height: 720, autoHideMenuBar: true }
      };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
  // Popup mở trống rồi điều hướng tới link ngoài: đẩy ra trình duyệt ngoài và đóng popup
  wc.on('did-create-window', (child) => {
    const guard = (e, url) => {
      if (url === 'about:blank' || isInternal(url)) return;
      e.preventDefault();
      shell.openExternal(url);
      if (!child.isDestroyed()) child.close();
    };
    child.webContents.on('will-navigate', guard);
    child.webContents.on('will-redirect', guard);
  });
  wc.on('will-navigate', (e, url) => {
    if (!isInternal(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // Badge: tiêu đề trang dạng "(3) WhatsApp"
  wc.on('page-title-updated', (_e, title) => {
    const m = title.match(/^\((\d+)\)/);
    titleUnread.set(tab.id, m ? parseInt(m[1], 10) : 0);
    refreshUnread(tab.id);
  });

  // Trạng thái tải: ẩn trang web cho tới khi tải xong, trong lúc đó thanh bên hiện màn hình chờ
  wc.on('did-stop-loading', () => {
    if (loadState.get(tab.id) === 'loading') setLoad(tab.id, 'ready');
  });
  wc.on('did-fail-load', (_e, code, desc, url, isMain) => {
    if (!isMain || code === -3) return; // -3 = bị huỷ (điều hướng tiếp)
    console.error(`[${tab.id}] load fail ${code} ${desc} ${url}`);
    setLoad(tab.id, 'failed', `${desc} (${code})`);
  });
  views.set(tab.id, view);
  win.contentView.addChildView(view);
  layout();
  setLoad(tab.id, 'loading');
  wc.loadURL(tab.url);
  return view;
}

function setLoad(id, state, err) {
  loadState.set(id, state);
  if (err) loadError.set(id, err);
  else loadError.delete(id);
  clearTimeout(loadTimers.get(id));
  if (state === 'loading') {
    loadTimers.set(
      id,
      setTimeout(() => {
        if (loadState.get(id) === 'loading') setLoad(id, 'ready');
      }, LOAD_TIMEOUT_MS)
    );
  }
  applyVisibility();
  sendState();
}

// Chỉ hiện trang của tab đang chọn và đã tải xong
// App có keepAlive (Teams) vẫn được "hiện" nằm dưới app đang xem để trình duyệt tiếp tục vẽ khung hình,
// nếu ẩn hẳn thì trang nặng đứng yên tới khi được bấm vào.
let raisedId = null;
function applyVisibility() {
  const activeReady = !!activeId && loadState.get(activeId) === 'ready';
  for (const [vid, v] of views) {
    const tab = tabById(vid);
    v.setVisible(activeReady && (vid === activeId || !!(tab && tab.keepAlive)));
  }
  // Đưa app đang xem lên trên cùng, rồi đưa các lớp phủ (Cài đặt, loader) lên trên nữa
  if (activeReady && raisedId !== activeId && views.has(activeId) && win) {
    win.contentView.addChildView(views.get(activeId));
    if (settingsView && settingsOpen) win.contentView.addChildView(settingsView);
    if (splashView) win.contentView.addChildView(splashView);
    raisedId = activeId;
  }
}

function destroyView(id) {
  const view = views.get(id);
  if (!view) return;
  win.contentView.removeChildView(view);
  view.webContents.close();
  views.delete(id);
  if (raisedId === id) raisedId = null;
  clearTimeout(loadTimers.get(id));
  loadState.delete(id);
  loadError.delete(id);
  unread.delete(id);
  titleUnread.delete(id);
  notifUnread.delete(id);
}

function selectTab(id) {
  if (!isEnabled(id)) return;
  const tab = tabById(id);
  if (!tab) return;
  let view = views.get(id);
  if (!view) view = createView(tab);
  activeId = id;
  applyVisibility();
  notifUnread.delete(id);
  refreshUnread(id);
  setSettingsOpen(false);
  view.webContents.focus();
  sendState();
}

function ensureSettingsView() {
  if (settingsView) return;
  settingsView = new WebContentsView({
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  });
  settingsView.setBorderRadius(CARD_RADIUS);
  settingsView.setBackgroundColor(cardColor());
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
    settingsView.webContents.send('settings:shown');
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
      activeId = enabledTabs()[0].id;
      applyVisibility();
    }
  }
  updateBadge();
  sendState();
  if (settingsView) settingsView.webContents.send('settings:state', settingsState());
}

// ---- Menu bar (khay hệ thống) ----
function showWindow() {
  if (!win) createWindow();
  win.show();
  win.focus();
}

function refreshTray() {
  if (!tray) return;
  const tabs = enabledTabs();
  const sig = settings.lang + JSON.stringify(tabs.map((t) => [t.id, t.name, unread.get(t.id) || 0]));
  if (sig === traySig) return;
  traySig = sig;
  const total = tabs.reduce((sum, t) => sum + (unread.get(t.id) || 0), 0);
  tray.setTitle(total > 0 ? ' ' + total : '');
  tray.setToolTip(total > 0 ? T('trayTooltipUnread', { n: total }) : 'simpleWork');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: T('trayOpen'), click: showWindow },
      { type: 'separator' },
      ...tabs.map((t) => {
        const n = unread.get(t.id) || 0;
        return {
          label: n > 0 ? `${t.name}  (${n})` : t.name,
          click: () => {
            showWindow();
            selectTab(t.id);
          }
        };
      }),
      { type: 'separator' },
      {
        label: T('traySettings'),
        click: () => {
          showWindow();
          setSettingsOpen(true);
        }
      },
      { type: 'separator' },
      { label: T('trayQuit'), click: () => app.quit() }
    ])
  );
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, 'assets', 'trayTemplate.png'));
  img.setTemplateImage(true);
  tray = new Tray(img);
  refreshTray();
}

// ---- App tuỳ ý ----
function addCustomApp({ name, url, color }) {
  name = String(name || '').trim().slice(0, 24);
  if (!name) return { ok: false, error: 'name' };
  url = String(url || '').trim();
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw new Error('bad');
    url = u.href;
  } catch {
    return { ok: false, error: 'url' };
  }
  if (!/^#[0-9a-f]{6}$/i.test(color || '')) color = '#3B82F6';
  const id = 'custom-' + Date.now().toString(36);
  settings.customApps.push({ id, name, url, color });
  settingsStore.save(settings);
  createView(tabById(id));
  sendState();
  if (settingsView) settingsView.webContents.send('settings:state', settingsState());
  return { ok: true };
}

function removeCustomApp(id) {
  const c = settings.customApps.find((a) => a.id === id);
  if (!c) return { ok: false };
  if (enabledTabs().length <= 1 && isEnabled(id)) return { ok: false, error: 'last' };
  const tab = customToTab(c);
  destroyView(id);
  settings.customApps = settings.customApps.filter((a) => a.id !== id);
  settings.disabled = settings.disabled.filter((d) => d !== id);
  settingsStore.save(settings);
  session.fromPartition(tab.partition).clearStorageData().catch(() => {});
  if (activeId === id) {
    activeId = null;
    selectTab(enabledTabs()[0].id);
  }
  updateBadge();
  sendState();
  if (settingsView) settingsView.webContents.send('settings:state', settingsState());
  return { ok: true };
}

function showSplash(readyPromise) {
  splashView = new WebContentsView({
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  });
  splashView.setBackgroundColor(bgColor());
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
    backgroundColor: '#00000000',
    vibrancy: 'sidebar', // kính mờ gốc của macOS cho thanh bên
    visualEffectState: 'active',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 13, y: 4 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('resize', layout);
  win.on('focus', () => {
    if (activeId && !settingsOpen) {
      notifUnread.delete(activeId);
      refreshUnread(activeId);
    }
  });
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

// Nhật ký thông báo (userData/notify.log) để biết thông báo bị mất ở khâu nào
function logNotify(line) {
  try {
    const file = path.join(app.getPath('userData'), 'notify.log');
    if (fs.existsSync(file) && fs.statSync(file).size > 200 * 1024) fs.renameSync(file, file + '.old');
    fs.appendFileSync(file, `${new Date().toISOString()} ${line}\n`);
  } catch {}
}

// Thông báo từ trang web -> thông báo gốc macOS; bấm vào thì mở app và chuyển đúng tab
const liveNotifications = new Set();
ipcMain.on('notify:show', (e, { id, title, body }) => {
  if (!Notification.isSupported()) return;
  let tabId = null;
  for (const [vid, v] of views) if (v.webContents === e.sender) tabId = vid;
  // Bỏ qua nếu đang xem đúng tab này và cửa sổ đang được focus
  if (tabId && tabId === activeId && !settingsOpen && win && win.isVisible() && win.isFocused()) {
    logNotify(`skip(đang xem) ${tabId} "${String(title).slice(0, 40)}"`);
    return;
  }
  logNotify(`show ${tabId} "${String(title).slice(0, 40)}" sound=${settings.notifySound}`);
  if (tabId) {
    notifUnread.set(tabId, (notifUnread.get(tabId) || 0) + 1);
    refreshUnread(tabId);
  }
  const appName = tabId ? tabById(tabId).name : 'simpleWork';
  const n = new Notification({ title: `${appName} · ${String(title)}`.slice(0, 200), body: String(body || '').slice(0, 500), silent: !settings.notifySound });
  liveNotifications.add(n); // giữ tham chiếu để không bị thu gom trước khi bấm
  n.on('click', () => {
    if (!win) createWindow();
    win.show();
    win.focus();
    if (tabId) selectTab(tabId);
    if (!e.sender.isDestroyed()) e.sender.send('notify:click', id);
  });
  n.on('close', () => liveNotifications.delete(n));
  n.on('failed', (_ev, err) => logNotify(`FAILED ${tabId} ${err}`));
  n.show();
});

ipcMain.on('tabs:select', (_e, id) => selectTab(id));
function reloadTab(id) {
  const v = views.get(id);
  const tab = tabById(id);
  if (!v || !tab) {
    selectTab(id);
    return;
  }
  setLoad(id, 'loading');
  if (loadError.has(id) || !v.webContents.getURL()) v.webContents.loadURL(tab.url);
  else v.webContents.reload();
}
ipcMain.on('tabs:reload', (_e, id) => reloadTab(id));
// Chuột phải vào icon app trên thanh bên
ipcMain.on('tabs:menu', (_e, id) => {
  const tab = tabById(id);
  if (!tab || !win) return;
  Menu.buildFromTemplate([
    { label: T('reload', { name: tab.name }), click: () => reloadTab(id) },
    {
      label: T('openInBrowserMenu'),
      click: () => {
        const v = views.get(id);
        const url = v && v.webContents.getURL();
        if (url && /^https?:/.test(url)) shell.openExternal(url);
      }
    }
  ]).popup({ window: win });
});
ipcMain.on('tabs:ready', sendState);
ipcMain.on('tabs:open-external', () => {
  const v = activeId && views.get(activeId);
  if (!v) return;
  const url = v.webContents.getURL();
  if (/^https?:/.test(url)) shell.openExternal(url);
});
ipcMain.on('settings:toggle', () => setSettingsOpen(!settingsOpen));
ipcMain.on('settings:close', () => setSettingsOpen(false));
ipcMain.handle('settings:get', settingsState);
let saveTimer = null;
ipcMain.on('settings:set-icon-size', (_e, level) => {
  level = Math.round(Number(level));
  if (!(level >= 1 && level <= ICON_LEVELS.length)) return;
  settings.iconLevel = level;
  layout();
  sendState(); // thanh bên đổi cỡ ngay khi kéo thanh trượt
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => settingsStore.save(settings), 300);
});
ipcMain.on('settings:set-lang', (_e, lang) => {
  if (lang !== 'vi' && lang !== 'en') return;
  settings.lang = lang;
  settingsStore.save(settings);
  traySig = '';
  sendState(); // cập nhật cả tray (refreshTray) lẫn thanh bên
  if (settingsView) settingsView.webContents.send('settings:state', settingsState());
});
ipcMain.on('settings:set-notify-sound', (_e, on) => {
  settings.notifySound = !!on;
  settingsStore.save(settings);
  if (settingsView) settingsView.webContents.send('settings:state', settingsState());
});
ipcMain.on('settings:set-theme', (_e, theme) => {
  if (!['system', 'light', 'dark'].includes(theme)) return;
  settings.theme = theme;
  settingsStore.save(settings);
  nativeTheme.themeSource = theme;
  sendState();
  if (settingsView) settingsView.webContents.send('settings:state', settingsState());
});
ipcMain.on('settings:set-accent', (_e, accent) => {
  if (!['orange', 'blue', 'purple', 'pink', 'green'].includes(accent)) return;
  settings.accent = accent;
  settingsStore.save(settings);
  sendState();
  if (settingsView) settingsView.webContents.send('settings:state', settingsState());
});
ipcMain.on('settings:set-order', (_e, ids) => {
  if (!Array.isArray(ids)) return;
  const valid = new Set(allTabs().map((t) => t.id));
  settings.order = ids.filter((id) => valid.has(id));
  settingsStore.save(settings);
  traySig = '';
  sendState();
  if (settingsView) settingsView.webContents.send('settings:state', settingsState());
});
ipcMain.handle('settings:add-app', (_e, data) => addCustomApp(data || {}));
ipcMain.handle('settings:remove-app', (_e, id) => removeCustomApp(id));
ipcMain.on('settings:set-enabled', (_e, id, enabled) => {
  if (tabById(id)) applyEnabledChange(id, !!enabled);
});

app.whenReady().then(() => {
  settings = settingsStore.load();
  // Phòng trường hợp file settings tắt hết
  if (enabledTabs().length === 0) settings.disabled = [];
  // Chặn macOS App Nap làm app ngủ khi chạy nền (gây trễ tin nhắn và thông báo)
  powerSaveBlocker.start('prevent-app-suspension');
  nativeTheme.themeSource = settings.theme;
  nativeTheme.on('updated', () => {
    if (settingsView) settingsView.setBackgroundColor(cardColor());
    for (const v of views.values()) v.setBackgroundColor(cardColor());
  });
  createWindow();
  createTray();
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
