// Phần "chạy ngầm" của Việc hôm nay: thông báo buổi sáng và tổng kết, hỏi khi máy im, nhắc chưa chọn việc,
// phím tắt toàn hệ thống và widget nổi. Chỉ chạy khi mục Việc hôm nay đang bật.
const { BrowserWindow, Notification, dialog, globalShortcut, powerMonitor, screen, ipcMain } = require('electron');
const path = require('path');

const MORNING_CUTOFF = '12:00'; // lỡ giờ sáng mà tới trưa mới mở máy thì không báo "buổi sáng" nữa
const REMIND_AFTER_MS = 15 * 60 * 1000; // chưa chọn việc đang làm quá 15 phút (lúc người dùng đang dùng máy) thì nhắc
const REMIND_EVERY_MS = 30 * 60 * 1000;
const KEYS = {
  pause: 'CommandOrControl+Alt+P',
  done: 'CommandOrControl+Alt+D',
  open: 'CommandOrControl+Alt+T'
};

let ctx = null; // { store, T, openPage, enabled }
let widget = null;
let widgetPosTimer = null;
let idleSince = null;
let prompting = false;
let noActiveSince = null;
let lastRemind = 0;
let shortcutsOn = false;

const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const fmtDur = (ms) => {
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m}m`;
};

function notify(title, body) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, silent: false });
  n.on('click', () => ctx.openPage());
  n.show();
}

// ---- Thông báo buổi sáng và tổng kết cuối ngày ----
function morning(now, p) {
  if (!p.morningOn || ctx.store.marked('morning')) return;
  const t = hhmm(now);
  if (t < p.morningTime || t >= MORNING_CUTOFF) return;
  ctx.store.mark('morning');
  const info = ctx.store.morningInfo();
  const lines = [];
  lines.push(info.count ? ctx.T('dayMorningBody', { count: info.count, names: info.titles.join(', ') + (info.count > info.titles.length ? '…' : '') }) : ctx.T('dayMorningEmpty'));
  if (info.carry) lines.push(ctx.T('dayMorningCarry', { count: info.carry }));
  notify(ctx.T('dayMorningTitle'), lines.join('\n'));
}

function evening(now, p) {
  if (!p.endOn || ctx.store.marked('summary') || hhmm(now) < p.endTime) return;
  ctx.store.mark('summary');
  const s = ctx.store.summary();
  if (!s.total && !s.trackedMs) return;
  const lines = [ctx.T('daySummaryBody', { done: s.done, total: s.total, time: fmtDur(s.trackedMs) })];
  if (s.top) lines.push(ctx.T('daySummaryTop', { name: s.top.title, time: fmtDur(s.top.ms) }));
  if (s.left) lines.push(ctx.T('daySummaryLeft', { count: s.left }));
  notify(ctx.T('daySummaryTitle'), lines.join('\n'));
}

// ---- Máy im: hỏi người dùng có còn làm việc đang chạy không ----
async function askIdle(since) {
  if (prompting) return;
  prompting = true;
  try {
    const v = ctx.store.view();
    if (!v.active) return;
    const min = Math.max(1, Math.round((Date.now() - since) / 60000));
    const { response } = await dialog.showMessageBox({
      type: 'question',
      message: ctx.T('dayIdleTitle', { min }),
      detail: ctx.T('dayIdleDetail', { name: v.active.title }),
      buttons: [ctx.T('dayIdleKeep'), ctx.T('dayIdleStopAt'), ctx.T('dayIdlePause')],
      defaultId: 0,
      cancelId: 0
    });
    if (!ctx.store.hasActive()) return; // trong lúc hộp thoại mở, người dùng đã tự dừng
    if (response === 1) ctx.store.pause(since);
    else if (response === 2) ctx.store.pause();
  } finally {
    prompting = false;
    idleSince = null;
  }
}

function idle(p) {
  if (!p.idleOn || !ctx.store.hasActive()) {
    idleSince = null;
    return;
  }
  const idleSec = powerMonitor.getSystemIdleTime();
  if (idleSec >= p.idleMin * 60 && !idleSince) idleSince = Date.now() - idleSec * 1000;
  if (idleSince && idleSec < 20 && !prompting) askIdle(idleSince); // người dùng đã quay lại
}

// ---- Nhắc chưa chọn việc đang làm ----
function remind(now, p) {
  const v = ctx.store.view();
  const working = hhmm(now) >= p.morningTime && hhmm(now) < p.endTime;
  const userHere = powerMonitor.getSystemIdleTime() < 60;
  if (!p.remindOn || !working || !userHere || v.active || !v.todo.length) {
    noActiveSince = null;
    return;
  }
  const t = now.getTime();
  if (!noActiveSince) noActiveSince = t;
  if (t - noActiveSince >= REMIND_AFTER_MS && t - lastRemind >= REMIND_EVERY_MS) {
    lastRemind = t;
    notify(ctx.T('dayRemindTitle'), ctx.T('dayRemindBody', { count: v.todo.length }));
  }
}

function tick() {
  if (!ctx.enabled()) return;
  ctx.store.rollover();
  const now = new Date();
  const p = ctx.store.prefs();
  morning(now, p);
  evening(now, p);
  idle(p);
  remind(now, p);
}

// ---- Phím tắt toàn hệ thống ----
function runToggle() {
  const v = ctx.store.view();
  if (v.active) return ctx.store.pause();
  const paused = v.todo.filter((t) => t.state === 'paused');
  const target = paused[0] || v.todo[0];
  if (target) ctx.store.start(target.id);
}

function syncShortcuts() {
  const want = ctx.enabled() && ctx.store.prefs().shortcutsOn;
  if (want === shortcutsOn) return;
  shortcutsOn = want;
  if (want) {
    globalShortcut.register(KEYS.pause, runToggle);
    globalShortcut.register(KEYS.done, () => ctx.store.done());
    globalShortcut.register(KEYS.open, () => ctx.openPage());
  } else {
    for (const k of Object.values(KEYS)) globalShortcut.unregister(k);
  }
}

// ---- Widget nổi ----
function defaultPos(w) {
  const wa = screen.getPrimaryDisplay().workArea;
  return { x: wa.x + wa.width - w - 24, y: wa.y + 48 };
}

function visiblePos(pos, w, h) {
  if (!pos) return null;
  const ok = screen.getAllDisplays().some((d) => {
    const b = d.workArea;
    return pos.x + 40 >= b.x && pos.x + w - 40 <= b.x + b.width && pos.y >= b.y && pos.y + 40 <= b.y + b.height;
  });
  return ok ? pos : null;
}

function syncWidget() {
  const want = ctx.enabled() && ctx.store.prefs().widgetOn;
  if (!want) {
    if (widget && !widget.isDestroyed()) widget.destroy();
    widget = null;
    return;
  }
  if (widget && !widget.isDestroyed()) return;
  const W = 280;
  const H = 120;
  const pos = visiblePos(ctx.store.widgetPos(), W, H) || defaultPos(W);
  widget = new BrowserWindow({
    width: W, height: H, x: pos.x, y: pos.y,
    frame: false, transparent: true, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    hasShadow: true, skipTaskbar: true, show: false, alwaysOnTop: true,
    webPreferences: { preload: path.join(__dirname, 'daytask-preload.js'), contextIsolation: true, sandbox: true }
  });
  widget.setAlwaysOnTop(true, 'floating');
  widget.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  widget.loadFile(path.join(__dirname, 'daytask-widget.html'));
  widget.once('ready-to-show', () => widget && !widget.isDestroyed() && widget.showInactive());
  widget.on('moved', () => {
    clearTimeout(widgetPosTimer);
    widgetPosTimer = setTimeout(() => {
      if (widget && !widget.isDestroyed()) {
        const [x, y] = widget.getPosition();
        ctx.store.setWidgetPos({ x, y });
      }
    }, 400);
  });
  widget.on('closed', () => {
    widget = null;
  });
}

function sync() {
  if (!ctx) return;
  syncShortcuts();
  syncWidget();
  // dữ liệu vừa đổi: widget vẽ lại
  if (widget && !widget.isDestroyed() && !widget.webContents.isLoading()) widget.webContents.send('daytask:changed');
}

function init(c) {
  ctx = c;
  ipcMain.on('daytask:open', () => ctx.openPage());
  ipcMain.on('daytask:widget-size', (_e, h) => {
    if (widget && !widget.isDestroyed() && Number.isFinite(h)) widget.setContentSize(280, Math.max(80, Math.min(400, Math.round(h))));
  });
  ipcMain.on('daytask:widget-hide', () => ctx.store.setPrefs({ widgetOn: false }));
  powerMonitor.on('resume', () => {
    if (!ctx.enabled()) return;
    // Máy vừa thức dậy: qua ngày mới thì sinh việc, báo sáng nếu lỡ giờ; việc đang chạy thì hỏi xem phần máy ngủ có tính không
    setTimeout(() => {
      tick();
      const beat = ctx.store.lastBeat();
      const p = ctx.store.prefs();
      if (beat && p.idleOn && Date.now() - beat >= p.idleMin * 60 * 1000) askIdle(beat);
    }, 3000);
  });
  sync();
}

function stop() {
  for (const k of Object.values(KEYS)) globalShortcut.unregister(k);
  if (widget && !widget.isDestroyed()) widget.destroy();
  widget = null;
}

module.exports = { init, sync, stop, tick, morning, evening };
