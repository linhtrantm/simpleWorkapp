// Vẽ icon app phẳng (flat, kiểu iOS 7): squircle tô một màu, biểu tượng trắng, không bóng, không chuyển màu.
// Dùng chung cho mọi nơi hiện icon app.
(function (root) {
  let counter = 0;
  // Squircle trong hệ toạ độ 100x100: cạnh phẳng ở giữa, góc bo liên tục như icon macOS (Apple bo khoảng 22% và làm mượt tới ~28%)
  const SQUIRCLE = 'M28,0 L72,0 C90,0 100,10 100,28 L100,72 C100,90 90,100 72,100 L28,100 C10,100 0,90 0,72 L0,28 C0,10 10,0 28,0 Z';

  function parse(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    const n = parseInt(m ? m[1] : '3b82f6', 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(hex, other, amount) {
    const [r, g, b] = parse(hex);
    const [R, G, B] = other;
    const f = (a, c) => Math.round(a + (c - a) * amount);
    return `rgb(${f(r, R)}, ${f(g, G)}, ${f(b, B)})`;
  }

  // t: { icon?, art?, tile?, letter?, color, name? }
  //  - art: ảnh icon chính thức (màu đầy đủ, không tô trắng), thường đặt trên tile trắng (tile: 'white')
  function node(t) {
    const white = t.tile === 'white';
    const wrap = document.createElement('div');
    wrap.className = 'sw-icon';
    wrap.style.setProperty('--glow', t.color);
    wrap.innerHTML =
      `<svg viewBox="0 0 100 100" aria-hidden="true">` +
      `<path d="${SQUIRCLE}" fill="${white ? '#ffffff' : t.color}"/>` +
      (white ? `<path d="${SQUIRCLE}" fill="none" stroke="rgba(0,0,0,.14)" stroke-width="1.4" transform="translate(.7 .7) scale(.986)"/>` : '') +
      `</svg>`;
    if (t.art) {
      const img = document.createElement('img');
      img.className = 'art';
      img.src = t.art;
      img.alt = t.name || '';
      wrap.appendChild(img);
    } else if (t.icon) {
      const img = document.createElement('img');
      img.className = 'glyph';
      img.src = t.icon;
      img.alt = t.name || '';
      wrap.appendChild(img);
    } else {
      const letter = document.createElement('span');
      letter.className = 'letter';
      letter.textContent = t.letter || '?';
      wrap.appendChild(letter);
    }
    return wrap;
  }

  root.swIcon = { node };
})(this);
