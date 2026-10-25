// Test màu và theme: node scripts/test-theme.js
const assert = require('node:assert/strict');
const theme = require('../src/theme');

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

test('isHex chỉ nhận #rrggbb', () => {
  for (const ok of ['#000000', '#FFaa00', '#123abc']) assert.equal(theme.isHex(ok), true);
  for (const bad of ['', '#fff', '123456', '#12345g', '#1234567', null, 5, undefined]) assert.equal(theme.isHex(bad), false);
});

test('HSL sang hex đúng các màu chuẩn', () => {
  assert.equal(theme.hslToHex(0, 100, 50), '#ff0000');
  assert.equal(theme.hslToHex(120, 100, 50), '#00ff00');
  assert.equal(theme.hslToHex(240, 100, 50), '#0000ff');
  assert.equal(theme.hslToHex(0, 0, 0), '#000000');
  assert.equal(theme.hslToHex(0, 0, 100), '#ffffff');
  assert.equal(theme.hslToHex(200, 0, 50), '#808080');
});

test('hex sang HSL rồi về lại không lệch quá 1 bậc mỗi kênh', () => {
  for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#123456', '#f58a1f', '#808080', '#fedcba']) {
    const [h, s, l] = theme.hexToHsl(hex);
    const back = theme.hslToHex(h, s, l);
    for (let i = 1; i < 7; i += 2) assert.ok(Math.abs(parseInt(hex.slice(i, i + 2), 16) - parseInt(back.slice(i, i + 2), 16)) <= 4, `${hex} -> ${back}`);
  }
});

test('chọn chữ sáng/tối theo độ sáng nền', () => {
  assert.equal(theme.isLight('#ffffff'), true);
  assert.equal(theme.isLight('#f3ead8'), true);
  assert.equal(theme.isLight('#000000'), false);
  assert.equal(theme.isLight('#135f82'), false);
  assert.equal(theme.isLight('#f58a1f'), true);
});

test('accentHex: tên có sẵn, mã tự pha, giá trị lạ về cam', () => {
  assert.equal(theme.accentHex('blue'), '#3B82F6');
  assert.equal(theme.accentHex('#abcdef'), '#abcdef');
  assert.equal(theme.accentHex('lạ'), '#f58a1f');
  assert.equal(theme.accentHex(undefined), '#f58a1f');
});

test('resolveFrame: mặc định là null, preset có chữ đúng, sand là khung sáng, accent/custom theo màu', () => {
  assert.equal(theme.resolveFrame('none'), null);
  assert.equal(theme.resolveFrame('không-có'), null);
  assert.equal(theme.resolveFrame('ocean').light, false);
  assert.equal(theme.resolveFrame('sand').light, true);
  assert.equal(theme.resolveFrame('accent', '', 'blue').base, '#3B82F6');
  assert.equal(theme.resolveFrame('custom', '#112233').css, '#112233');
  assert.equal(theme.resolveFrame('custom', 'xấu'), null);
});

test('mọi preset khung có đủ css và base hợp lệ', () => {
  for (const [id, f] of Object.entries(theme.FRAMES)) {
    assert.ok(f.css && theme.isHex(f.base), id);
    assert.ok(theme.FRAME_IDS.includes(id), id);
  }
});

console.log(`\n${passed} test đạt${process.exitCode ? ', CÓ TEST LỖI' : ''}`);
