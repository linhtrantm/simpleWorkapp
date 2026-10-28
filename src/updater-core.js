// Logic thuần của cập nhật tự động (không đụng mạng hay Electron) để dễ viết test.
'use strict';

const DMG_RE = /^simpleWork-(\d+\.\d+\.\d+)-build(\d+)-arm64\.dmg$/;
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

// Lấy bản phát hành từ phản hồi `releases/latest` của GitHub. Bỏ qua bản nháp, bản thử, hoặc bản không có dmg đúng tên.
function parseRelease(json) {
  if (!json || typeof json !== 'object' || json.draft || json.prerelease || !Array.isArray(json.assets)) return null;
  const dmg = json.assets.find((a) => a && typeof a.name === 'string' && DMG_RE.test(a.name) && typeof a.browser_download_url === 'string');
  if (!dmg) return null;
  const [, version, build] = dmg.name.match(DMG_RE);
  const sha = json.assets.find((a) => a && a.name === dmg.name + '.sha256' && typeof a.browser_download_url === 'string');
  return {
    version,
    build: Number(build),
    tag: typeof json.tag_name === 'string' ? json.tag_name : '',
    url: typeof json.html_url === 'string' && /^https:\/\//.test(json.html_url) ? json.html_url : '',
    notes: typeof json.body === 'string' ? json.body.slice(0, 2000) : '',
    dmg: { name: dmg.name, url: dmg.browser_download_url, size: Number.isFinite(dmg.size) ? dmg.size : 0 },
    sha: sha ? { url: sha.browser_download_url } : null
  };
}

// Ghi chú phát hành (markdown) thành danh sách dòng ngắn để hiện trong popup: bỏ #, **, `, dấu gạch đầu dòng và dòng trống
function cleanNotes(body, max = 12) {
  const lines = [];
  for (const raw of String(body || '').split(/\r?\n/)) {
    const line = raw
      .replace(/^\s{0,3}#{1,6}\s*/, '')
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '')
      .replace(/(\*\*|__|`)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .trim();
    if (line) lines.push(line.length > 160 ? line.slice(0, 159) + '…' : line);
    if (lines.length >= max) break;
  }
  return lines;
}

function semver(v) {
  const m = SEMVER_RE.exec(String(v || ''));
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// cur / next: { version: '1.5.0', build: 21|null }. Giá trị rác thì coi như không mới hơn.
function isNewer(cur, next) {
  const a = semver(cur && cur.version);
  const b = semver(next && next.version);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return b[i] > a[i];
  const ca = Number.isFinite(cur.build) ? cur.build : 0;
  const nb = Number.isFinite(next.build) ? next.build : 0;
  return nb > ca;
}

// File .sha256 có thể là "<hash>" hoặc "<hash>  tên-file" (đầu ra của shasum)
function parseSha(text) {
  const m = /\b([0-9a-f]{64})\b/i.exec(String(text || ''));
  return m ? m[1].toLowerCase() : null;
}

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

// Script bash thay app: chờ app cũ thoát, mở dmg, chép app mới cạnh app cũ, đổi tên, mở lại. Lỗi bước nào thì trả app cũ về.
function installScript({ pid, dmg, app, log, openCmd = 'open' }) {
  return `#!/bin/bash
exec >> ${q(log)} 2>&1
echo "== $(date) cập nhật simpleWork"
PID=${Number(pid) || 0}
DMG=${q(dmg)}
APP=${q(app)}
NEW="$APP.new"
OLD="$APP.old"
MNT=$(mktemp -d /tmp/simplework-update.XXXXXX)
cleanup() { hdiutil detach "$MNT" -quiet -force 2>/dev/null; rmdir "$MNT" 2>/dev/null; }
trap cleanup EXIT
SWAPPED=0
# Lỗi bước nào thì trả app cũ về chỗ cũ (chỉ khi đã đổi tên app cũ) rồi mở lại app cũ
restore() {
  echo "lỗi: $1"
  rm -rf "$NEW"
  if [ "$SWAPPED" = 1 ]; then rm -rf "$APP"; mv "$OLD" "$APP"; fi
  ${openCmd} "$APP"
  exit 1
}
# Lần cập nhật trước chết giữa chừng sau khi đổi tên app cũ: trả về trước
if [ ! -d "$APP" ] && [ -d "$OLD" ]; then mv "$OLD" "$APP"; fi

# PID phải > 0: kill -0 0 gửi tới cả nhóm tiến trình nên luôn "còn sống"
if [ "$PID" -gt 0 ]; then
  for i in $(seq 1 60); do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done
  kill -0 "$PID" 2>/dev/null && { echo "app cũ chưa thoát, bỏ qua"; exit 1; }
fi

hdiutil attach "$DMG" -nobrowse -readonly -noverify -mountpoint "$MNT" -quiet || restore "không mở được dmg"
SRC=$(find "$MNT" -maxdepth 1 -name '*.app' | head -1)
[ -n "$SRC" ] || restore "dmg không có app"
rm -rf "$NEW" "$OLD"
ditto "$SRC" "$NEW" || restore "chép app mới thất bại"
mv "$APP" "$OLD" || restore "không đổi tên app cũ"
SWAPPED=1
mv "$NEW" "$APP" || restore "không đặt app mới vào chỗ"
xattr -cr "$APP"
${openCmd} "$APP" || restore "không mở được app mới"
rm -rf "$OLD" "$DMG"
echo "xong"
`;
}

module.exports = { DMG_RE, cleanNotes, parseRelease, isNewer, parseSha, installScript };
