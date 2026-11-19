// Quy tắc cho cửa sổ popup do trang web mở (logic thuần, có test: scripts/test-popup.js).
// Bối cảnh: nhiều trang chat (Zalo...) mở link bằng window.open('about:blank') rồi mới điều hướng cửa sổ đó tới một trang trung gian
// (kiểm tra link an toàn...), sau vài giây mới tới địa chỉ thật. Nếu để cửa sổ hiện ra thì người dùng thấy popup trống đứng yên rồi mới
// thấy trình duyệt mở. Nên: không hiện popup trống, và lấy luôn địa chỉ đích từ link trung gian nếu có để mở ngay ở trình duyệt.

const HTTP = /^https?:\/\//i;

// Giải mã tối đa hai lớp (%25 lồng nhau), trả về chuỗi http(s) hoặc null
function decodeUrl(v) {
  let s = String(v || '');
  for (let i = 0; i < 3; i++) {
    if (HTTP.test(s)) return s;
    try {
      const d = decodeURIComponent(s);
      if (d === s) break;
      s = d;
    } catch {
      break;
    }
  }
  return HTTP.test(s) ? s : null;
}

// Link trung gian kiểu https://link.example/?url=https%3A%2F%2Ftrang-that.com%2Fa -> https://trang-that.com/a.
// isOwn(host) đúng với tên miền của chính app (link vòng về chính nó thì không coi là đích). Trả về null nếu không có đích.
function targetFromRedirector(url, isOwn) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const params = [...u.searchParams.entries()];
  // Hash cũng có thể mang đích (#url=...)
  if (u.hash.includes('=')) params.push(...new URLSearchParams(u.hash.slice(1)).entries());
  for (const [, v] of params) {
    const t = decodeUrl(v);
    if (!t) continue;
    try {
      const host = new URL(t).hostname;
      if (!isOwn(host)) return t;
    } catch {}
  }
  return null;
}

// Chỉ để ghi nhật ký: tên miền + đường dẫn + tên tham số, không ghi giá trị (có thể chứa token)
function redact(url) {
  try {
    const u = new URL(url);
    const names = [...new Set([...u.searchParams.keys()])].join(',');
    return `${u.protocol}//${u.hostname}${u.pathname.slice(0, 40)}${names ? ' ?' + names : ''}`;
  } catch {
    return String(url).slice(0, 40);
  }
}

// Link trung gian: tên miền bắt đầu bằng link./redirect./go./out./away./... hoặc đường dẫn bắt đầu bằng /redirect, /link, /away, /out, /safelink, /leaving...
const REDIR_HOST = /^(link|links|redirect|redir|go|out|away|click|jump|safelink|safe|exit|leaving|r)\d*$/;
const REDIR_PATH = /^\/(redirect|redir|link|away|out|safelink|leaving|exit|jump|goto|go)(\/|$)/i;
function looksLikeRedirector(url) {
  try {
    const u = new URL(url);
    const labels = u.hostname.split('.');
    return (labels.length >= 3 && REDIR_HOST.test(labels[0])) || REDIR_PATH.test(u.pathname);
  } catch {
    return false;
  }
}

// Màn hình chờ trong cửa sổ trống: vòng tròn xoay + dòng thông báo. Trả về { css, script }: css chèn bằng webContents.insertCSS (không
// bị CSP của trang chặn), script dựng DOM bằng createElement (không chèn HTML thô). Màu phải là mã hex #rrggbb.
const HEX = /^#[0-9a-f]{6}$/i;
function checkingScreen({ title, sub, bg, ink, soft, accent }) {
  const c = (v, d) => (HEX.test(v) ? v : d);
  const B = c(bg, '#f2f2f7');
  const I = c(ink, '#1c1c1e');
  const S = c(soft, '#6b7280');
  const A = c(accent, '#0a84ff');
  const css = `html,body{margin:0;height:100%;background:${B}}
body{display:flex;align-items:center;justify-content:center;font:14px -apple-system,BlinkMacSystemFont,sans-serif;color:${I};text-align:center}
#sw-check{display:flex;flex-direction:column;align-items:center;gap:14px;padding:24px;max-width:340px}
#sw-check .ring{width:46px;height:46px;border-radius:50%;border:4px solid ${S}44;border-top-color:${A};animation:sw-spin .9s linear infinite}
#sw-check b{font-size:15px;font-weight:700;line-height:1.4}
#sw-check span{font-size:12.5px;line-height:1.5;color:${S}}
@keyframes sw-spin{to{transform:rotate(360deg)}}`;
  const script = `(() => {
    const d = document;
    if (!d.body || d.getElementById('sw-check') || d.body.innerText.trim()) return; // đã có nội dung (trang ghi thẳng vào cửa sổ): không chèn màn hình chờ
    d.title = ${JSON.stringify(String(title))};
    const box = d.createElement('div');
    box.id = 'sw-check';
    const ring = d.createElement('div');
    ring.className = 'ring';
    const t = d.createElement('b');
    t.textContent = ${JSON.stringify(String(title))};
    const u = d.createElement('span');
    u.textContent = ${JSON.stringify(String(sub))};
    box.append(ring, t, u);
    d.body.append(box);
  })()`;
  return { css, script };
}

module.exports = { decodeUrl, targetFromRedirector, looksLikeRedirector, redact, checkingScreen };
