// Các luồng Electron được chạy với cầu nối giả; mạng và dữ liệu thật không bị tác động.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { Readable, Writable } = require('node:stream');

function load(file, overrides, globals = {}) {
  const context = vm.createContext({
    module: { exports: {} }, console, AbortSignal,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    process: { env: {}, versions: { chrome: 'test' } }, __dirname: path.join(__dirname, '..', 'src'),
    require: (name) => name in overrides ? overrides[name] : name.startsWith('./') ? require('../src/' + name.slice(2)) : require(name),
    ...globals
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8'), context);
  return context;
}

function updater(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-runtime-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const bytes = Buffer.alloc(128 * 1024, 'a');
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  let build = 35, popups = 0;
  const settings = {};
  const net = { fetch: async (url) => {
    if (url.endsWith('/latest')) return { status: 200, ok: true, headers: { get: () => null }, json: async () => ({
      assets: [
        { name: `simpleWork-1.11.0-build${build}-arm64.dmg`, browser_download_url: 'https://test/app.dmg' },
        { name: `simpleWork-1.11.0-build${build}-arm64.dmg.sha256`, browser_download_url: 'https://test/app.sha256' }
      ]
    }) };
    if (url.endsWith('.sha256')) return { text: async () => options.badHash ? '0'.repeat(64) : hash };
    return { ok: true, headers: { get: () => bytes.length }, body: options.body ? options.body(bytes) : Readable.from([bytes]) };
  }};
  const context = load('updater.js', {
    electron: { app: { getPath: () => dir, getVersion: () => '1.11.0' }, net },
    fs: options.writeError ? { ...fs, createWriteStream: () => new Writable({ write(_chunk, _enc, cb) { cb(Object.assign(new Error('disk full'), { code: 'ENOSPC' })); } }) } : fs
  }, { process: { env: { SW_UPDATE_URL: 'https://test/latest', SW_UPDATE_BUNDLE: path.join(dir, 'simpleWork.app') } }, console: { ...console, error() {} } });
  const api = context.module.exports;
  api.init({ settings: () => settings, save() {}, buildNumber: () => 34, T: (x) => x, onState() {}, showPopup: () => popups++ });
  return { api, dir, settings, setBuild: (n) => { build = n; }, popups: () => popups };
}

test('updater: dismiss áp dụng riêng từng build, kiểm tra tay vẫn mở popup', async (t) => {
  const u = updater(t);
  await u.api.check();
  u.api.dismiss();
  assert.equal(u.settings.updateDismissed, '1.11.0-build35');
  await u.api.check();
  assert.equal(u.popups(), 1);
  u.setBuild(36);
  await u.api.check();
  assert.equal(u.popups(), 2);
  assert.equal(u.api.getState().latest.build, 36);
  u.api.dismiss();
  await u.api.check({ manual: true });
  assert.equal(u.popups(), 3);
});

test('updater: tải file thật, kiểm hash và nhận build mới sau khi đã tải xong', async (t) => {
  const u = updater(t);
  await u.api.check();
  await u.api.download();
  assert.equal(u.api.getState().status, 'ready');
  assert.equal(fs.statSync(path.join(u.dir, 'updates/simpleWork-1.11.0-build35-arm64.dmg')).size, 128 * 1024);
  await u.api.check();
  assert.equal(u.api.getState().status, 'ready');
  u.setBuild(36);
  await u.api.check();
  assert.equal(u.api.getState().status, 'available');
  assert.equal(u.api.getState().latest.build, 36);
});

test('updater: lỗi ghi file thành U204, không có unhandled error và vẫn nhận build mới', async (t) => {
  const u = updater(t, { writeError: true });
  await u.api.check();
  await u.api.download();
  assert.equal(u.api.getState().status, 'error');
  assert.equal(u.api.getState().errorCode, 'U204');
  assert.equal(fs.readdirSync(path.join(u.dir, 'updates')).length, 0);
  u.setBuild(36);
  await u.api.check();
  assert.equal(u.api.getState().latest.build, 36);
  assert.equal(u.api.getState().status, 'available');
});

test('updater: hash sai thì xoá file tải dở và báo U205', async (t) => {
  const u = updater(t, { badHash: true });
  await u.api.check();
  await u.api.download();
  assert.equal(u.api.getState().errorCode, 'U205');
  assert.equal(fs.readdirSync(path.join(u.dir, 'updates')).length, 0);
});

test('updater: không đổi build giữa lúc tải; nhận build mới ở lần kiểm tra sau', async (t) => {
  let releaseBody;
  const gate = new Promise((resolve) => { releaseBody = resolve; });
  const u = updater(t, { body: (bytes) => Readable.from((async function* () { await gate; yield bytes; })()) });
  await u.api.check();
  const download = u.api.download();
  u.setBuild(36);
  await u.api.check();
  assert.equal(u.api.getState().latest.build, 35);
  releaseBody();
  await download;
  assert.equal(u.api.getState().status, 'ready');
  await u.api.check();
  assert.equal(u.api.getState().latest.build, 36);
});

function agent() {
  const power = new EventEmitter();
  power.getSystemIdleTime = () => 0;
  const timers = [];
  let active = { id: 'a', title: 'A' }, beat = Date.now() - 60 * 60 * 1000, enabled = true;
  const prompts = [], pauses = [];
  let answer;
  const store = {
    view: () => ({ active, todo: [] }), lastBeat: () => beat, hasActive: () => !!active,
    prefs: () => ({ widgetOn: false, shortcutsOn: false, morningOn: false, endOn: false, idleOn: true, idleMin: 10, remindOn: false }),
    rollover() {}, pause: (since) => pauses.push(since)
  };
  const context = load('daytask-agent.js', { electron: {
    powerMonitor: power, ipcMain: { on() {} }, globalShortcut: {},
    dialog: { showMessageBox: (opts) => { prompts.push(opts); return new Promise((resolve) => { answer = resolve; }); } }
  } }, { setTimeout: (fn) => timers.push(fn) });
  context.module.exports.init({ store, enabled: () => enabled, T: (key) => key });
  return { power, timers, prompts, pauses, setBeat: (n) => { beat = n; }, setActive: (a) => { active = a; }, disable: () => { enabled = false; }, answer: (response) => answer({ response }) };
}

test('DayTask: giữ mốc trước ngủ dù heartbeat chạy trước sự kiện resume', async () => {
  const a = agent();
  a.power.emit('suspend');
  a.setBeat(Date.now());
  a.power.emit('resume');
  a.timers.shift()();
  assert.equal(a.prompts.length, 1);
  a.answer(1);
  await new Promise(setImmediate);
  assert.ok(Date.now() - a.pauses[0] >= 59 * 60 * 1000);
});

test('DayTask: không hỏi sau giấc ngủ ngắn', () => {
  const a = agent();
  a.setBeat(Date.now());
  a.power.emit('suspend');
  a.power.emit('resume');
  a.timers.shift()();
  assert.equal(a.prompts.length, 0);
});

test('DayTask: không hỏi nhầm việc mới hoặc khi đã tắt DayTask', () => {
  for (const change of [(a) => a.setActive({ id: 'b', title: 'B' }), (a) => a.disable()]) {
    const a = agent();
    a.power.emit('suspend');
    a.power.emit('resume');
    change(a);
    a.timers.shift()();
    assert.equal(a.prompts.length, 0);
  }
});

test('DayTask: trả lời hộp thoại cũ không dừng việc mới', async () => {
  const a = agent();
  a.power.emit('suspend');
  a.power.emit('resume');
  a.timers.shift()();
  assert.equal(a.prompts.length, 1);
  a.setActive({ id: 'b', title: 'B' });
  a.answer(1);
  await new Promise(setImmediate);
  assert.equal(a.pauses.length, 0);
});

test('thông báo chat vẫn hiện và tăng badge khi DayTask che tab chat', () => {
  const handlers = new Map();
  let shown = 0;
  class Notification extends EventEmitter {
    static isSupported() { return true; }
    show() { shown++; }
  }
  const context = load('main.js', {
    electron: {
      app: { commandLine: { appendSwitch() {} }, whenReady: () => ({ then() {} }), on() {}, getVersion: () => '1.11.0', dock: { setBadge() {} } },
      ipcMain: { on: (name, fn) => handlers.set(name, fn), handle() {} },
      Notification, nativeTheme: { shouldUseDarkColors: false }
    },
    fs: { existsSync: () => false, appendFileSync() {} },
    './theme': { resolveTheme: () => null }
  });
  vm.runInContext(`
    settings.disabled = ['daytask'];
    win = { isVisible: () => true, isFocused: () => true, webContents: { send() {} } };
    activeId = 'zalo';
    dayOpen = true;
    views.set('zalo', { webContents: {} });
  `, context);
  const sender = vm.runInContext("views.get('zalo').webContents", context);
  handlers.get('notify:show')({ sender }, { id: 1, title: 'Tin mới', body: 'test' });
  assert.equal(shown, 1);
  assert.equal(vm.runInContext("unread.get('zalo')", context), 1);
  vm.runInContext('dayOpen = false', context);
  handlers.get('notify:show')({ sender }, { id: 2, title: 'Đang xem', body: 'test' });
  assert.equal(shown, 1);
});
