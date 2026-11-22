// Test bố cục cửa sổ: node scripts/test-layouts.js (hoặc npm test)
const assert = require('assert');
const L = require('../src/layouts');

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

test('giá trị lạ hoặc thiếu về mặc định (rail, standard, normal)', () => {
  assert.equal(L.cleanSkin('floating'), 'floating');
  assert.equal(L.cleanLayout('x'), 'rail');
  assert.equal(L.cleanLayout(undefined), 'rail');
  assert.equal(L.cleanSkin(5), 'standard');
  assert.equal(L.cleanDensity(null), 'normal');
  for (const l of L.LAYOUTS) assert.equal(L.cleanLayout(l), l);
  for (const s of L.SKINS) assert.equal(L.cleanSkin(s), s);
  for (const d of L.DENSITIES) assert.equal(L.cleanDensity(d), d);
});

test('thanh icon giữ nguyên 6 mức cũ, mức lạ về 4', () => {
  assert.equal(L.shell({ layout: 'rail', iconLevel: 1 }).width, 68);
  assert.equal(L.shell({ layout: 'rail', iconLevel: 4 }).width, 80);
  assert.equal(L.shell({ layout: 'rail', iconLevel: 6 }).width, 102);
  assert.equal(L.shell({ layout: 'rail', iconLevel: 99 }).width, 80);
  assert.equal(L.shell({}).layout, 'rail');
  assert.equal(L.shell({ layout: 'rail' }).top, 0);
});

test('danh sách: rộng 208, thu gọn còn 68 và ẩn tên; mật độ đổi cao dòng', () => {
  const a = L.shell({ layout: 'list', density: 'normal' });
  assert.equal(a.width, L.LIST_WIDTH);
  assert.equal(a.top, 0);
  assert.equal(a.label, true);
  const c = L.shell({ layout: 'list', density: 'normal', collapsed: true });
  assert.equal(c.width, L.LIST_COLLAPSED);
  assert.equal(c.label, false);
  const heights = L.DENSITIES.map((d) => L.shell({ layout: 'list', density: d }).rowH);
  assert.ok(heights[0] < heights[1] && heights[1] < heights[2]);
});

test('tab ngang: không có thanh dọc, chiều cao thanh theo mật độ', () => {
  const tops = L.DENSITIES.map((d) => L.shell({ layout: 'tabs', density: d }));
  for (const t of tops) {
    assert.equal(t.width, 0);
    assert.ok(t.top >= 38 && t.top <= 50);
    assert.ok(t.rowH < t.top);
  }
  assert.ok(tops[0].top < tops[1].top && tops[1].top < tops[2].top);
});

test('vùng nội dung không âm và không đè lên thanh ở mọi bố cục, kiểu, bên, mật độ, cỡ cửa sổ', () => {
  const sizes = [[860, 520], [1280, 860], [1600, 1000], [100, 50], [0, 0]];
  for (const layout of L.LAYOUTS) {
    for (const skin of L.SKINS) {
      for (const side of L.SIDES) {
        for (const density of L.DENSITIES) {
          for (const collapsed of [false, true]) {
            for (let iconLevel = 1; iconLevel <= 6; iconLevel++) {
              const s = L.shell({ layout, skin, side, density, collapsed, iconLevel });
              for (const [w, h] of sizes) {
                const r = L.contentRect(w, h, s);
                const tag = `${layout}/${skin}/${side}/${density}/${collapsed}/${iconLevel} ${w}x${h}`;
                assert.ok(r.width >= 0 && r.height >= 0, tag);
                assert.ok(r.y >= s.top, tag);
                if (s.side === 'right') assert.ok(r.x + r.width <= Math.max(0, w - s.width) + 0.5 || w < s.width, tag); // không chạm thanh bên phải
                else assert.ok(r.x >= s.width, tag);
                if (w >= 860 && h >= 520) assert.ok(r.width >= 600 && r.height >= 440, `đủ chỗ cho nội dung ${tag}`);
              }
            }
          }
        }
      }
    }
  }
});

test('thẻ nổi: lề 8px bốn phía và bo 12px, các kiểu khác không có lề', () => {
  const f = L.shell({ layout: 'rail', skin: 'floating', iconLevel: 4 });
  assert.equal(f.inset, 8);
  assert.equal(f.radius, 12);
  const r = L.contentRect(1280, 860, f);
  assert.deepEqual(r, { x: 80 + 8, y: 8, width: 1280 - 80 - 16, height: 860 - 8 - 8 });
  for (const skin of ['standard', 'hairline']) {
    const s = L.shell({ layout: 'rail', skin, iconLevel: 4 });
    assert.equal(s.inset, 0);
    assert.equal(s.radius, 0);
    assert.deepEqual(L.contentRect(1280, 860, s), { x: 80, y: 0, width: 1200, height: 860 });
  }
  const t = L.shell({ layout: 'tabs', skin: 'floating', density: 'normal' });
  assert.deepEqual(L.contentRect(1280, 860, t), { x: 8, y: 44 + 8, width: 1264, height: 860 - 52 - 8 });
});

test('thanh bên phải: nội dung bắt đầu ở mép trái, chừa dải 30px cho nút cửa sổ, Tab ngang luôn ở trái', () => {
  const s = L.shell({ layout: 'rail', side: 'right', iconLevel: 4 });
  assert.equal(s.side, 'right');
  assert.equal(s.topStrip, 30);
  assert.deepEqual(L.contentRect(1280, 860, s), { x: 0, y: 30, width: 1200, height: 830 });
  const fl = L.shell({ layout: 'list', side: 'right', skin: 'floating' });
  assert.deepEqual(L.contentRect(1280, 860, fl), { x: 8, y: 30, width: 1280 - 208 - 16, height: 860 - 30 - 8 });
  const tabs = L.shell({ layout: 'tabs', side: 'right' });
  assert.equal(tabs.side, 'left');
  assert.equal(tabs.topStrip, 0);
  assert.equal(L.shell({ layout: 'rail' }).topStrip, 0);
});

test('hình icon: giá trị lạ về squircle', () => {
  assert.deepEqual(L.ICON_SHAPES, ['squircle', 'round', 'glyph']);
  assert.equal(L.cleanIconShape('x'), 'squircle');
  assert.equal(L.cleanIconShape(undefined), 'squircle');
  for (const v of L.ICON_SHAPES) assert.equal(L.cleanIconShape(v), v);
  assert.equal(L.cleanSide('top'), 'left');
});

console.log(`\n${passed} test đạt${process.exitCode ? ', CÓ TEST LỖI' : ''}`);
