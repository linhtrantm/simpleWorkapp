// Hiệu ứng riêng của chủ đề Noel (theme.md mục 8): tuyết rơi và dây đèn nhấp nháy. Các chủ đề khác không có hiệu ứng.
// Tuyết chạy 30 khung/giây trên một canvas, dừng khi trang ẩn; tôn trọng "giảm chuyển động" của macOS.
(function (root) {
  let snow = null; // { canvas, host, raf, last, flakes, onResize }
  let garland = null;

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
      const n = Math.max(14, Math.min(70, Math.round((s.w * s.h) / 11000)));
      s.flakes = Array.from({ length: n }, () => {
        const q = Math.random();
        const z = q < 0.55 ? 0 : q < 0.88 ? 1 : 2; // xa, vừa, gần (hạt gần vẽ thành bông tuyết 6 cánh)
        return {
          x: Math.random() * s.w,
          y: Math.random() * s.h,
          z,
          r: z === 0 ? 1 + Math.random() * 0.9 : z === 1 ? 1.8 + Math.random() * 1.4 : 3.6 + Math.random() * 2,
          v: z === 0 ? 15 + Math.random() * 18 : z === 1 ? 36 + Math.random() * 36 : 66 + Math.random() * 48,
          sway: 6 + z * 7,
          ph: Math.random() * 6.28,
          rot: Math.random() * 3.14
        };
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
        f.rot += dt * 0.3;
        const x = f.x + Math.sin(f.ph) * f.sway;
        if (f.y > s.h + 8) {
          f.y = -8;
          f.x = Math.random() * s.w;
        }
        // Trắng có quầng xanh nhạt để thấy được trên nền kem
        ctx.shadowColor = 'rgba(110,150,200,.6)';
        ctx.shadowBlur = f.z === 2 ? 6 : 3;
        if (f.z === 2 && f.r > 4.2) {
          ctx.save();
          ctx.translate(x, f.y);
          ctx.rotate(f.rot);
          ctx.strokeStyle = 'rgba(255,255,255,.95)';
          ctx.lineWidth = 1.3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          for (let k = 0; k < 3; k++) {
            const ang = (k * Math.PI) / 3;
            ctx.moveTo(-Math.cos(ang) * f.r * 1.3, -Math.sin(ang) * f.r * 1.3);
            ctx.lineTo(Math.cos(ang) * f.r * 1.3, Math.sin(ang) * f.r * 1.3);
          }
          ctx.stroke();
          ctx.restore();
          continue;
        }
        ctx.fillStyle = f.z === 0 ? 'rgba(255,255,255,.6)' : f.z === 1 ? 'rgba(255,255,255,.88)' : 'rgba(255,255,255,.95)';
        ctx.beginPath();
        ctx.arc(x, f.y, f.r, 0, 6.2832);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    };
    s.raf = requestAnimationFrame(frame);
    snow = s;
  }

  // Dây đèn: dây nâu võng từng cung, bốn bóng đèn pastel mỗi cung, nhấp nháy lệch pha bằng CSS
  function buildGarland() {
    const colors = ['#3f8f4f', '#ffd43b', '#d6455d', '#7be08f'];
    const bulbs = [12, 36, 60, 84]
      .map((x, i) => `<g class="b" style="animation-delay:${(i * 0.4).toFixed(1)}s"><rect x="${x - 2}" y="13" width="4" height="4" rx="1" fill="#5a3a20"/><path d="M${x - 4.2} 17h8.4c0 5-2 8-4.2 8s-4.2-3-4.2-8z" fill="${colors[i]}" stroke="#3a2e2a" stroke-width=".9"/></g>`)
      .join('');
    return `<svg width="100%" height="32" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="swGarland" width="96" height="32" patternUnits="userSpaceOnUse"><path d="M0 3Q12 22 24 3Q36 22 48 3Q60 22 72 3Q84 22 96 3" fill="none" stroke="#5a3a20" stroke-width="1.8"/>${bulbs}</pattern></defs><rect width="100%" height="32" fill="url(#swGarland)"/></svg>`;
  }

  function addGarland(doc) {
    if (garland || doc.getElementById('side')) return; // trang chính không có dây đèn
    garland = doc.createElement('div');
    garland.className = 'noel-garland';
    garland.setAttribute('aria-hidden', 'true');
    garland.innerHTML = buildGarland();
    doc.body.insertBefore(garland, doc.body.firstChild);
  }

  function removeGarland() {
    if (garland) garland.remove();
    garland = null;
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
