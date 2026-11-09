// Test quy tắc tên miền đăng nhập của app tự thêm: node scripts/test-auth.js (hoặc npm test)
const assert = require('assert');
const a = require('../src/auth-hosts');

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

test('trang đăng nhập nhận ra qua nhãn đầu của tên miền (https)', () => {
  for (const u of ['https://auth.openai.com/log-in', 'https://login.example.net/x', 'https://accounts.foo.vn/', 'https://sso.congty.com.vn/a', 'https://id.atlassian.com/login', 'https://auth0.foo.io/']) assert.equal(a.looksLikeLogin(u), true, u);
});

test('không nhận nhầm: tên miền thường, nhãn lạ, http, thiếu tên miền cha, URL rác', () => {
  for (const u of ['https://chatgpt.com/', 'https://evil-login.example.net/', 'https://example.net/login', 'https://loginfo.example.net/', 'http://auth.openai.com/', 'https://auth.com/', 'not a url', '', null]) assert.equal(a.looksLikeLogin(u), false, String(u));
});

test('dịch vụ phổ biến có sẵn tên miền đăng nhập đi kèm, dịch vụ lạ thì không', () => {
  const g = a.presetHosts('chatgpt.com');
  assert.ok(g.includes('openai.com') && g.includes('challenges.cloudflare.com'));
  assert.ok(a.presetHosts('chat.openai.com').includes('openai.com'));
  assert.ok(a.presetHosts('trello.com').includes('atlassian.com'));
  assert.deepEqual(a.presetHosts('example.org'), []);
  assert.deepEqual(a.presetHosts('notchatgpt.com'), []); // không khớp nửa chừng
  assert.deepEqual(a.presetHosts(''), []);
});

test('cleanExtra: chuẩn hoá tên miền người dùng nhập, bỏ mục sai và trùng, tối đa 10', () => {
  assert.deepEqual(a.cleanExtra('SSO.CongTy.vn, https://auth.abc.com/login?x=1 ; *.idp.net  sso.congty.vn'), ['sso.congty.vn', 'auth.abc.com', 'idp.net']);
  assert.deepEqual(a.cleanExtra('khongphaitenmien, -x.com, a..b.com, javascript:alert(1), ../etc'), []);
  assert.deepEqual(a.cleanExtra('login.example.com:8443'), ['login.example.com']);
  assert.deepEqual(a.cleanExtra(''), []);
  assert.deepEqual(a.cleanExtra(null), []);
  const many = Array.from({ length: 20 }, (_, i) => `h${i}.example.com`).join(',');
  assert.equal(a.cleanExtra(many).length, 10);
});

console.log(`\n${passed} test đạt${process.exitCode ? ', CÓ TEST LỖI' : ''}`);
