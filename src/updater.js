// Cập nhật tự động: hỏi GitHub Releases, tải dmg về nền, kiểm SHA-256, rồi để người dùng bấm mới thay app.
// Không dùng electron-updater vì nó cần chữ ký Developer ID; app này ký ad-hoc.
const { app, net } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const core = require('./updater-core');

const API = process.env.SW_UPDATE_URL || 'https://api.github.com/repos/linhtrantm/simpleWorkapp/releases/latest';
const FIRST_CHECK_MS = 30 * 1000;
const EVERY_MS = 6 * 60 * 60 * 1000;

let ctx = null; // { settings: () => settings, save, buildNumber, T, notify(title, body), onState(state), quit }
let timer = null;
let busy = false;
let latest = null; // bản phát hành mới nhất đã parse (nếu mới hơn bản đang chạy)
let dmgPath = null; // file dmg đã tải và kiểm hash xong
let state = { status: 'idle', current: { version: '', build: null }, latest: null, progress: 0, error: '', canInstall: false };

const dir = () => path.join(app.getPath('userData'), 'updates');

// Đường dẫn gói .app đang chạy; chỉ cài được khi là app đóng gói và thư mục chứa nó ghi được
function appBundle() {
  if (process.env.SW_UPDATE_URL && process.env.SW_UPDATE_BUNDLE) return process.env.SW_UPDATE_BUNDLE; // chỉ để test với máy chủ giả
  if (!app.isPackaged) return null;
  const bundle = path.resolve(process.execPath, '..', '..', '..');
  if (!bundle.endsWith('.app')) return null;
  try {
    fs.accessSync(path.dirname(bundle), fs.constants.W_OK);
    return bundle;
  } catch {
    return null;
  }
}

function set(patch) {
  state = { ...state, ...patch, current: { version: app.getVersion(), build: ctx.buildNumber() }, canInstall: !!appBundle() };
  ctx.onState(state);
}

async function getJson(url) {
  const res = await net.fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'simpleWork-updater' }, signal: AbortSignal.timeout(15000) });
  if (res.status === 404) return null; // chưa có release nào
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// Chỉ nhận https (trừ khi đang test với SW_UPDATE_URL)
const urlOk = (u) => /^https:\/\//.test(u) || (!!process.env.SW_UPDATE_URL && /^http:\/\/127\.0\.0\.1[:/]/.test(u));

async function download(rel) {
  if (!urlOk(rel.dmg.url) || !rel.sha || !urlOk(rel.sha.url)) throw new Error('release thiếu file dmg hoặc .sha256 hợp lệ');
  fs.mkdirSync(dir(), { recursive: true });
  const final = path.join(dir(), rel.dmg.name);
  const part = final + '.part';
  const want = core.parseSha(await (await net.fetch(rel.sha.url, { signal: AbortSignal.timeout(15000) })).text());
  if (!want) throw new Error('file .sha256 không đọc được');
  if (fs.existsSync(final) && (await sha256File(final)) === want) return final; // đã tải xong từ trước
  const res = await net.fetch(rel.dmg.url, { signal: AbortSignal.timeout(30 * 60 * 1000) });
  if (!res.ok || !res.body) throw new Error('tải dmg: HTTP ' + res.status);
  const total = Number(res.headers.get('content-length')) || rel.dmg.size || 0;
  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(part);
  let got = 0;
  let lastPct = -1;
  try {
    for await (const chunk of res.body) {
      hash.update(chunk);
      got += chunk.length;
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
      const pct = total ? Math.floor((got / total) * 100) : 0;
      if (pct !== lastPct) {
        lastPct = pct;
        set({ status: 'downloading', progress: pct });
      }
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
  } catch (err) {
    out.destroy();
    fs.rmSync(part, { force: true });
    throw err;
  }
  if (hash.digest('hex') !== want) {
    fs.rmSync(part, { force: true });
    throw new Error('SHA-256 không khớp, bỏ file đã tải');
  }
  fs.renameSync(part, final);
  return final;
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file).on('data', (c) => h.update(c)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });
}

// Dọn các dmg cũ trong thư mục cập nhật, chỉ giữ file của bản vừa tải
function cleanup(keep) {
  try {
    for (const f of fs.readdirSync(dir())) if (f !== keep && f !== 'install.log') fs.rmSync(path.join(dir(), f), { force: true, recursive: true });
  } catch {}
}

async function check({ manual = false } = {}) {
  if (busy) return state;
  busy = true;
  try {
    set({ status: 'checking', error: '' });
    const rel = core.parseRelease(await getJson(API));
    if (!rel || !core.isNewer({ version: app.getVersion(), build: ctx.buildNumber() }, rel)) {
      latest = null;
      dmgPath = null;
      set({ status: 'uptodate', latest: null, progress: 0 });
      return state;
    }
    latest = rel;
    const info = { version: rel.version, build: rel.build, notes: rel.notes };
    if (!appBundle()) {
      set({ status: 'available', latest: info }); // chạy từ npm start hoặc app ở nơi không ghi được: chỉ báo
      return state;
    }
    set({ status: 'downloading', latest: info, progress: 0 });
    dmgPath = await download(rel);
    cleanup(path.basename(dmgPath));
    set({ status: 'ready', latest: info, progress: 100 });
    const s = ctx.settings();
    if (s.updateNotified !== rel.version) {
      s.updateNotified = rel.version;
      ctx.save();
      ctx.notify(ctx.T('updNotifyTitle'), ctx.T('updNotifyBody', { v: rel.version }));
    }
  } catch (err) {
    // lỗi mạng khi tự kiểm tra thì im lặng, chỉ báo khi người dùng chủ động bấm
    set(manual ? { status: 'error', error: String(err.message || err) } : { status: state.latest ? 'available' : 'idle' });
  } finally {
    busy = false;
  }
  return state;
}

// Bấm "Cập nhật và khởi động lại": ghi script rồi thoát app, script thay app và mở lại
function install() {
  const bundle = appBundle();
  if (state.status !== 'ready' || !dmgPath || !bundle || !fs.existsSync(dmgPath)) return false;
  const script = path.join(dir(), 'install.sh');
  fs.writeFileSync(script, core.installScript({ pid: process.pid, dmg: dmgPath, app: bundle, log: path.join(dir(), 'install.log') }), { mode: 0o755 });
  spawn('/bin/bash', [script], { detached: true, stdio: 'ignore' }).unref();
  ctx.quit();
  return true;
}

function schedule() {
  clearInterval(timer);
  timer = setInterval(() => ctx.settings().autoCheckUpdates !== false && check(), EVERY_MS);
}

function init(c) {
  ctx = c;
  set({});
  setTimeout(() => ctx.settings().autoCheckUpdates !== false && check(), FIRST_CHECK_MS);
  schedule();
}

module.exports = { init, check, install, getState: () => state };
