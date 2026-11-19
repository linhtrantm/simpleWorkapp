// Test quy tắc popup: node scripts/test-popup.js (hoặc npm test)
const assert = require('assert');
const p = require('../src/popup-rules');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (err) {
    process.exitCode = 1;
    console.log('FAIL  ' + name + '\n      ' + (err.message || err).split('\n').join('\n      '));
  }
}
const own = (h) => /(^|\.)zalo\.me$/.test(h);

test('lấy địa chỉ đích từ link trung gian (một và hai lớp mã hoá, tham số bất kỳ, hash)', () => {
  assert.equal(p.targetFromRedirector('https://link.zalo.me/x?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3D1', own), 'https://example.com/a?b=1');
  assert.equal(p.targetFromRedirector('https://link.zalo.me/x?u=https%253A%252F%252Fexample.com%252Fa', own), 'https://example.com/a');
  assert.equal(p.targetFromRedirector('https://link.zalo.me/x?foo=1&target=http://example.org/p', own), 'http://example.org/p');
  assert.equal(p.targetFromRedirector('https://link.zalo.me/x#url=https%3A%2F%2Fexample.com', own), 'https://example.com');
});

test('không có đích, đích vòng về chính app, giá trị không phải http(s), URL rác: trả về null', () => {
  assert.equal(p.targetFromRedirector('https://link.zalo.me/x?id=123&t=abc', own), null);
  assert.equal(p.targetFromRedirector('https://link.zalo.me/x?url=https%3A%2F%2Fchat.zalo.me%2F', own), null); // vòng về zalo
  assert.equal(p.targetFromRedirector('https://link.zalo.me/x?url=javascript%3Aalert(1)', own), null);
  assert.equal(p.targetFromRedirector('https://link.zalo.me/x?url=file%3A%2F%2F%2Fetc%2Fpasswd', own), null);
  assert.equal(p.targetFromRedirector('https://link.zalo.me/x?url=%E0%A4%A', own), null); // mã hoá hỏng
  assert.equal(p.targetFromRedirector('không phải url', own), null);
  assert.equal(p.targetFromRedirector('', own), null);
});

test('decodeUrl giải mã tối đa vài lớp và chỉ nhận http(s)', () => {
  assert.equal(p.decodeUrl('https://a.com'), 'https://a.com');
  assert.equal(p.decodeUrl('https%3A%2F%2Fa.com'), 'https://a.com');
  assert.equal(p.decodeUrl('ftp%3A%2F%2Fa.com'), null);
  assert.equal(p.decodeUrl(null), null);
});

test('nhận ra link trung gian qua tên miền hoặc đường dẫn, không nhận nhầm trang thường', () => {
  for (const u of ['https://link.zalo.me/abc', 'https://redirect.example.com/x', 'https://l.zalo.me/x', 'https://zalo.me/redirect?x=1', 'https://example.com/away/abc', 'https://go.example.net/a']) assert.equal(p.looksLikeRedirector(u), u === 'https://l.zalo.me/x' ? false : true, u);
  for (const u of ['https://chat.zalo.me/', 'https://zalo.me/', 'https://example.com/linkedin', 'https://example.com/redirection', 'https://teams.microsoft.com/l/meetup-join/x', 'https://go.com/', 'rác', '']) assert.equal(p.looksLikeRedirector(u), false, u);
});

test('màn hình chờ: có vòng xoay và chữ, chữ được escape, màu sai về mặc định', () => {
  const r = p.checkingScreen({ title: 'Đang kiểm tra "link"', sub: "a'b\\n</script>", bg: '#ffffff', ink: '#111111', soft: 'đỏ', accent: 'javascript:1' });
  assert.ok(r.css.includes('sw-spin') && r.css.includes('background:#ffffff') && r.css.includes('#0a84ff'));
  assert.ok(!r.css.includes('javascript') && !r.css.includes('đỏ'));
  assert.ok(r.script.includes('sw-check') && r.script.includes('createElement') && !r.script.includes('innerHTML'));
  assert.ok(r.script.includes('Đang kiểm tra \\"link\\"'));
  // chạy thử script trên DOM giả: dựng đúng một lần
  const made = [];
  const mk = (tag) => ({ tag, children: [], append(...c) { this.children.push(...c); }, set textContent(v) { this._t = v; }, get textContent() { return this._t; } });
  const body = mk('body');
  body.innerText = '';
  const doc = { body, title: '', getElementById: (id) => (made.length && id === 'sw-check' ? made[0] : null), createElement: (t) => { const e = mk(t); if (t === 'div' && made.length === 0 && false) made.push(e); return e; } };
  new Function('document', 'return ' + r.script)(doc);
  assert.equal(body.children.length, 1);
  assert.equal(body.children[0].id, 'sw-check');
  assert.equal(body.children[0].children.length, 3);
  assert.equal(doc.title, 'Đang kiểm tra "link"');
  // đã có nội dung thì không chèn thêm
  const body2 = mk('body');
  body2.innerText = 'nội dung có sẵn';
  new Function('document', 'return ' + r.script)({ body: body2, title: '', getElementById: () => null, createElement: mk });
  assert.equal(body2.children.length, 0);
});

test('redact ghi nhật ký không lộ giá trị tham số', () => {
  const r = p.redact('https://link.zalo.me/abc/def?url=https%3A%2F%2Fsecret.com%2F%3Ftoken%3DXYZ&sig=123');
  assert.ok(r.includes('link.zalo.me/abc/def') && r.includes('url,sig'));
  assert.ok(!/secret|XYZ|123/.test(r));
  assert.equal(p.redact('rác'), 'rác');
});

console.log(`\n${passed} test đạt${process.exitCode ? ', CÓ TEST LỖI' : ''}`);
