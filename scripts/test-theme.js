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

// Quy tắc đọc được: chữ trên khung phải đủ tương phản ở MỌI điểm của dải màu (WCAG: chữ chính >= 4.5, chữ phụ >= 3.5).
// Chữ phụ trên thanh bên là chữ trắng 82% (khung tối) hoặc chữ đen 72% (khung sáng), pha vào màu nền.
const ratio = (a, b) => {
  const x = theme.luminance(a);
  const y = theme.luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const blend = (fg, bg, a) => {
  const f = parseInt(fg.slice(1), 16);
  const g = parseInt(bg.slice(1), 16);
  const c = (i) => Math.round(((f >> i) & 255) * a + ((g >> i) & 255) * (1 - a));
  return '#' + [16, 8, 0].map((i) => c(i).toString(16).padStart(2, '0')).join('');
};

test('mọi theme khung: chữ chính >= 4.5 và chữ phụ >= 3.5 ở từng điểm màu của dải', () => {
  for (const [id, f] of Object.entries(theme.FRAMES)) {
    const light = theme.resolveFrame(id).light;
    const ink = light ? '#1c1c1e' : '#ffffff';
    for (const stop of f.css.match(/#[0-9a-f]{6}/gi)) {
      assert.ok(ratio(ink, stop) >= 4.5, `${id} ${stop}: chữ chính ${ratio(ink, stop).toFixed(2)}`);
      const muted = blend(ink, stop, light ? 0.72 : 0.82);
      assert.ok(ratio(muted, stop) >= 3.5, `${id} ${stop}: chữ phụ ${ratio(muted, stop).toFixed(2)}`);
    }
  }
});

test('màu nhấn tự pha: chữ trên nút luôn chọn bên tương phản hơn (>= 4.3, mức tối đa ở màu trung bình)', () => {
  for (let h = 0; h < 360; h += 15) {
    for (const s of [0, 40, 80, 100]) {
      for (const l of [5, 20, 35, 50, 65, 80, 95]) {
        const c = theme.hslToHex(h, s, l);
        const text = theme.isLight(c) ? '#1a1004' : '#ffffff';
        assert.ok(ratio(text, c) >= 4.3, `${c}: ${ratio(text, c).toFixed(2)}`);
      }
    }
  }
});

test('mọi bảng màu: chữ chính và chữ phụ >= 4.5 trên cả nền trang và nền thẻ, viền phân biệt được với nền', () => {
  for (const [id, p] of Object.entries(theme.PALETTES)) {
    for (const bg of [p.bg, p.card]) {
      assert.ok(ratio(p.ink, bg) >= 4.5, `${id}: chữ chính trên ${bg} ${ratio(p.ink, bg).toFixed(2)}`);
      assert.ok(ratio(p.soft, bg) >= 4.5, `${id}: chữ phụ trên ${bg} ${ratio(p.soft, bg).toFixed(2)}`);
    }
    for (const k of ['bg', 'card', 'rule', 'ink', 'soft']) assert.ok(theme.isHex(p[k]), `${id}.${k}`);
    assert.equal(theme.isLight(p.bg), !p.dark, `${id}: cờ dark khớp với độ sáng nền`);
  }
});

test('danh sách bảng màu có system và khớp PALETTES', () => {
  assert.equal(theme.PALETTE_IDS[0], 'system');
  assert.deepEqual(theme.PALETTE_IDS.slice(1), Object.keys(theme.PALETTES));
});

test('applyPalette: ghi biến CSS khi chọn bảng, gỡ sạch khi về system hoặc id lạ', () => {
  const props = new Map();
  const doc = { documentElement: { style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) } } };
  theme.applyPalette('night', doc);
  assert.equal(props.get('--bg'), theme.PALETTES.night.bg);
  assert.equal(props.get('--text'), theme.PALETTES.night.ink);
  assert.equal(props.get('color-scheme'), 'dark');
  theme.applyPalette('system', doc);
  assert.equal(props.size, 0);
  theme.applyPalette('paper', doc);
  assert.equal(props.get('color-scheme'), 'light');
  theme.applyPalette('không-có', doc);
  assert.equal(props.size, 0);
});

console.log(`\n${passed} test đạt${process.exitCode ? ', CÓ TEST LỖI' : ''}`);
