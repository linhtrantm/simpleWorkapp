const { app, BrowserWindow, WebContentsView, Notification, Tray, Menu, nativeImage, nativeTheme, powerMonitor, powerSaveBlocker, dialog, session, shell, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
// Không để Chromium làm chậm/đóng băng các tab chạy nền khi cửa sổ bị che hoặc ẩn,
// nếu không tin nhắn và thông báo sẽ đến chậm hoặc chập chờn.
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

const builtinTabs = require('./tabs.config');
const settingsStore = require('./settings');
const i18n = require('./i18n');

// Kích thước thanh bên theo cỡ icon (px)
// Thanh bên tối thiểu 68px để chứa vừa 3 nút cửa sổ macOS, nên tấm thẻ web luôn dán sát mép trên (top: 0)
const ICON_LEVELS = [
  { width: 68, icon: 30, glyph: 17, label: false, labelSize: 9.5, top: 0 },
  { width: 68, icon: 38, glyph: 21, label: false, labelSize: 9.5, top: 0 },
  { width: 74, icon: 40, glyph: 22, label: true, labelSize: 9.5, top: 0 },
  { width: 80, icon: 44, glyph: 24, label: true, labelSize: 9.5, top: 0 },
  { width: 90, icon: 50, glyph: 28, label: true, labelSize: 10, top: 0 },
  { width: 102, icon: 56, glyph: 31, label: true, labelSize: 11, top: 0 }
];
const CARD_RADIUS = 0; // flat: tấm thẻ web vuông góc, không bo
const CARD_MARGIN = 0; // tấm thẻ dán sát mép phải/dưới cửa sổ
const LOAD_TIMEOUT_MS = 10000; // quá thời gian này vẫn hiện trang dù chưa báo tải xong
const SPLASH_MIN_MS = 1600;
const SPLASH_MAX_MS = 10000;
const bgColor = () => (nativeTheme.shouldUseDarkColors ? '#1c1c1e' : '#f2f2f7');
const cardColor = () => (nativeTheme.shouldUseDarkColors ? '#2c2c2e' : '#ffffff');
const USER_AGENT =
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`;

let win;
let activeId = null;
let quitting = false;
let settingsView = null;
let handoffView = null;
let aboutWin = null;
let settingsOpen = false;
let splashView = null;
let settings = { keepAwakeAc: true, keepAwakeBattery: true, reloadOnWake: true, notifySound: true, disabled: [], iconLevel: 4, customApps: [], lang: 'vi', theme: 'system', accent: 'orange', order: [] };
let tray = null;
let traySig = '';
const views = new Map(); // id -> WebContentsView
const unread = new Map(); // id -> số hiển thị trên badge
const titleUnread = new Map(); // id -> số lớn nhất đọc từ title "(3) ..." kể từ lần xem gần nhất
const loadState = new Map(); // id -> 'loading' | 'ready' | 'failed'
const loadError = new Map();
const loadTimers = new Map();
const handoff = new Set(); // app đang được mở ở trình duyệt ngoài: làm mờ, khoá, tắt thông báo
const handoffCss = new Map(); // id -> key CSS đã chèn
// Giao diện web của Zalo... khai báo vùng "kéo cửa sổ" cho app desktop của họ (gồm cả ô Search), trong simpleWork
// nó làm cả cửa sổ bị kéo đi khi bấm vào. Tắt hết vùng kéo do trang web tự khai báo.
const NO_DRAG_CSS = '*:not(#sw-a):not(#sw-b),*:not(#sw-a):not(#sw-b)::before,*:not(#sw-a):not(#sw-b)::after{-webkit-app-region:no-drag!important}';
const HANDOFF_CSS = 'html{filter:blur(14px) saturate(.75)!important;pointer-events:none!important;user-select:none!important;transition:filter .3s}';
const notifUnread = new Map(); // id -> số thông báo nhận kể từ lần xem gần nhất (dự phòng cho app title không có số)

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
    y: ui().top,
    width: Math.max(0, w - ui().width - CARD_MARGIN),
    height: Math.max(0, h - ui().top - CARD_MARGIN)
  };
  for (const v of views.values()) v.setBounds(content);
  if (settingsView) settingsView.setBounds(content);
  if (handoffView) handoffView.setBounds(content);
  if (splashView) splashView.setBounds({ x: 0, y: 0, width: w, height: h });
}

function sendState() {
  refreshTray();
  if (!win) return;
  win.webContents.send('tabs:state', {
    tabs: enabledTabs().map((t) => ({
      id: t.id, name: t.name, icon: t.icon, art: t.art, tile: t.tile, gradient: t.gradient, letter: t.letter, color: t.color, unread: unread.get(t.id) || 0
    })),
    activeId,
    settingsOpen,
    handoff: [...handoff],
    version: app.getVersion(),
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
    keepAwakeAc: settings.keepAwakeAc,
    keepAwakeBattery: settings.keepAwakeBattery,
    reloadOnWake: settings.reloadOnWake,
    apps: allTabs().map((t) => ({
      id: t.id, name: t.name, icon: t.icon, art: t.art, tile: t.tile, gradient: t.gradient, letter: t.letter, color: t.color, custom: !!t.custom, enabled: isEnabled(t.id)
    }))
  };
}

// Badge "dính": đã hiện thì giữ nguyên cho tới khi người dùng xem app đó (bấm vào hoặc đang xem lúc cửa sổ được focus).
// Title nhấp nháy ("(1) ..." rồi về tên thường) không làm badge tắt đi bật lại.
function refreshUnread(id) {
  const v = Math.max(titleUnread.get(id) || 0, notifUnread.get(id) || 0);
  if ((unread.get(id) || 0) === v) return;
  unread.set(id, v);
  updateBadge();
  sendState();
}

const isViewing = (id) => id === activeId && !settingsOpen && !!win && win.isVisible() && win.isFocused();

function clearUnread(id) {
  titleUnread.delete(id);
  notifUnread.delete(id);
  refreshUnread(id);
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
    const n = m ? parseInt(m[1], 10) : 0;
    if (handoff.has(tab.id)) return;
    if (isViewing(tab.id)) clearUnread(tab.id); // đang xem thì không có gì "chưa đọc"
    else if (n > 0) {
      titleUnread.set(tab.id, Math.max(titleUnread.get(tab.id) || 0, n));
      refreshUnread(tab.id);
    }
  });

  wc.on('dom-ready', () => wc.insertCSS(NO_DRAG_CSS).catch(() => {}));
  wc.on('did-finish-load', () => {
    if (handoff.has(tab.id)) applyHandoffCss(tab.id);
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
// ---- Mở ở trình duyệt ngoài: làm mờ app trong simpleWork cho tới khi người dùng bấm "Dùng lại ở đây" ----
async function applyHandoffCss(id) {
  const v = views.get(id);
  if (!v || v.webContents.isDestroyed()) return;
  try {
    handoffCss.set(id, await v.webContents.insertCSS(HANDOFF_CSS));
  } catch {}
}

async function removeHandoffCss(id) {
  const v = views.get(id);
  const key = handoffCss.get(id);
  handoffCss.delete(id);
  if (!v || !key || v.webContents.isDestroyed()) return;
  try {
    await v.webContents.removeInsertedCSS(key);
  } catch {}
}

function startHandoff(id, { open = true } = {}) {
  const v = views.get(id);
  if (!v) return;
  const url = v.webContents.getURL();
  if (open && /^https?:/.test(url)) shell.openExternal(url);
  handoff.add(id);
  titleUnread.delete(id);
  notifUnread.delete(id);
  applyHandoffCss(id);
  refreshUnread(id);
  refreshHandoffOverlay();
  sendState();
}

function endHandoff(id) {
  if (!handoff.delete(id)) return;
  removeHandoffCss(id);
  refreshHandoffOverlay();
  sendState();
}

// Lớp phủ trong suốt có thẻ thông báo + nút "Dùng lại ở đây", nằm trên app đang bị làm mờ
function refreshHandoffOverlay() {
  if (!win) return;
  const show = !!activeId && handoff.has(activeId) && !settingsOpen && loadState.get(activeId) === 'ready';
  if (!show) {
    if (handoffView) handoffView.setVisible(false);
    return;
  }
  if (!handoffView) {
    handoffView = new WebContentsView({
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
    });
    handoffView.setBorderRadius(CARD_RADIUS);
    handoffView.setBackgroundColor('#00000000');
    handoffView.webContents.loadFile(path.join(__dirname, 'handoff.html'));
    win.contentView.addChildView(handoffView);
  }
  layout();
  const tab = tabById(activeId);
  const send = () =>
    handoffView.webContents.send('handoff:show', {
      name: tab.name, icon: tab.icon, art: tab.art, tile: tab.tile, gradient: tab.gradient, letter: tab.letter, color: tab.color, lang: settings.lang, accent: settings.accent
    });
  win.contentView.addChildView(handoffView); // đưa lên trên các app
  if (settingsView && settingsOpen) win.contentView.addChildView(settingsView);
  if (splashView) win.contentView.addChildView(splashView);
  handoffView.setVisible(true);
  if (handoffView.webContents.isLoading()) handoffView.webContents.once('did-finish-load', send);
  else send();
  handoffView.webContents.focus();
}

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
  refreshHandoffOverlay();
}

function destroyView(id) {
  const view = views.get(id);
  if (!view) return;
  win.contentView.removeChildView(view);
  view.webContents.close();
  views.delete(id);
  handoff.delete(id);
  handoffCss.delete(id);
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
  clearUnread(id); // bấm vào xem là hết badge
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

// ---- Chẩn đoán hiệu năng: đo vài chục giây rồi cho biết tab nào ngốn CPU/GPU (có thể chuyển sang app khác trong lúc đo) ----
let perfRunning = false;
async function runPerfDiagnostics(seconds = 10) {
  if (perfRunning) return;
  perfRunning = true;
  new Notification({ title: 'simpleWork', body: T('perfMeasuring', { s: seconds }), silent: true }).show();
  app.getAppMetrics(); // lần đầu chỉ để đặt mốc, CPU tính từ lần gọi trước
  const stats = new Map(); // tên -> { sum, max, wake, mb, n }
  const states = [];
  const sample = () => {
    const metrics = app.getAppMetrics();
    const byPid = new Map(metrics.map((m) => [m.pid, m]));
    const record = (name, pid) => {
      const m = byPid.get(pid);
      if (!m) return;
      const r = stats.get(name) || { sum: 0, max: 0, wake: 0, mb: 0, n: 0 };
      r.sum += m.cpu.percentCPUUsage;
      r.max = Math.max(r.max, m.cpu.percentCPUUsage);
      r.wake += m.cpu.idleWakeupsPerSecond;
      r.mb = Math.max(r.mb, (m.memory.workingSetSize || 0) / 1024);
      r.n += 1;
      stats.set(name, r);
    };
    for (const [id, v] of views) {
      if (v.webContents.isDestroyed()) continue;
      const t = tabById(id);
      record(`${t ? t.name : id}${t && t.keepAlive ? ' (keepAlive)' : ''}`, v.webContents.getOSProcessId());
    }
    if (win && !win.isDestroyed()) record('Thanh bên (giao diện simpleWork)', win.webContents.getOSProcessId());
    for (const m of metrics) if (m.type === 'GPU') record('GPU (vẽ khung hình)', m.pid);
    record('Tiến trình chính', process.pid);
    states.push(`${win && win.isFocused() ? 'focus' : 'nền'}/${win && win.isVisible() ? 'hiện' : 'ẩn'}`);
  };
  const steps = Math.max(1, Math.round(seconds / 5));
  for (let i = 0; i < steps; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    sample();
  }
  const rows = [...stats].map(([name, r]) => ({ name, avg: r.sum / r.n, max: r.max, wake: r.wake / r.n, mb: r.mb })).sort((a, b) => b.avg - a.avg);
  const total = rows.reduce((s, r) => s + r.avg, 0);
  const lines = rows.map((r) => `${r.avg.toFixed(1).padStart(5)}% TB  (đỉnh ${r.max.toFixed(1).padStart(5)}%)  ${String(Math.round(r.wake)).padStart(5)} wake/s  ${String(Math.round(r.mb)).padStart(4)} MB   ${r.name}`);
  const text =
    `Tổng CPU trung bình: ${total.toFixed(1)}%  (đo ${seconds} giây, ${new Date().toISOString()})\n` +
    `Đang xem: ${activeId}. Trạng thái cửa sổ qua từng nhịp 5s: ${states.join(' ')}\n\n${lines.join('\n')}`;
  logNotify('PERF\n' + text);
  perfRunning = false;
  dialog.showMessageBox({ type: 'info', title: 'simpleWork', message: T('perfTitle'), detail: text, buttons: ['OK'] });
}

// ---- Cửa sổ About + menu của app ----
function showAbout() {
  if (aboutWin && !aboutWin.isDestroyed()) {
    aboutWin.show();
    aboutWin.focus();
    return;
  }
  aboutWin = new BrowserWindow({
    width: 340,
    height: 372,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: T('menuAbout'),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: bgColor(),
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true }
  });
  aboutWin.loadFile(path.join(__dirname, 'about.html'));
  aboutWin.once('ready-to-show', () => aboutWin.show());
  aboutWin.webContents.on('did-finish-load', sendAboutData);
  aboutWin.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  aboutWin.on('closed', () => {
    aboutWin = null;
  });
}

// Số build do scripts/build.js ghi vào lúc build (không có khi chạy npm start)
function buildNumber() {
  try {
    return require('./build-info.json').build || null;
  } catch {
    return null;
  }
}

function sendAboutData() {
  if (!aboutWin || aboutWin.isDestroyed()) return;
  aboutWin.setTitle(T('menuAbout'));
  const build = buildNumber();
  aboutWin.webContents.send('about:data', {
    version: app.getVersion() + (build ? ` (${build})` : ''),
    lang: settings.lang,
    accent: settings.accent,
    year: new Date().getFullYear()
  });
}

function buildAppMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'simpleWork',
        submenu: [
          { label: T('menuAbout'), click: showAbout },
          { type: 'separator' },
          {
            label: T('traySettings'),
            accelerator: 'Cmd+,',
            click: () => {
              showWindow();
              setSettingsOpen(true);
            }
          },
          { label: T('menuPerf'), click: () => runPerfDiagnostics(10) },
          { label: T('menuPerfLong'), click: () => runPerfDiagnostics(60) },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      { role: 'editMenu' },
      { role: 'windowMenu' }
    ])
  );
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
    backgroundColor: bgColor(), // flat: nền đặc, không kính mờ
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 13, y: 10 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('resize', layout);
  win.on('focus', () => {
    if (activeId && !settingsOpen) clearUnread(activeId);
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
    handoffView = null;
    handoff.clear();
    settingsOpen = false;
  });
}

// ---- Giữ máy thức (chỉ khi cắm sạc và người dùng bật) ----
// 'prevent-app-suspension' giữ cả hệ thống thức (macOS: NoIdleSleepAssertion), nên phải nhả khi chạy pin hoặc khi tắt.
// powerMonitor.isOnBatteryPower() của Electron có thể báo sai (đã gặp: máy chạy pin mà trả về false),
// nên hỏi thẳng macOS bằng `pmset -g batt`. Máy không có pin (Mac để bàn) thì pmset không báo "Battery Power".
let keepAwakeId = null;
let keepAwakeTimer = null;
let keepAwakeSyncing = false;
let keepAwakeAgain = false;

// Sau khi máy ngủ (gập màn hình...), kết nối của các trang chat đã đứt và có thể kẹt không tải tin mới.
// Tải lại các app không đang xem để tin nhắn về lại ngay (bỏ qua app đang xem, app đang bị khoá ở trình duyệt).
let sleepStartedAt = 0;
function refreshAfterWake() {
  const slept = sleepStartedAt ? Date.now() - sleepStartedAt : 0;
  sleepStartedAt = 0;
  if (!settings.reloadOnWake || slept < 60 * 1000) return;
  setTimeout(() => {
    const reloaded = [];
    for (const [id, v] of views) {
      if (v.webContents.isDestroyed() || handoff.has(id) || isViewing(id)) continue;
      v.webContents.reload();
      reloaded.push(id);
    }
    logNotify(`tải lại sau khi máy ngủ ${Math.round(slept / 60000)} phút: [${reloaded}]`);
  }, 6000); // chờ mạng nối lại
}

function pmsetOnBattery() {
  return new Promise((resolve) => {
    execFile('/usr/bin/pmset', ['-g', 'batt'], { timeout: 4000 }, (err, out) => resolve(!err && /Battery Power/.test(String(out))));
  });
}

async function syncKeepAwake(reason = 'sync') {
  if (keepAwakeSyncing) {
    keepAwakeAgain = true; // đang chạy dở thì chạy lại sau, tránh bật hai lần
    return;
  }
  keepAwakeSyncing = true;
  try {
    const electronSays = powerMonitor.isOnBatteryPower();
    const pmsetSays = await pmsetOnBattery();
    const onBattery = electronSays || pmsetSays;
    // Cắm sạc và chạy pin có công tắc riêng. Gập màn hình thì macOS vẫn ngủ (app không chặn được và không nên chặn).
    const want = onBattery ? settings.keepAwakeBattery : settings.keepAwakeAc;
    const active = keepAwakeId !== null && powerSaveBlocker.isStarted(keepAwakeId);
    if (want && !active) {
      keepAwakeId = powerSaveBlocker.start('prevent-app-suspension');
      logNotify(`keepAwake BẬT (${reason}) pin: electron=${electronSays} pmset=${pmsetSays}`);
    } else if (!want && keepAwakeId !== null) {
      powerSaveBlocker.stop(keepAwakeId);
      keepAwakeId = null;
      // Nếu pmset vẫn thấy simpleWork giữ máy thì thủ phạm là trang web (âm thanh, cuộc gọi...), liệt kê các tab đang phát tiếng
      const audible = [...views].filter(([, v]) => !v.webContents.isDestroyed() && v.webContents.isCurrentlyAudible()).map(([id]) => id);
      logNotify(`keepAwake TẮT (${reason}) pin: electron=${electronSays} pmset=${pmsetSays} cắm-sạc=${settings.keepAwakeAc} chạy-pin=${settings.keepAwakeBattery} tab-đang-phát-tiếng=[${audible}]`);
    }
  } finally {
    keepAwakeSyncing = false;
    if (keepAwakeAgain) {
      keepAwakeAgain = false;
      syncKeepAwake('lặp lại');
    }
  }
}

// Kiểm tra định kỳ vì sự kiện rút/cắm sạc của Electron không đáng tin; mỗi lần chỉ chạy `pmset` vài chục mili giây
function startKeepAwakeWatch() {
  syncKeepAwake('khởi động');
  keepAwakeTimer = setInterval(() => syncKeepAwake('kiểm tra 30s'), 30000);
  powerMonitor.on('on-ac', () => syncKeepAwake('cắm sạc'));
  powerMonitor.on('on-battery', () => syncKeepAwake('rút sạc'));
  powerMonitor.on('suspend', () => {
    sleepStartedAt = Date.now();
  });
  powerMonitor.on('resume', () => {
    syncKeepAwake('máy thức dậy');
    refreshAfterWake();
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
  if (tabId && handoff.has(tabId)) {
    logNotify(`skip(đang mở ở trình duyệt) ${tabId}`);
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
    handoff.has(id)
      ? { label: T('menuUseHere', { name: tab.name }), click: () => endHandoff(id) }
      : { label: T('openInBrowserMenu'), click: () => startHandoff(id) }
  ]).popup({ window: win });
});
ipcMain.on('tabs:ready', sendState);
ipcMain.on('handoff:release', () => {
  if (activeId) endHandoff(activeId);
});
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
  buildAppMenu();
  sendAboutData();
  sendState(); // cập nhật cả tray (refreshTray) lẫn thanh bên
  if (settingsView) settingsView.webContents.send('settings:state', settingsState());
});
ipcMain.on('settings:set-notify-sound', (_e, on) => {
  settings.notifySound = !!on;
  settingsStore.save(settings);
  if (settingsView) settingsView.webContents.send('settings:state', settingsState());
});
ipcMain.on('settings:set-keep-awake', (_e, on) => {
  if (typeof on.ac === 'boolean') settings.keepAwakeAc = on.ac;
  if (typeof on.battery === 'boolean') settings.keepAwakeBattery = on.battery;
  settingsStore.save(settings);
  syncKeepAwake('đổi công tắc');
  if (settingsView) settingsView.webContents.send('settings:state', settingsState());
});
ipcMain.on('settings:set-reload-on-wake', (_e, on) => {
  settings.reloadOnWake = !!on;
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
  // Giữ máy thức để nhận thông báo, nhưng CHỈ khi cắm sạc (chạy pin thì để máy ngủ bình thường)
  startKeepAwakeWatch();
  nativeTheme.themeSource = settings.theme;
  nativeTheme.on('updated', () => {
    if (win && !win.isDestroyed()) win.setBackgroundColor(bgColor());
    if (settingsView) settingsView.setBackgroundColor(cardColor());
    for (const v of views.values()) v.setBackgroundColor(cardColor());
  });
  createWindow();
  createTray();
  buildAppMenu();
  app.on('activate', () => {
    if (!win) createWindow();
    else win.show();
  });
});

app.on('will-quit', () => {
  if (keepAwakeId !== null) powerSaveBlocker.stop(keepAwakeId);
  keepAwakeId = null;
  clearInterval(keepAwakeTimer);
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
