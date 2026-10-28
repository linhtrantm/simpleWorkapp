// Đăng bản build hiện tại lên GitHub Releases để các máy khác tự cập nhật.
// Dùng sau `npm run dist`:  npm run release -- "Ghi chú bản này"
// Cần `gh` (brew install gh) đã đăng nhập (gh auth login). Chỉ đăng khi cây git sạch và người dùng gõ y.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const fail = (msg) => {
  console.error('Dừng: ' + msg);
  process.exit(1);
};
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', ...opts });

const version = require(path.join(root, 'package.json')).version;
const build = JSON.parse(fs.readFileSync(path.join(root, 'build', 'build-number.json'), 'utf8')).build;
const name = `simpleWork-${version}-build${build}-arm64.dmg`;
const dmg = path.join(root, 'dist', name);
const tag = `v${version}-build${build}`;
// Ghi chú hiện trong popup cập nhật của app. Không gõ thì lấy tiêu đề các commit từ bản phát hành trước tới giờ.
function autoNotes() {
  const last = run('gh', ['release', 'list', '--limit', '1', '--json', 'tagName', '-q', '.[0].tagName']).stdout.trim();
  if (last) run('git', ['fetch', '--tags', '--quiet']);
  const range = last && run('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${last}`]).status === 0 ? [`${last}..HEAD`] : ['-8'];
  const subjects = run('git', ['log', '--no-merges', '--pretty=format:%s', ...range]).stdout.split('\n');
  const lines = subjects
    .map((s) => s.replace(/^(feat|fix|chore|docs|refactor|perf|test)(\([^)]*\))?!?:\s*/i, '').trim())
    .filter((s) => s && !/^(số build|đồng bộ version)/i.test(s))
    .map((s) => '- ' + s.charAt(0).toUpperCase() + s.slice(1));
  return lines.join('\n');
}
const notes = process.argv.slice(2).join(' ').trim() || autoNotes() || `simpleWork ${version} (build ${build})`;

if (!fs.existsSync(dmg)) fail(`chưa có ${path.relative(root, dmg)}. Chạy npm run dist trước.`);
if (run('gh', ['--version']).status !== 0) fail('chưa cài gh. Chạy: brew install gh && gh auth login');
if (run('gh', ['auth', 'status']).status !== 0) fail('gh chưa đăng nhập. Chạy: gh auth login');
const dirty = run('git', ['status', '--porcelain', '--untracked-files=no']).stdout.trim();
if (dirty) fail('cây git còn thay đổi chưa commit, commit xong mới đăng:\n' + dirty);
if (run('git', ['tag', '--list', tag]).stdout.trim() || run('gh', ['release', 'view', tag]).status === 0) fail(`đã có release ${tag}. Build lại để tăng số build.`);

const hash = crypto.createHash('sha256').update(fs.readFileSync(dmg)).digest('hex');
const shaFile = dmg + '.sha256';
fs.writeFileSync(shaFile, `${hash}  ${name}\n`);

console.log(`\nSẽ đăng release công khai:\n  tag    ${tag}\n  file   ${name}\n  sha256 ${hash}\n  ghi chú:\n${notes}\n`);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Đăng lên GitHub? (y/N) ', (ans) => {
  rl.close();
  if (ans.trim().toLowerCase() !== 'y') fail('đã huỷ, chưa đăng gì.');
  const r = spawnSync('gh', ['release', 'create', tag, dmg, shaFile, '--title', `simpleWork ${version} (build ${build})`, '--notes', notes], { cwd: root, stdio: 'inherit' });
  process.exit(r.status === null ? 1 : r.status);
});
