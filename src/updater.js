// Cập nhật tự động: hỏi GitHub Releases, tải dmg về nền, kiểm SHA-256, rồi để người dùng bấm mới thay app.
// Không dùng electron-updater vì nó cần chữ ký Developer ID; app này ký ad-hoc.
const { app, net } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const core = require('./updater-core');

const API = process.env.SW_UPDATE_URL || 'https://api.github.com/repos/linhtrantm/simpleWorkapp/releases/latest';
// Mỗi 30 giây chỉ hỏi trang web releases/latest (không tính vào giới hạn 60 lượt/giờ của API); chỉ khi tag mới khác tag đang chạy
// mới gọi API một lần để lấy ghi chú và file. Gặp 403/429 thì tạm nghỉ tới giờ GitHub cho phép.
const POLL_MS = Number(process.env.SW_UPDATE_POLL_MS) || 30 * 1000;
const FIRST_CHECK_MS = Number(process.env.SW_UPDATE_FIRST_MS) || 3 * 1000;

let ctx = null; // { settings, save, buildNumber, T, showPopup(), onState(state), quit }
const popupShown = new Set(); // phiên bản đã hiện popup trong lần chạy này
let timer = null;
let busy = false;
let etag = null;
let cachedJson = null;
let blockedUntil = 0;
let probedTag = null; // tag của bản mới nhất lần hỏi trước, để chỉ gọi API khi tag đổi
let lastCheck = 0;
let latest = null; // bản phát hành mới nhất đã parse (nếu mới hơn bản đang chạy)
let dmgPath = null; // file dmg đã tải và kiểm hash xong
let state = { status: 'idle', current: { version: '', build: null }, latest: null, progress: 0, error: '', errorCode: '', canInstall: false };

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

// Lỗi hiển thị cho người dùng: câu chung chung kèm mã; chi tiết thật ghi ra nhật ký
function fail(err) {
  const code = core.errorCode(core.ERRORS[err && err.code] ? err : new core.UpdError(netLike(err) ? 'U101' : 'U999', String((err && err.message) || err)));
  console.error(`[updater] ${code}: ${core.ERRORS[code]} | ${err && err.message}`);
  return { error: `${ctx.T('updBusy')} (${code})`, errorCode: code };
}

// Lỗi từ fetch/mạng (không có mã riêng) coi là U101
const netLike = (err) => !!err && (err.name === 'TimeoutError' || err.name === 'AbortError' || err.name === 'TypeError' || /net::|fetch/i.test(String(err.message)));

function set(patch) {
  state = { ...state, ...patch, current: { version: app.getVersion(), build: ctx.buildNumber() }, canInstall: !!appBundle() };
  ctx.onState(state);
}

// Hỏi trang web releases/latest (chuyển hướng sang tag mới nhất), không dùng API nên không tốn hạn mức 60 lượt/giờ.
// Trả về tag, hoặc null nếu hỏi không được.
async function probeTag() {
  if (process.env.SW_UPDATE_URL) return null; // test với máy chủ giả: luôn đi đường API giả
  return new Promise((resolve) => {
    // net.fetch không cho đọc địa chỉ sau khi chuyển hướng, nên dùng net.request và bắt sự kiện 'redirect'
    const req = net.request({ method: 'HEAD', url: 'https://github.com/linhtrantm/simpleWorkapp/releases/latest', redirect: 'manual' });
    const done = (tag) => {
      clearTimeout(t);
      resolve(tag);
    };
    const t = setTimeout(() => {
      req.abort();
      done(null);
    }, 15000);
    req.on('redirect', (_code, _method, url) => {
      const m = /^https:\/\/github\.com\/linhtrantm\/simpleWorkapp\/releases\/tag\/([\w.\-]+)$/.exec(url);
      req.abort();
      done(m ? m[1] : null);
    });
    req.on('response', () => done(null));
    req.on('error', () => done(null));
    req.end();
  });
}

// Lấy thông tin release. Tag không đổi thì dùng bản đã có; trùng tag đang chạy thì khỏi gọi API.
async function fetchRelease() {
  const tag = await probeTag();
  const cur = `v${app.getVersion()}-build${ctx.buildNumber()}`;
  if (tag && tag === cur) return { skip: true };
  if (tag && tag === probedTag && cachedJson) return cachedJson;
  const json = await getJson(API);
  if (tag) probedTag = tag;
  return json;
}

async function getJson(url) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'simpleWork-updater' };
  if (etag && cachedJson) headers['If-None-Match'] = etag;
  const res = await net.fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (res.status === 304) return cachedJson; // chưa có gì mới, không tốn hạn mức
  if (res.status === 404) return null; // chưa có release nào
  if (res.status === 403 || res.status === 429) {
    const retry = Number(res.headers.get('retry-after'));
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    blockedUntil = Date.now() + (retry ? retry * 1000 : reset ? Math.max(0, reset * 1000 - Date.now()) : 10 * 60 * 1000);
    throw new core.UpdError('U102');
  }
  if (!res.ok) throw new core.UpdError('U103', 'HTTP ' + res.status);
  cachedJson = await res.json();
  etag = res.headers.get('etag');
  return cachedJson;
}

// Chỉ nhận https (trừ khi đang test với SW_UPDATE_URL)
const urlOk = (u) => /^https:\/\//.test(u) || (!!process.env.SW_UPDATE_URL && /^http:\/\/127\.0\.0\.1[:/]/.test(u));

async function download(rel) {
  if (!urlOk(rel.dmg.url) || !rel.sha || !urlOk(rel.sha.url)) throw new core.UpdError('U201');
  fs.mkdirSync(dir(), { recursive: true });
  const final = path.join(dir(), rel.dmg.name);
  const part = final + '.part';
  const want = core.parseSha(await (await net.fetch(rel.sha.url, { signal: AbortSignal.timeout(15000) })).text());
  if (!want) throw new core.UpdError('U202');
  if (fs.existsSync(final) && (await sha256File(final)) === want) return final; // đã tải xong từ trước
  const res = await net.fetch(rel.dmg.url, { signal: AbortSignal.timeout(30 * 60 * 1000) });
  if (!res.ok || !res.body) throw new core.UpdError('U203', 'HTTP ' + res.status);
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
    throw err.code && core.ERRORS[err.code] ? err : new core.UpdError('U204', String(err.message || err));
  }
  if (hash.digest('hex') !== want) {
    fs.rmSync(part, { force: true });
    throw new core.UpdError('U205');
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

// Hỏi GitHub xem có bản mới không. Thấy bản mới thì chỉ báo (popup kèm release note), KHÔNG tự tải: người dùng bấm "Tải về".
async function check({ manual = false } = {}) {
  if (busy || (!manual && Date.now() < blockedUntil)) return state;
  busy = true;
  lastCheck = Date.now();
  // Đang tải hoặc đã tải xong thì các lần hỏi nền không được đè trạng thái đó
  const holding = () => state.status === 'downloading' || state.status === 'ready';
  try {
    if (manual && !holding()) set({ status: 'checking', error: '', errorCode: '' });
    const fetched = await fetchRelease();
    const rel = fetched && fetched.skip ? null : core.parseRelease(fetched);
    if (!rel || !core.isNewer({ version: app.getVersion(), build: ctx.buildNumber() }, rel)) {
      latest = null;
      dmgPath = null;
      set({ status: 'uptodate', latest: null, progress: 0 });
      return state;
    }
    // Đang tải, đã tải, hoặc vừa tải lỗi đúng bản này: giữ nguyên để không mất thanh tiến độ hay thông báo lỗi và nút "Tải lại"
    if ((holding() || state.status === 'error') && state.latest && state.latest.version === rel.version) return state;
    latest = rel;
    dmgPath = null;
    const info = { version: rel.version, build: rel.build, size: rel.dmg.size, notes: rel.notes, lines: core.cleanNotes(rel.notes), url: rel.url };
    set({ status: 'available', latest: info, progress: 0, error: '', errorCode: '' });
    // Popup hiện sau khi trạng thái đã có đủ nội dung, để vẽ xong ngay. Đã bấm "Để sau" cho bản này thì không hiện lại, trừ khi tự bấm Kiểm tra.
    if (manual || (!popupShown.has(rel.version) && ctx.settings().updateDismissed !== rel.version)) {
      popupShown.add(rel.version);
      ctx.showPopup();
    }
  } catch (err) {
    // lỗi mạng khi tự kiểm tra thì im lặng, chỉ báo khi người dùng chủ động bấm
    if (manual && !holding()) set({ status: 'error', ...fail(err) });
    else if (state.status === 'checking') set({ status: state.latest ? 'available' : 'idle' });
  } finally {
    busy = false;
  }
  return state;
}

// Người dùng bấm "Tải về": tải dmg, kiểm hash, xong thì chuyển sang "sẵn sàng cập nhật"
async function downloadLatest() {
  if (!latest || !appBundle() || state.status === 'downloading' || state.status === 'ready') return state;
  const rel = latest;
  try {
    set({ status: 'downloading', progress: 0, error: '', errorCode: '' });
    dmgPath = await download(rel);
    cleanup(path.basename(dmgPath));
    set({ status: 'ready', progress: 100 });
  } catch (err) {
    dmgPath = null;
    set({ status: 'error', ...fail(err) }); // giữ latest để popup hiện nút "Tải lại"
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
  timer = setInterval(() => ctx.settings().autoCheckUpdates !== false && check(), POLL_MS);
}

// Người dùng bấm "Để sau": nhớ bản này để không hiện popup lại
function dismiss() {
  if (!state.latest) return;
  ctx.settings().updateDismissed = state.latest.version;
  ctx.save();
}

// Gọi khi mở lại cửa sổ hoặc máy thức dậy: hỏi ngay thay vì đợi nhịp kế tiếp (cách nhau tối thiểu 10 giây)
function nudge() {
  if (ctx && ctx.settings().autoCheckUpdates !== false && Date.now() - lastCheck > 10 * 1000) check();
}

function init(c) {
  ctx = c;
  set({});
  setTimeout(() => ctx.settings().autoCheckUpdates !== false && check(), FIRST_CHECK_MS);
  schedule();
}

module.exports = { init, check, download: downloadLatest, install, dismiss, nudge, getState: () => state };
