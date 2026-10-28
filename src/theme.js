// Chủ đề của app (dùng chung cho tiến trình chính và các trang giao diện).
// Một chủ đề gồm hai phần áp cùng lúc: bảng màu của nền app (nền, thẻ, chữ, viền) và màu thanh bên (khung, kiểu Outlook).
(function (root) {
  // Màu nhấn cố định (cam). Đã bỏ tuỳ chọn đổi màu nhấn.
  const ACCENT = '#f58a1f';

  // accent: màu nhấn riêng của chủ đề (nút chính, vạch chọn, tag đang làm).
  // palette: bg = nền trang, card = nền thẻ, rule = viền, ink = chữ chính, soft = chữ phụ (đặt token theo vai trò, theo theme.md).
  // frame.css: nền thanh bên (đặc hoặc dải màu); frame.base: màu đại diện để chọn chữ sáng/tối và tô nền cửa sổ.
  // Chọn một chủ đề thì ghi đè cả sáng/tối của hệ thống. Nội dung các trang web (Zalo, Teams...) không đổi.
  const THEMES = {
    paper: {
      accent: '#3a4462',
      palette: { dark: false, bg: '#f4f1ea', card: '#fffdf8', rule: '#e3dccd', ink: '#1d2230', soft: '#5d6272' },
      frame: { css: 'linear-gradient(180deg, #f3ead8, #dccaa6)', base: '#e8d9bc' }
    },
    pink: {
      accent: '#d6457f',
      palette: { dark: false, bg: '#fbe9f1', card: '#fffafc', rule: '#f1cddd', ink: '#46203a', soft: '#85546f' },
      frame: { css: 'linear-gradient(180deg, #fbd5e4, #f4b8d1)', base: '#f7c6da' }
    },
    mint: {
      accent: '#2e8f62',
      palette: { dark: false, bg: '#e6f4ec', card: '#f7fcf9', rule: '#c5e3d1', ink: '#14352a', soft: '#4d7263' },
      frame: { css: 'linear-gradient(180deg, #d3f0e1, #aee0c8)', base: '#c0e8d4' }
    },
    sky: {
      accent: '#2b7de0',
      palette: { dark: false, bg: '#e8f1fb', card: '#f9fbff', rule: '#c8dcf2', ink: '#15304f', soft: '#4a6788' },
      frame: { css: 'linear-gradient(180deg, #d4e6fa, #aecff2)', base: '#c1d9f6' }
    },
    sunset: {
      accent: '#d9610a',
      palette: { dark: false, bg: '#fbeee3', card: '#fffaf5', rule: '#f2d5bd', ink: '#4a2410', soft: '#8a5b3d' },
      frame: { css: 'linear-gradient(180deg, #fde0c9, #f9c39c)', base: '#fad2b0' }
    },
    grape: {
      accent: '#7a48d1',
      palette: { dark: false, bg: '#efe9fb', card: '#fbf9ff', rule: '#d9ccf2', ink: '#2a1650', soft: '#645488' },
      frame: { css: 'linear-gradient(180deg, #e3d7f9, #cbb4f0)', base: '#d7c6f4' }
    },
    noel: {
      accent: '#b3261e',
      palette: { dark: false, bg: '#ecd9bd', card: '#fbf3e4', rule: '#d9c19a', ink: '#3a1d12', soft: '#7a5640' },
      frame: { css: 'linear-gradient(180deg, #0d4a2b, #1c6b3f)', base: '#14572f' } // xanh thông: màu phụ, đỏ là màu nhấn, kem là nền (quy tắc 60-30-10)
    },
    night: {
      accent: '#8e9bff',
      palette: { dark: true, bg: '#14161f', card: '#1e2130', rule: '#2f3349', ink: '#e8eaf3', soft: '#9aa0b8' },
      frame: { css: 'linear-gradient(180deg, #0c0e15, #181b28)', base: '#11131c' }
    },
    aurora: {
      accent: '#3fc1c9',
      palette: { dark: true, bg: '#0f1a22', card: '#172733', rule: '#26404f', ink: '#e6f3f6', soft: '#93b3bf' },
      frame: { css: 'linear-gradient(165deg, #0f2027, #1f6f80 55%, #6a45c4)', base: '#1f5266' }
    },
    graphite: {
      accent: '#f58a1f',
      palette: { dark: true, bg: '#1b1d20', card: '#25282c', rule: '#3a3e44', ink: '#eceff3', soft: '#9ba2ac' },
      frame: { css: 'linear-gradient(180deg, #212529, #495057)', base: '#33383d' }
    }
  };
  const THEME_IDS = ['system', 'custom', ...Object.keys(THEMES)];

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

  // Chủ đề tự pha từ một màu: sắc (và độ đậm) của màu chọn quyết định bảng màu nền app, còn thanh bên lấy đúng màu đó.
  function deriveCustom(hex) {
    const [h, s0] = hexToHsl(hex);
    const s = Math.max(30, Math.min(s0, 75));
    const card = hslToHex(h, s, 99);
    // Màu nhấn: cùng sắc, tối dần cho tới khi nổi lên được trên nền thẻ (sắc vàng vốn rất sáng nên phải tối hơn)
    let l = 46;
    let accent = hslToHex(h, Math.max(s, 45), l);
    while (l > 20 && (luminance(card) + 0.05) / (luminance(accent) + 0.05) < 3) accent = hslToHex(h, Math.max(s, 45), (l -= 2));
    return {
      accent,
      palette: {
        dark: false,
        bg: hslToHex(h, s, 95),
        card,
        rule: hslToHex(h, Math.round(s * 0.8), 86),
        ink: hslToHex(h, Math.min(s + 10, 80), 15),
        soft: hslToHex(h, Math.round(s * 0.5), 30)
      },
      frame: { css: hex, base: hex }
    };
  }

  // Trả về { palette: {...}, frame: { css, base, light } } hoặc null ('system', id lạ, màu tự pha sai)
  function resolveTheme(id, custom) {
    const t = id === 'custom' ? (isHex(custom) ? deriveCustom(custom) : null) : THEMES[id];
    if (!t) return null;
    return { id, accent: t.accent, palette: { ...t.palette }, frame: { ...t.frame, light: isLight(t.frame.base) } };
  }

  // Chủ đề = bảng màu + màu thanh bên gộp một. Tên cũ (palette, frame) đổi sang tên mới để người dùng cũ không mất lựa chọn.
  const OLD_FRAME = { ocean: 'sky', forest: 'mint', sunset: 'sunset', grape: 'grape', rose: 'pink', graphite: 'graphite', aurora: 'aurora', sand: 'paper' };
  function migrateLook(data) {
    let look = typeof data.look === 'string' ? data.look : '';
    let custom = data.lookCustom;
    if (!THEME_IDS.includes(look)) {
      look = 'system';
      if (typeof data.palette === 'string' && THEMES[data.palette]) look = data.palette;
      else if (OLD_FRAME[data.frame]) look = OLD_FRAME[data.frame];
      else if (data.frame === 'custom' && isHex(data.frameCustom)) {
        look = 'custom';
        custom = data.frameCustom;
      }
    }
    if (look === 'custom' && !isHex(custom)) look = 'system'; // chọn tự pha mà không có màu thì về theo hệ thống
    return { look, lookCustom: isHex(custom) ? custom : '#2b5cff' };
  }

  const rgba = (hex, a) => {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };

  const PALETTE_VARS = ['--bg', '--band', '--card', '--text', '--muted', '--border', '--border2', '--hover', '--input', '--pill-bg', '--surface', '--surface2'];

  // Áp bảng màu nền app lên trang. palette = null thì trả về mặc định (theo sáng/tối của hệ thống).
  function applyPalette(p, doc) {
    const style = doc.documentElement.style;
    if (!p) {
      PALETTE_VARS.forEach((v) => style.removeProperty(v));
      style.removeProperty('color-scheme');
      return;
    }
    style.setProperty('--bg', p.bg);
    style.setProperty('--band', p.bg);
    style.setProperty('--card', p.card);
    style.setProperty('--text', p.ink);
    style.setProperty('--muted', p.soft);
    style.setProperty('--border2', p.rule);
    style.setProperty('--border', rgba(p.ink, 0.2));
    style.setProperty('--hover', rgba(p.ink, 0.07));
    style.setProperty('--input', p.bg);
    style.setProperty('--pill-bg', rgba(p.ink, 0.1));
    style.setProperty('--surface', rgba(p.ink, 0.035));
    style.setProperty('--surface2', rgba(p.ink, 0.07));
    style.setProperty('color-scheme', p.dark ? 'dark' : 'light');
  }

  function apply(doc, accent = ACCENT) {
    const style = doc.documentElement.style;
    style.setProperty('--accent', accent);
    style.setProperty('--accent2', accent); // phẳng: không dùng dải màu
    style.setProperty('--on-accent', isLight(accent) ? '#1a1004' : '#ffffff');
  }

  // Áp cả chủ đề lên trang: màu nhấn, bảng màu nền, thuộc tính data-look (để CSS riêng của chủ đề như Noel bám vào), và hiệu ứng nếu có.
  // look = null là mặc định theo hệ thống.
  function applyLook(look, doc) {
    apply(doc, (look && look.accent) || ACCENT);
    applyPalette(look && look.palette, doc);
    doc.documentElement.dataset.look = look ? look.id : 'system';
    if (root.swFx) root.swFx.sync(look ? look.id : 'system', doc);
  }

  // Áp màu thanh bên (phần tử #side) của trang chính
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

  const api = { THEMES, THEME_IDS, isHex, hslToHex, hexToHsl, luminance, isLight, deriveCustom, resolveTheme, migrateLook, applyPalette, apply, applyLook, applyFrame };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.swTheme = api;
})(this);
