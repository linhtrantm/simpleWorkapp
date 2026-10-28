// Màu nhấn, theme khung ứng dụng và cách áp dụng cho trang (dùng chung cho tiến trình chính và các trang giao diện).
(function (root) {
  const ACCENTS = {
    orange: ['#f58a1f', '#ffb454'],
    blue: ['#3B82F6', '#06b6d4'],
    purple: ['#8b5cf6', '#c084fc'],
    pink: ['#ec4899', '#f9a8d4'],
    green: ['#10b981', '#6ee7b7']
  };

  // Theme cho "khung" (thanh bên), kiểu Outlook: chỉ tô viền ứng dụng, phần nội dung giữ nguyên.
  // css: nền thanh bên (đặc hoặc dải màu); base: màu đại diện để chọn chữ sáng/tối và tô nền cửa sổ.
  const FRAMES = {
    ocean: { css: 'linear-gradient(180deg, #0e4d6e, #16698a)', base: '#10597b' },
    forest: { css: 'linear-gradient(180deg, #14442e, #2a734f)', base: '#1f5a3e' },
    sunset: { css: 'linear-gradient(180deg, #a8330a, #b94d09)', base: '#b04009' },
    grape: { css: 'linear-gradient(180deg, #3b1d6e, #6d3dbb)', base: '#52289a' },
    rose: { css: 'linear-gradient(180deg, #9c1c47, #b8315f)', base: '#aa2753' },
    graphite: { css: 'linear-gradient(180deg, #212529, #495057)', base: '#33383d' },
    aurora: { css: 'linear-gradient(165deg, #0f2027, #1f6f80 55%, #6a45c4)', base: '#1f5266' },
    sand: { css: 'linear-gradient(180deg, #f3ead8, #dccaa6)', base: '#e8d9bc' }
  };
  const FRAME_IDS = ['none', 'accent', 'custom', ...Object.keys(FRAMES)];

  const isHex = (s) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

  // h: 0..360, s, l: 0..100
  function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
  }

  function hexToHsl(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    let h = 0;
    let s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
  }

  // Độ sáng cảm nhận 0..1 (công thức WCAG), dùng để chọn chữ đen hay trắng cho đọc được
  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // 0.1925 là điểm chữ tối (#1a1004) và chữ trắng có độ tương phản bằng nhau; trên mức này chữ tối dễ đọc hơn.
// Ở giữa dải (màu trung bình) không chữ nào vượt quá ~4.3:1, đó là giới hạn của phép đo chứ không phải lỗi chọn.
const isLight = (hex) => luminance(hex) > 0.1925;

  // accent: tên màu có sẵn hoặc mã '#rrggbb' (màu tự pha)
  function accentHex(accent) {
    if (isHex(accent)) return accent;
    return (ACCENTS[accent] || ACCENTS.orange)[0];
  }

  // Trả về { css, base, light } hoặc null (giữ giao diện mặc định)
  function resolveFrame(frame, custom, accent) {
    if (frame === 'accent') {
      const a = accentHex(accent);
      return { css: a, base: a, light: isLight(a) };
    }
    if (frame === 'custom' && isHex(custom)) return { css: custom, base: custom, light: isLight(custom) };
    const f = FRAMES[frame];
    return f ? { css: f.css, base: f.base, light: isLight(f.base) } : null;
  }

  function apply(accent, doc) {
    const a = accentHex(accent);
    const style = doc.documentElement.style;
    style.setProperty('--accent', a);
    style.setProperty('--accent2', a); // phẳng: không dùng dải màu
    style.setProperty('--on-accent', isLight(a) ? '#1a1004' : '#ffffff');
  }

  // Áp theme khung cho thanh bên (phần tử #side) của trang chính
  function applyFrame(frame, doc) {
    const root = doc.documentElement.style;
    const side = doc.getElementById('side');
    const vars = ['--text', '--muted', '--hover', '--pill-bg', '--accent', '--brand'];
    if (!frame) {
      root.removeProperty('--frame-bg');
      root.removeProperty('--frame-ring');
      if (side) vars.forEach((v) => side.style.removeProperty(v));
      return;
    }
    root.setProperty('--frame-bg', frame.css);
    root.setProperty('--frame-ring', frame.base);
    if (!side) return;
    const ink = frame.light ? '#1c1c1e' : '#ffffff';
    side.style.setProperty('--text', ink);
    side.style.setProperty('--muted', frame.light ? 'rgba(28,28,30,.72)' : 'rgba(255,255,255,.82)');
    side.style.setProperty('--hover', frame.light ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.14)');
    side.style.setProperty('--pill-bg', frame.light ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.22)');
    side.style.setProperty('--accent', ink); // vạch chọn và tên hiệu hợp với khung, tránh trùng màu nền
    side.style.setProperty('--brand', ink);
  }

  const api = { ACCENTS, FRAMES, FRAME_IDS, isHex, hslToHex, hexToHsl, luminance, isLight, accentHex, resolveFrame, apply, applyFrame };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.swTheme = api;
})(this);
