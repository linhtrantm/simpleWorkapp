// Hiệu ứng riêng của chủ đề Noel (theme.md mục 8): tuyết rơi và dây đèn nhấp nháy. Các chủ đề khác không có hiệu ứng.
// Tuyết chạy 30 khung/giây trên một canvas nhỏ, dừng khi trang ẩn; tôn trọng "giảm chuyển động" của macOS.
(function (root) {
  const COLORS = ['#c62828', '#2e7d32', '#f9a825', '#1e88e5'];
  let snow = null; // { canvas, host, raf, last, flakes, onResize }
  let garland = null;
  let garlandResize = null;

  const reduced = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function stopSnow() {
    if (!snow) return;
    cancelAnimationFrame(snow.raf);
    root.removeEventListener('resize', snow.onResize);
    snow.canvas.remove();
    snow = null;
  }

  function startSnow(doc) {
    if (snow) return;
    const side = doc.getElementById('side'); // trang chính: tuyết chỉ rơi trong thanh bên, không đè lên trang web
    const host = side || doc.body;
    const canvas = doc.createElement('canvas');
    canvas.className = 'noel-snow';
    canvas.style.cssText = `position:${side ? 'absolute' : 'fixed'};left:0;top:0;width:100%;height:100%;pointer-events:none;${side ? '-webkit-app-region:no-drag;' : ''}z-index:${side ? 0 : 40};`;
    host.insertBefore(canvas, host.firstChild); // đầu danh sách: vùng kéo cửa sổ của canvas không đè lên nút phía sau
    const ctx = canvas.getContext('2d');
    const s = { canvas, host, raf: 0, last: 0, flakes: [], w: 0, h: 0 };
    const fit = () => {
      const r = host.getBoundingClientRect();
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      s.w = Math.max(1, r.width);
      s.h = Math.max(1, r.height);
      canvas.width = Math.round(s.w * dpr);
      canvas.height = Math.round(s.h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(12, Math.min(90, Math.round((s.w * s.h) / 9000)));
      s.flakes = Array.from({ length: n }, () => {
        const depth = Math.random(); // 0 xa, 1 gần: gần thì to, rơi nhanh, đậm
        return { x: Math.random() * s.w, y: Math.random() * s.h, r: 0.8 + depth * 2.2, v: 14 + depth * 34, sway: 6 + depth * 14, ph: Math.random() * 6.28, a: 0.35 + depth * 0.55 };
      });
    };
    s.onResize = fit;
    root.addEventListener('resize', fit);
    fit();
    const frame = (t) => {
      s.raf = requestAnimationFrame(frame);
      if (doc.hidden || t - s.last < 33) return; // ~30 khung/giây, trang ẩn thì bỏ qua
      const dt = Math.min(0.1, (t - (s.last || t)) / 1000);
      s.last = t;
      ctx.clearRect(0, 0, s.w, s.h);
      for (const f of s.flakes) {
        f.y += f.v * dt;
        f.ph += dt * 1.4;
        const x = f.x + Math.sin(f.ph) * f.sway;
        if (f.y > s.h + 4) {
          f.y = -4;
          f.x = Math.random() * s.w;
        }
        ctx.globalAlpha = f.a;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, f.y, f.r, 0, 6.2832);
        ctx.fill();
        if (f.r > 2.4) {
          // hạt gần có viền mờ để nhìn thấy được trên nền kem
          ctx.globalAlpha = f.a * 0.35;
          ctx.strokeStyle = '#90a4ae';
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };
    s.raf = requestAnimationFrame(frame);
    snow = s;
  }

  function removeGarland() {
    if (garland) garland.remove();
    garland = null;
    if (garlandResize) root.removeEventListener('resize', garlandResize);
    garlandResize = null;
  }

  // Dây đèn: các cung võng nối nhau, bóng đèn đặt dọc cung, nhấp nháy lệch pha bằng CSS
  function buildGarland(doc) {
    const w = Math.max(320, root.innerWidth || 800);
    const seg = 110;
    let paths = '';
    let bulbs = '';
    let i = 0;
    for (let x = -10; x < w + seg; x += seg) {
      const x2 = x + seg;
      paths += `M${x} 2Q${x + seg / 2} 30 ${x2} 2`;
      for (const t of [0.22, 0.5, 0.78]) {
        const bx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * (x + seg / 2) + t * t * x2;
        const by = (1 - t) * (1 - t) * 2 + 2 * (1 - t) * t * 30 + t * t * 2;
        const c = COLORS[i % COLORS.length];
        bulbs += `<g class="b" style="animation-delay:${((i * 0.37) % 1.8).toFixed(2)}s"><rect x="${(bx - 2).toFixed(1)}" y="${(by - 1).toFixed(1)}" width="4" height="4" fill="#3a3a3a"/><ellipse cx="${bx.toFixed(1)}" cy="${(by + 6).toFixed(1)}" rx="3.6" ry="5" fill="${c}"/></g>`;
        i++;
      }
    }
    return `<svg width="${w}" height="44" viewBox="0 0 ${w} 44" xmlns="http://www.w3.org/2000/svg"><path d="${paths}" fill="none" stroke="#3a3a3a" stroke-opacity=".55" stroke-width="1.4"/>${bulbs}</svg>`;
  }

  function addGarland(doc) {
    if (garland || doc.getElementById('side')) return; // trang chính không có dây đèn
    garland = doc.createElement('div');
    garland.className = 'noel-garland';
    garland.setAttribute('aria-hidden', 'true');
    garland.innerHTML = buildGarland(doc);
    doc.body.insertBefore(garland, doc.body.firstChild);
    let timer = 0;
    garlandResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => garland && (garland.innerHTML = buildGarland(doc)), 150);
    };
    root.addEventListener('resize', garlandResize);
  }

  function sync(id, doc) {
    if (id === 'noel') {
      if (!reduced()) startSnow(doc);
      addGarland(doc);
    } else {
      stopSnow();
      removeGarland();
    }
  }

  root.swFx = { sync };
})(this);
