// Test cập nhật tự động: node scripts/test-updater.js
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const core = require('../src/updater-core');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (err) {
    console.error('FAIL  ' + name + '\n      ' + err.message);
    process.exitCode = 1;
  }
}

const release = (over = {}) => ({
  tag_name: 'v1.6.0-build22',
  draft: false,
  prerelease: false,
  body: 'Ghi chú',
  assets: [
    { name: 'simpleWork-1.6.0-build22-arm64.dmg', browser_download_url: 'https://x/dmg', size: 123 },
    { name: 'simpleWork-1.6.0-build22-arm64.dmg.sha256', browser_download_url: 'https://x/sha' }
  ],
  ...over
});

test('parseRelease lấy phiên bản, build, dmg, sha từ tên asset', () => {
  const r = core.parseRelease(release());
  assert.equal(r.version, '1.6.0');
  assert.equal(r.build, 22);
  assert.equal(r.dmg.url, 'https://x/dmg');
  assert.equal(r.dmg.size, 123);
  assert.equal(r.sha.url, 'https://x/sha');
  assert.equal(r.notes, 'Ghi chú');
});

test('parseRelease bỏ qua bản nháp, bản thử, thiếu dmg, dmg sai tên, dữ liệu rác', () => {
  assert.equal(core.parseRelease(release({ draft: true })), null);
  assert.equal(core.parseRelease(release({ prerelease: true })), null);
  assert.equal(core.parseRelease(release({ assets: [] })), null);
  assert.equal(core.parseRelease(release({ assets: [{ name: 'simpleWork-1.6.0-x64.dmg', browser_download_url: 'u' }] })), null);
  assert.equal(core.parseRelease(release({ assets: [{ name: 'evil-1.6.0-build1-arm64.dmg', browser_download_url: 'u' }] })), null);
  for (const bad of [null, undefined, 5, 'x', {}, { assets: 'no' }]) assert.equal(core.parseRelease(bad), null);
});

test('parseRelease: không có file sha thì sha = null', () => {
  const r = core.parseRelease(release({ assets: [{ name: 'simpleWork-1.6.0-build22-arm64.dmg', browser_download_url: 'u' }] }));
  assert.equal(r.sha, null);
});

test('isNewer so semver rồi so build', () => {
  const v = (version, build) => ({ version, build });
  assert.equal(core.isNewer(v('1.5.0', 21), v('1.5.1', 1)), true);
  assert.equal(core.isNewer(v('1.5.9', 99), v('1.6.0', 1)), true);
  assert.equal(core.isNewer(v('1.9.0', 5), v('2.0.0', 1)), true);
  assert.equal(core.isNewer(v('1.5.0', 21), v('1.5.0', 22)), true);
  assert.equal(core.isNewer(v('1.5.0', 21), v('1.5.0', 21)), false);
  assert.equal(core.isNewer(v('1.6.0', 5), v('1.5.9', 99)), false);
  assert.equal(core.isNewer(v('1.10.0', 1), v('1.9.0', 1)), false); // so số, không so chuỗi
  assert.equal(core.isNewer(v('1.5.0', null), v('1.5.0', 3)), true); // chạy từ npm start: không có số build
});

test('isNewer: giá trị rác thì không bao giờ báo có bản mới', () => {
  const ok = { version: '1.5.0', build: 1 };
  for (const bad of [null, undefined, {}, { version: 'abc' }, { version: '1.5' }, { version: '1.5.0-beta' }]) {
    assert.equal(core.isNewer(ok, bad), false);
    assert.equal(core.isNewer(bad, ok), false);
  }
});

test('parseSha lấy đúng hash, chấp nhận định dạng shasum, từ chối hash ngắn hoặc sai', () => {
  const h = 'a'.repeat(64);
  assert.equal(core.parseSha(h), h);
  assert.equal(core.parseSha(`${h.toUpperCase()}  simpleWork.dmg\n`), h);
  assert.equal(core.parseSha('abc'), null);
  assert.equal(core.parseSha('z'.repeat(64)), null);
  assert.equal(core.parseSha(null), null);
});

test('installScript: quote đúng đường dẫn có dấu cách và nháy đơn', () => {
  const s = core.installScript({ pid: 42, dmg: "/tmp/a b/it's.dmg", app: '/Applications/simple Work.app', log: '/tmp/l.log' });
  assert.ok(s.includes(`DMG='/tmp/a b/it'\\''s.dmg'`));
  assert.ok(s.includes(`APP='/Applications/simple Work.app'`));
  assert.ok(s.includes('PID=42'));
  assert.equal(spawnSync('bash', ['-n'], { input: s }).status, 0, 'cú pháp bash hợp lệ');
});

test('installScript: pid rác không chèn được lệnh', () => {
  const s = core.installScript({ pid: '1; rm -rf /', dmg: 'a', app: 'b', log: 'c' });
  assert.ok(s.includes('PID=0'));
  assert.ok(!s.includes('rm -rf /\n'));
});

// ---- Chạy script thật trên thư mục tạm (không đụng /Applications) ----
function sandbox(version) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-upd-'));
  const mkApp = (root, ver) => {
    const app = path.join(root, 'simpleWork.app', 'Contents');
    fs.mkdirSync(path.join(app, 'MacOS'), { recursive: true });
    fs.writeFileSync(path.join(app, 'ver.txt'), ver);
    return path.join(root, 'simpleWork.app');
  };
  const src = path.join(dir, 'src');
  fs.mkdirSync(src);
  mkApp(src, version);
  const dmg = path.join(dir, 'new.dmg');
  const r = spawnSync('hdiutil', ['create', '-quiet', '-srcfolder', src, '-volname', 'swtest', '-format', 'UDZO', dmg]);
  assert.equal(r.status, 0, 'tạo dmg thử: ' + String(r.stderr));
  const inst = path.join(dir, 'Applications');
  fs.mkdirSync(inst);
  const app = mkApp(inst, 'old');
  return { dir, dmg, app, inst, log: path.join(dir, 'install.log') };
}

function run(sb, openCmd, dmgPath) {
  const script = path.join(sb.dir, 'install.sh');
  fs.writeFileSync(script, core.installScript({ pid: 0, dmg: dmgPath || sb.dmg, app: sb.app, log: sb.log, openCmd }), { mode: 0o755 });
  return spawnSync('bash', [script], { encoding: 'utf8' });
}

test('script thay app thật: app mới vào chỗ, bản cũ và dmg bị dọn', () => {
  const sb = sandbox('new');
  run(sb, 'true');
  assert.equal(fs.readFileSync(path.join(sb.app, 'Contents', 'ver.txt'), 'utf8'), 'new');
  assert.equal(fs.existsSync(sb.app + '.old'), false);
  assert.equal(fs.existsSync(sb.app + '.new'), false);
  assert.equal(fs.existsSync(sb.dmg), false);
  fs.rmSync(sb.dir, { recursive: true, force: true });
});

test('script: mở app mới thất bại thì trả app cũ về', () => {
  const sb = sandbox('new');
  run(sb, 'false');
  assert.equal(fs.readFileSync(path.join(sb.app, 'Contents', 'ver.txt'), 'utf8'), 'old');
  assert.equal(fs.existsSync(sb.app + '.new'), false);
  fs.rmSync(sb.dir, { recursive: true, force: true });
});

test('script: dmg hỏng thì giữ nguyên app cũ', () => {
  const sb = sandbox('new');
  const bad = path.join(sb.dir, 'bad.dmg');
  fs.writeFileSync(bad, 'không phải dmg');
  run(sb, 'true', bad);
  assert.equal(fs.readFileSync(path.join(sb.app, 'Contents', 'ver.txt'), 'utf8'), 'old');
  assert.ok(fs.readFileSync(sb.log, 'utf8').includes('lỗi'));
  fs.rmSync(sb.dir, { recursive: true, force: true });
});

console.log(`\n${passed} test đạt${process.exitCode ? ', CÓ TEST LỖI' : ''}`);
