// Bố cục của cửa sổ chính (logic thuần, có test: scripts/test-layouts.js).
// "Bố cục" là chỗ đặt thanh chọn app; vùng còn lại là nội dung (các view web). Độc lập với chủ đề màu và kiểu vẻ ngoài.

// Thanh icon (bố cục hiện tại): 6 mức cỡ icon
const ICON_LEVELS = [
  { width: 68, icon: 30, glyph: 17, label: false, labelSize: 9.5, top: 0 },
  { width: 68, icon: 38, glyph: 21, label: false, labelSize: 9.5, top: 0 },
  { width: 74, icon: 40, glyph: 22, label: true, labelSize: 9.5, top: 0 },
  { width: 80, icon: 44, glyph: 24, label: true, labelSize: 9.5, top: 0 },
  { width: 90, icon: 50, glyph: 28, label: true, labelSize: 10, top: 0 },
  { width: 102, icon: 56, glyph: 31, label: true, labelSize: 11, top: 0 }
];

const LAYOUTS = ['rail', 'list', 'tabs']; // rail = thanh icon dọc (mặc định), list = thanh bên dạng danh sách, tabs = tab ngang trên cùng
const SKINS = ['standard', 'hairline', 'floating']; // standard = như cũ, hairline = tối giản kẻ mảnh, floating = thẻ nội dung nổi bo góc
const SIDES = ['left', 'right']; // bên đặt thanh dọc (Thanh icon, Danh sách); Tab ngang không có
const ICON_SHAPES = ['squircle', 'round', 'glyph']; // hình icon: vuông bo, tròn, chỉ biểu tượng
const DENSITIES = ['compact', 'normal', 'cozy'];

const pick = (list, v, d) => (list.includes(v) ? v : d);
const cleanLayout = (v) => pick(LAYOUTS, v, 'rail');
const cleanSkin = (v) => pick(SKINS, v, 'standard');
const cleanDensity = (v) => pick(DENSITIES, v, 'normal');
const cleanSide = (v) => pick(SIDES, v, 'left');
const cleanIconShape = (v) => pick(ICON_SHAPES, v, 'squircle');

const INSET = 8; // lề quanh thẻ nội dung ở kiểu thẻ nổi
const RADIUS = 12; // bo góc thẻ nội dung ở kiểu thẻ nổi
const TOP_STRIP = 30; // dải trên cùng chừa cho 3 nút cửa sổ khi thanh dọc nằm bên phải

const LIST_WIDTH = 208;
const LIST_COLLAPSED = 68;
// Cao dòng (danh sách) hoặc cao thanh tab theo mật độ [gọn, vừa, thoáng]
const ROW_H = { compact: 34, normal: 42, cozy: 50 };
const TAB_BAR = { compact: 38, normal: 44, cozy: 50 };
const ICON = { compact: 26, normal: 30, cozy: 34 }; // cỡ icon trong danh sách và tab

// Vùng chrome (thanh chọn app) của một bố cục:
//   { layout, side, width, top, inset, radius, topStrip, icon, glyph, label, labelSize, rowH, collapsed }
//  - width: bề rộng thanh dọc (0 nếu thanh nằm ngang phía trên); side: thanh dọc nằm bên trái hay phải
//  - top: bề cao thanh ngang phía trên (0 nếu thanh dọc)
//  - inset, radius: lề và bo góc của thẻ nội dung (kiểu thẻ nổi); topStrip: dải chừa trên cùng khi thanh dọc ở bên phải
function shell({ layout, density, collapsed, iconLevel, side, skin } = {}) {
  const l = cleanLayout(layout);
  const d = cleanDensity(density);
  const floating = cleanSkin(skin) === 'floating';
  const common = { inset: floating ? INSET : 0, radius: floating ? RADIUS : 0 };
  const sd = l === 'tabs' ? 'left' : cleanSide(side);
  const strip = sd === 'right' ? TOP_STRIP : 0;
  if (l === 'list') {
    const small = !!collapsed;
    const icon = ICON[d] + 6;
    return { layout: l, side: sd, topStrip: strip, ...common, width: small ? LIST_COLLAPSED : LIST_WIDTH, top: 0, icon, glyph: Math.round(icon * 0.55), label: !small, labelSize: 13.5, rowH: ROW_H[d], collapsed: small };
  }
  if (l === 'tabs') {
    return { layout: l, side: 'left', topStrip: 0, ...common, width: 0, top: TAB_BAR[d], icon: ICON[d] - 6, glyph: Math.round((ICON[d] - 6) * 0.55), label: true, labelSize: 12.5, rowH: TAB_BAR[d] - 12, collapsed: false };
  }
  const lv = ICON_LEVELS[(Number.isInteger(iconLevel) ? iconLevel : 4) - 1] || ICON_LEVELS[3];
  return { layout: 'rail', side: sd, topStrip: strip, ...common, ...lv, rowH: 0, collapsed: false };
}

// Vùng nội dung (các view web) cho cửa sổ rộng winW cao winH; không bao giờ âm. Có lề inset đủ bốn phía quanh thẻ.
function contentRect(winW, winH, s) {
  const x = s.side === 'right' ? s.inset : s.width + s.inset;
  const y = s.top + Math.max(s.inset, s.topStrip);
  return {
    x,
    y,
    width: Math.max(0, winW - s.width - 2 * s.inset),
    height: Math.max(0, winH - y - s.inset)
  };
}

module.exports = { ICON_LEVELS, LAYOUTS, SKINS, SIDES, ICON_SHAPES, DENSITIES, LIST_WIDTH, LIST_COLLAPSED, INSET, RADIUS, TOP_STRIP, cleanLayout, cleanSkin, cleanDensity, cleanSide, cleanIconShape, shell, contentRect };
