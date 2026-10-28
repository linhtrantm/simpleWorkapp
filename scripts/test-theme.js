// Test màu và chủ đề: node scripts/test-theme.js
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

const ratio = (a, b) => {
  const x = theme.luminance(a);
  const y = theme.luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
// Chữ phụ trên thanh bên là chữ trắng 82% (khung tối) hoặc chữ đen 72% (khung sáng), pha vào màu nền
const blend = (fg, bg, a) => {
  const f = parseInt(fg.slice(1), 16);
  const g = parseInt(bg.slice(1), 16);
  const c = (i) => Math.round(((f >> i) & 255) * a + ((g >> i) & 255) * (1 - a));
  return '#' + [16, 8, 0].map((i) => c(i).toString(16).padStart(2, '0')).join('');
};
const stopsOf = (css) => css.match(/#[0-9a-f]{6}/gi);

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

test('hex sang HSL rồi về lại không lệch quá 4 bậc mỗi kênh', () => {
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

test('danh sách chủ đề: system, custom rồi các chủ đề có sẵn; id lạ hoặc system thì không có chủ đề', () => {
  assert.equal(theme.THEME_IDS[0], 'system');
  assert.equal(theme.THEME_IDS[1], 'custom');
  assert.deepEqual(theme.THEME_IDS.slice(2), Object.keys(theme.THEMES));
  assert.equal(theme.resolveTheme('system'), null);
  assert.equal(theme.resolveTheme('không-có'), null);
  assert.equal(theme.resolveTheme('custom', 'xấu'), null);
  assert.equal(theme.resolveTheme('custom'), null);
});

test('mỗi chủ đề mang đủ bảng màu và màu thanh bên hợp lệ, cờ dark khớp độ sáng nền', () => {
  for (const [id, t] of Object.entries(theme.THEMES)) {
    for (const k of ['bg', 'card', 'rule', 'ink', 'soft']) assert.ok(theme.isHex(t.palette[k]), `${id}.palette.${k}`);
    assert.ok(t.frame.css && theme.isHex(t.frame.base), `${id}.frame`);
    assert.equal(theme.isLight(t.palette.bg), !t.palette.dark, `${id}: cờ dark khớp với độ sáng nền`);
    const r = theme.resolveTheme(id);
    assert.equal(r.palette.bg, t.palette.bg);
    assert.equal(typeof r.frame.light, 'boolean');
  }
});

test('mọi chủ đề: bảng màu nền app đủ tương phản (chữ chính và chữ phụ >= 4.5 trên nền trang và nền thẻ)', () => {
  for (const [id, t] of Object.entries(theme.THEMES)) {
    for (const bg of [t.palette.bg, t.palette.card]) {
      assert.ok(ratio(t.palette.ink, bg) >= 4.5, `${id}: chữ chính trên ${bg} ${ratio(t.palette.ink, bg).toFixed(2)}`);
      assert.ok(ratio(t.palette.soft, bg) >= 4.5, `${id}: chữ phụ trên ${bg} ${ratio(t.palette.soft, bg).toFixed(2)}`);
    }
  }
});

test('mọi chủ đề: chữ trên thanh bên >= 4.5 (chính) và >= 3.5 (phụ) ở từng điểm màu của dải', () => {
  for (const id of Object.keys(theme.THEMES)) {
    const f = theme.resolveTheme(id).frame;
    const ink = f.light ? '#1c1c1e' : '#ffffff';
    for (const stop of stopsOf(f.css)) {
      assert.ok(ratio(ink, stop) >= 4.5, `${id} ${stop}: chữ chính ${ratio(ink, stop).toFixed(2)}`);
      const muted = blend(ink, stop, f.light ? 0.72 : 0.82);
      assert.ok(ratio(muted, stop) >= 3.5, `${id} ${stop}: chữ phụ ${ratio(muted, stop).toFixed(2)}`);
    }
  }
});

test('chủ đề tự pha: bảng màu nền app suy ra từ màu chọn luôn đủ tương phản (>= 4.5) với mọi sắc, độ đậm, độ sáng', () => {
  for (let h = 0; h < 360; h += 6) {
    for (const s of [0, 20, 40, 60, 80, 100]) {
      for (const l of [10, 30, 50, 70, 90]) {
        const c = theme.hslToHex(h, s, l);
        const p = theme.resolveTheme('custom', c).palette;
        for (const bg of [p.bg, p.card]) {
          assert.ok(ratio(p.ink, bg) >= 4.5, `${c}: chữ chính ${ratio(p.ink, bg).toFixed(2)}`);
          assert.ok(ratio(p.soft, bg) >= 4.5, `${c}: chữ phụ ${ratio(p.soft, bg).toFixed(2)}`);
        }
      }
    }
  }
});

test('chủ đề tự pha: thanh bên lấy đúng màu chọn, chữ chọn bên tương phản hơn (>= 4.3, mức tối đa ở màu trung bình)', () => {
  for (let h = 0; h < 360; h += 15) {
    for (const s of [0, 40, 80, 100]) {
      for (const l of [5, 20, 35, 50, 65, 80, 95]) {
        const c = theme.hslToHex(h, s, l);
        const f = theme.resolveTheme('custom', c).frame;
        assert.equal(f.css, c);
        const text = f.light ? '#1a1004' : '#ffffff';
        assert.ok(ratio(text, c) >= 4.3, `${c}: ${ratio(text, c).toFixed(2)}`);
      }
    }
  }
});

test('màu nhấn của từng chủ đề: chữ trên nút >= 4.3 và nút nổi lên được so với nền thẻ (>= 3)', () => {
  for (const [id, t] of Object.entries(theme.THEMES)) {
    assert.ok(theme.isHex(t.accent), `${id}.accent`);
    const text = theme.isLight(t.accent) ? '#1a1004' : '#ffffff';
    assert.ok(ratio(text, t.accent) >= 4.3, `${id}: chữ trên nút ${ratio(text, t.accent).toFixed(2)}`);
    assert.ok(ratio(t.accent, t.palette.card) >= 3, `${id}: nút trên nền thẻ ${ratio(t.accent, t.palette.card).toFixed(2)}`);
    assert.equal(theme.resolveTheme(id).accent, t.accent);
  }
});

test('chủ đề tự pha: màu nhấn suy ra từ màu chọn luôn đọc được và nổi lên được trên nền thẻ', () => {
  for (let h = 0; h < 360; h += 6) {
    for (const s of [0, 30, 60, 100]) {
      const c = theme.hslToHex(h, s, 50);
      const r = theme.resolveTheme('custom', c);
      const text = theme.isLight(r.accent) ? '#1a1004' : '#ffffff';
      assert.ok(ratio(text, r.accent) >= 4.3, `${c}: chữ ${ratio(text, r.accent).toFixed(2)}`);
      assert.ok(ratio(r.accent, r.palette.card) >= 3, `${c}: nút trên thẻ ${ratio(r.accent, r.palette.card).toFixed(2)}`);
    }
  }
});

test('Noel theo quy tắc 60-30-10: nền kem, thanh bên xanh lá, màu nhấn đỏ', () => {
  const n = theme.resolveTheme('noel');
  assert.equal(n.accent, '#b3261e');
  assert.equal(theme.isLight(n.palette.bg), true);
  const [r, g, b] = [n.frame.base].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)))[0];
  assert.ok(g > r && g > b, 'thanh bên của Noel phải thiên xanh lá');
});

test('applyLook: ghi màu nhấn của chủ đề, data-look, gỡ về mặc định khi null', () => {
  const props = new Map();
  const doc = { documentElement: { dataset: {}, style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) } } };
  theme.applyLook(theme.resolveTheme('noel'), doc);
  assert.equal(props.get('--accent'), '#b3261e');
  assert.equal(doc.documentElement.dataset.look, 'noel');
  assert.equal(props.get('--bg'), theme.THEMES.noel.palette.bg);
  theme.applyLook(null, doc);
  assert.equal(props.get('--accent'), '#f58a1f');
  assert.equal(doc.documentElement.dataset.look, 'system');
  assert.equal(props.has('--bg'), false);
});

test('applyPalette: ghi biến CSS khi có bảng màu, gỡ sạch khi null', () => {
  const props = new Map();
  const doc = { documentElement: { style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) } } };
  const night = theme.resolveTheme('night');
  theme.applyPalette(night.palette, doc);
  assert.equal(props.get('--bg'), theme.THEMES.night.palette.bg);
  assert.equal(props.get('--text'), theme.THEMES.night.palette.ink);
  assert.equal(props.get('color-scheme'), 'dark');
  theme.applyPalette(null, doc);
  assert.equal(props.size, 0);
  theme.applyPalette(theme.resolveTheme('paper').palette, doc);
  assert.equal(props.get('color-scheme'), 'light');
  theme.applyPalette(undefined, doc);
  assert.equal(props.size, 0);
});

test('đã bỏ màu nhấn tuỳ chọn: apply ghi một màu cố định, chữ trên nút đọc được', () => {
  assert.equal(theme.ACCENTS, undefined);
  const props = new Map();
  theme.apply({ documentElement: { style: { setProperty: (k, v) => props.set(k, v) } } });
  assert.equal(props.get('--accent'), '#f58a1f');
  assert.equal(props.get('--accent2'), '#f58a1f');
  assert.ok(ratio(props.get('--on-accent'), '#f58a1f') >= 4.3);
});

test('migrateLook: chuyển lựa chọn cũ (palette, frame) sang chủ đề mới, giá trị lạ về theo hệ thống', () => {
  const m = (d) => theme.migrateLook(d);
  assert.equal(m({ palette: 'noel', accent: 'custom', frame: 'accent' }).look, 'noel');
  assert.equal(m({ frame: 'ocean' }).look, 'sky');
  assert.equal(m({ frame: 'forest' }).look, 'mint');
  assert.equal(m({ frame: 'rose' }).look, 'pink');
  assert.equal(m({ frame: 'sand' }).look, 'paper');
  assert.equal(m({ frame: 'accent' }).look, 'system');
  assert.deepEqual(m({ frame: 'custom', frameCustom: '#112233' }), { look: 'custom', lookCustom: '#112233' });
  assert.equal(m({ frame: 'custom' }).look, 'system');
  assert.equal(m({ palette: 'zzz' }).look, 'system');
  assert.equal(m({}).look, 'system');
  assert.deepEqual(m({ look: 'night' }), { look: 'night', lookCustom: '#2b5cff' });
  assert.deepEqual(m({ look: 'custom', lookCustom: '#abcdef' }), { look: 'custom', lookCustom: '#abcdef' });
  assert.equal(m({ look: 'custom' }).look, 'system');
  assert.equal(m({ look: 'bogus', palette: 'pink' }).look, 'pink');
});

console.log(`\n${passed} test đạt${process.exitCode ? ', CÓ TEST LỖI' : ''}`);
