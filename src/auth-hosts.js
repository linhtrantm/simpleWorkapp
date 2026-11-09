// Quy tắc tên miền đăng nhập cho app tự thêm (logic thuần, có test: scripts/test-auth.js).
// Vì sao cần: tab chỉ cho điều hướng trong chính nó tới tên miền của app (và các tên miền con). Nhiều dịch vụ đăng nhập ở tên miền khác
// (ví dụ chatgpt.com đăng nhập ở auth.openai.com), nên trang đăng nhập bị đẩy ra trình duyệt ngoài và phiên không về lại app.

// Dịch vụ phổ biến: tên miền của app -> các tên miền đăng nhập đi kèm
const PRESETS = [
  { match: /(^|\.)(chatgpt|openai)\.com$/, hosts: ['openai.com', 'challenges.cloudflare.com', 'workos.com', 'workoscdn.com', 'auth0.com'] },
  { match: /(^|\.)(trello|atlassian)\.com$|(^|\.)atlassian\.net$/, hosts: ['atlassian.com', 'atlassian.net', 'trello.com'] }
];

// Nhãn đầu của tên miền thường dùng cho trang đăng nhập: auth.openai.com, login.example.com, accounts.example.com, sso.example.com...
const LOGIN_LABEL = /^(auth|login|log-in|signin|sign-in|accounts?|sso|id|identity|oauth|idp|passport|secure)\d*$/;

function looksLikeLogin(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const labels = u.hostname.split('.');
    return labels.length >= 3 && LOGIN_LABEL.test(labels[0]);
  } catch {
    return false;
  }
}

function presetHosts(host) {
  const h = String(host || '').toLowerCase();
  const hit = PRESETS.find((p) => p.match.test(h));
  return hit ? hit.hosts.slice() : [];
}

// Chuỗi người dùng nhập ("sso.congty.vn, auth.abc.com") -> mảng tên miền hợp lệ. Bỏ giao thức, đường dẫn, cổng; bỏ mục sai; tối đa 10.
function cleanExtra(input) {
  const out = [];
  for (const raw of String(input == null ? '' : input).split(/[\s,;]+/)) {
    let h = raw.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:?#].*$/, '').replace(/^\*\./, '').replace(/^\./, '');
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h) || h.length > 120) continue;
    if (!out.includes(h)) out.push(h);
    if (out.length >= 10) break;
  }
  return out;
}

module.exports = { PRESETS, looksLikeLogin, presetHosts, cleanExtra };
