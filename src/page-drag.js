// Chèn vào mỗi trang app: tự dò các KHOẢNG TRỐNG trong hàng tiêu đề phía trên cùng (không có chữ, ảnh, nút, ô nhập,
// link...) rồi đặt lên đó các vùng kéo cửa sổ trong suốt. Mày rê chuột vào chỗ trống của thanh tiêu đề app là kéo
// được cả cửa sổ, còn tên, avatar, nút, ô search vẫn bấm bình thường. Vùng tự dò lại khi cửa sổ đổi kích thước.
// Chạy trong trang (executeJavaScript). Id "sw-a" được CSS tắt-vùng-kéo của app bỏ qua (xem NO_DRAG_CSS trong main.js).
(function () {
  if (window.__swDrag) return;
  const LEVELS = [56, 40, 24]; // các chiều cao vùng kéo có thể có (px), từ mép trên xuống
  const MAX_H = LEVELS[0];
  const MIN_H = LEVELS[LEVELS.length - 1];
  const STEP = 6; // độ phân giải ngang khi dò
  const Y_STEP = 6; // độ phân giải dọc khi dò
  const MARGIN = 10; // chừa quanh mỗi thứ bấm được / có chữ
  const MIN_WIDTH = 44; // khoảng trống hẹp hơn thì bỏ
  const SCROLLBAR = 16; // chừa thanh cuộn bên phải
  const INTERACTIVE_TAG = /^(A|BUTTON|INPUT|TEXTAREA|SELECT|SUMMARY|LABEL|IFRAME|VIDEO|AUDIO|OBJECT|EMBED)$/;
  const MEDIA_TAG = /^(IMG|SVG|CANVAS|PICTURE|image|path|use)$/i;
  const INTERACTIVE_ROLE = /button|link|tab|textbox|searchbox|combobox|menuitem|checkbox|radio|switch|slider|option|listbox|menu|treeitem|gridcell|spinbutton/;
  const INTERACTIVE_CURSOR = /^(pointer|text|grab|grabbing|move|zoom-in|zoom-out|col-resize|row-resize|ew-resize|ns-resize|crosshair)$/;

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
  let zones = [];
  let enabled = true;
  let timer = null;

  // Điểm (x, y) có nằm trong chữ thật sự của phần tử không (không tính chỗ trống của khối chứa chữ)
  function overText(el, x, y) {
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.nodeValue.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (x >= r.left - 3 && x <= r.right + 3 && y >= r.top - 3 && y <= r.bottom + 3) return true;
      }
    }
    return false;
  }

  function isBlocked(el, x, y) {
    if (!el) return true;
    if (MEDIA_TAG.test(el.tagName) || (el.namespaceURI && el.namespaceURI.indexOf('svg') >= 0)) return true; // ảnh, avatar, icon
    if (overText(el, x, y)) return true; // tên, tiêu đề, nhãn
    for (let n = el, depth = 0; n && n.nodeType === 1 && n !== document.documentElement && depth < 10; n = n.parentElement, depth++) {
      if (INTERACTIVE_TAG.test(n.tagName)) return true;
      const role = n.getAttribute('role');
      if (role && INTERACTIVE_ROLE.test(role)) return true;
      if (n.isContentEditable) return true;
      const tab = n.getAttribute('tabindex');
      if (tab !== null && tab !== '-1') return true;
      if (INTERACTIVE_CURSOR.test(getComputedStyle(n).cursor)) return true;
    }
    return false;
  }

  function compute() {
    if (!enabled || !document.body) return render([]);
    host.style.display = 'none'; // để elementFromPoint không trúng chính vùng kéo
    const width = Math.max(0, window.innerWidth - SCROLLBAR);
    const cols = Math.ceil(width / STEP);
    // h[c] = chiều cao trống liên tục tính từ mép trên của cột c
    const h = new Array(cols).fill(MAX_H);
    for (let c = 0; c < cols; c++) {
      const x = c * STEP + STEP / 2;
      for (let y = 2; y <= MAX_H; y += Y_STEP) {
        if (isBlocked(document.elementFromPoint(x, y), x, y)) {
          h[c] = Math.max(0, y - 3);
          break;
        }
      }
    }
    // chừa lề quanh phần bị chặn: chiều cao của cột = nhỏ nhất trong vùng lân cận
    const pad = Math.ceil(MARGIN / STEP);
    const hp = h.map((_, c) => {
      let m = MAX_H;
      for (let k = -pad; k <= pad; k++) if (c + k >= 0 && c + k < cols) m = Math.min(m, h[c + k]);
      return m;
    });
    // mỗi cột lấy mức cao lớn nhất không vượt quá khoảng trống của nó; các cột liền nhau cùng mức gộp thành một vùng
    const level = hp.map((v) => LEVELS.find((L) => v >= L) || 0);
    const rects = [];
    let start = -1;
    for (let c = 0; c <= cols; c++) {
      const cur = c < cols ? level[c] : 0;
      if (start >= 0 && cur !== level[start]) {
        const x0 = start * STEP;
        const x1 = Math.min(c * STEP, width);
        if (level[start] > 0 && x1 - x0 >= MIN_WIDTH) rects.push([x0, x1 - x0, level[start]]);
        start = -1;
      }
      if (start < 0 && cur > 0) start = c;
    }
    host.style.display = '';
    render(rects);
  }

  function render(rects) {
    if (!host.isConnected) document.documentElement.appendChild(host);
    while (zones.length < rects.length) {
      const z = document.createElement('div');
      z.id = 'sw-a';
      z.style.cssText = 'position:fixed;top:0;background:transparent;pointer-events:auto;-webkit-app-region:drag;cursor:default;';
      host.appendChild(z);
      zones.push(z);
    }
    zones.forEach((z, i) => {
      if (i < rects.length) {
        z.style.display = 'block';
        z.style.left = rects[i][0] + 'px';
        z.style.width = rects[i][1] + 'px';
        z.style.height = rects[i][2] + 'px';
      } else {
        z.style.display = 'none';
      }
    });
  }

  // Dò lại có điều tiết, chỉ khi cửa sổ đang được focus (lúc đó mới có người kéo)
  function schedule(delay) {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (document.hasFocus()) compute();
    }, delay);
  }
  const slow = () => schedule(900); // thay đổi nội dung: tối đa khoảng 1 lần/giây
  let resizeTimer = null;
  function onResize() {
    // Đang kéo giãn cửa sổ: ẩn tạm các vùng cũ (đã lệch vị trí) rồi dò lại ngay khi dừng một nhịp ngắn
    host.style.display = 'none';
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      host.style.display = '';
      compute();
    }, 140);
  }

  window.__swDrag = {
    setEnabled(on) {
      enabled = !!on;
      compute();
    },
    recompute: compute,
    zones: () => zones.filter((z) => z.style.display !== 'none').map((z) => [parseInt(z.style.left, 10), parseInt(z.style.width, 10), parseInt(z.style.height, 10)])
  };

  window.addEventListener('resize', onResize);
  window.addEventListener('focus', slow);
  new MutationObserver(slow).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(() => {
    if (document.hasFocus()) slow();
  }, 4000);
  compute();
})();
