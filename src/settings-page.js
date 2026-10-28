const list = document.getElementById('list');
const ver = document.getElementById('ver');
const page = document.getElementById('page');
const keepAc = document.getElementById('keep-ac');
const keepBattery = document.getElementById('keep-battery');
keepAc.addEventListener('change', () => window.simpleWork.setKeepAwake({ ac: keepAc.checked }));
keepBattery.addEventListener('change', () => window.simpleWork.setKeepAwake({ battery: keepBattery.checked }));
const reloadWake = document.getElementById('reload-wake');
reloadWake.addEventListener('change', () => window.simpleWork.setReloadOnWake(reloadWake.checked));
const updStatus = document.getElementById('upd-status');
const updSub = document.getElementById('upd-sub');
const updBtn = document.getElementById('upd-btn');
const updAuto = document.getElementById('upd-auto');
updAuto.addEventListener('change', () => window.simpleWork.setAutoUpdate(updAuto.checked));
updBtn.addEventListener('click', () => {
  if (updBtn.dataset.act === 'download') window.simpleWork.updateDownload();
  else if (updBtn.dataset.act === 'install') window.simpleWork.updateInstall();
  else window.simpleWork.updateCheck();
});
const notifSound = document.getElementById('notif-sound');
notifSound.addEventListener('change', () => window.simpleWork.setNotifySound(notifSound.checked));
const level = document.getElementById('level');
const lv = document.getElementById('lv');
const langs = document.getElementById('langs');
const themes = document.getElementById('themes');
const errEl = document.getElementById('err');
const nameEl = document.getElementById('app-name');
const urlEl = document.getElementById('app-url');
const swatchesEl = document.getElementById('swatches');
const COLORS = ['#3B82F6', '#06b6d4', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];
let color = COLORS[0];
let lang = 'vi';

document.getElementById('close').addEventListener('click', () => window.simpleWork.closeSettings());
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.simpleWork.closeSettings();
});

// Hiệu ứng xuất hiện mỗi lần mở trang
window.simpleWork.onShown(() => {
  page.classList.remove('enter');
  void page.offsetWidth;
  page.classList.add('enter');
});

const errText = (code) => i18n.t(lang, { name: 'errName', url: 'errUrl', last: 'errLast' }[code] || 'errGeneric');
const gradientFor = (c) => c; // phẳng: một màu

function paintLevel() {
  lv.textContent = level.value;
  level.style.setProperty('--pct', ((level.value - 1) / 5) * 100 + '%');
}
// Kéo thanh trượt là thanh bên đổi cỡ ngay (như thanh phóng to Dock)
level.addEventListener('input', () => {
  paintLevel();
  window.simpleWork.setIconSize(Number(level.value));
});
langs.addEventListener('click', (e) => {
  const l = e.target.dataset && e.target.dataset.lang;
  if (l) window.simpleWork.setLang(l);
});
themes.addEventListener('click', (e) => {
  const th = e.target.dataset && e.target.dataset.theme;
  if (th) window.simpleWork.setTheme(th);
});

// Bộ pha màu: ba thanh Sắc / Đậm / Sáng cộng ô nhập mã màu. Giữ HSL riêng để kéo thanh không bị làm tròn theo mã hex.
function makeMixer(host, onPick) {
  const hsl = [30, 90, 54];
  host.innerHTML =
    '<div class="top"><div class="sw"></div><input type="text" maxlength="7" spellcheck="false" autocomplete="off"></div>' +
    ['mixHue', 'mixSat', 'mixLight'].map((k, i) => `<label><span data-i18n="${k}"></span><input type="range" min="0" max="${i ? 100 : 360}" step="1"><output></output></label>`).join('');
  const sw = host.querySelector('.sw');
  const hex = host.querySelector('input[type=text]');
  const ranges = [...host.querySelectorAll('input[type=range]')];
  const outs = [...host.querySelectorAll('output')];
  const color = () => swTheme.hslToHex(hsl[0], hsl[1], hsl[2]);
  function paint() {
    const c = color();
    sw.style.background = c;
    if (document.activeElement !== hex) hex.value = c;
    ranges.forEach((r, i) => {
      if (document.activeElement !== r) r.value = hsl[i];
      outs[i].textContent = hsl[i];
    });
    const [h, s, l] = hsl;
    ranges[0].style.background = 'linear-gradient(90deg,' + [0, 60, 120, 180, 240, 300, 360].map((x) => swTheme.hslToHex(x, 100, 50)).join(',') + ')';
    ranges[1].style.background = `linear-gradient(90deg, ${swTheme.hslToHex(h, 0, l)}, ${swTheme.hslToHex(h, 100, l)})`;
    ranges[2].style.background = `linear-gradient(90deg, #000, ${swTheme.hslToHex(h, s, 50)}, #fff)`;
  }
  let raf = 0;
  const emit = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => onPick(color()));
  };
  ranges.forEach((r, i) =>
    r.addEventListener('input', () => {
      hsl[i] = Number(r.value);
      paint();
      emit();
    })
  );
  hex.addEventListener('input', () => {
    let v = hex.value.trim();
    if (v && v[0] !== '#') v = '#' + v;
    if (!swTheme.isHex(v)) return;
    hsl.splice(0, 3, ...swTheme.hexToHsl(v));
    paint();
    onPick(v.toLowerCase());
  });
  hex.addEventListener('blur', paint);
  return {
    set(c) {
      if (!swTheme.isHex(c) || c.toLowerCase() === color().toLowerCase()) return;
      hsl.splice(0, 3, ...swTheme.hexToHsl(c));
      paint();
    },
    paint
  };
}
const lookMix = makeMixer(document.getElementById('lookMix'), (c) => window.simpleWork.setLookCustom(c));
const looksEl = document.getElementById('looks');
const lastCustom = { look: '#2b5cff' };
const LOOK_ORDER = ['system', ...Object.keys(swTheme.THEMES), 'custom'];

// Chủ đề = bảng màu nền app + màu thanh bên. Ô xem trước vẽ cả hai: dải bên trái là thanh bên, bên phải là nền app với một thẻ.
function buildLooks() {
  looksEl.replaceChildren();
  LOOK_ORDER.forEach((id) => {
    const t = swTheme.THEMES[id];
    const b = document.createElement('button');
    b.className = 'frame';
    b.dataset.look = id;
    const pv = document.createElement('div');
    pv.className = 'pv';
    if (t) {
      const rail = document.createElement('i');
      rail.style.background = t.frame.css;
      const body = document.createElement('i');
      body.style.background = t.palette.bg;
      body.innerHTML = `<div style="margin:7px 6px;border-radius:5px;background:${t.palette.card};border:1px solid ${t.palette.rule};padding:4px 6px"><div style="height:4px;border-radius:2px;background:${t.palette.ink};width:65%"></div><div style="height:3px;border-radius:2px;background:${t.palette.soft};width:40%;margin-top:3px"></div></div>`;
      pv.append(rail, body);
    } else if (id === 'custom') {
      pv.classList.add('conic');
      pv.append(document.createElement('i'), document.createElement('i'));
    } else {
      pv.style.background = 'linear-gradient(135deg, #f2f2f7 50%, #1c1c1e 50%)'; // theo hệ thống: nửa sáng nửa tối
      pv.style.gridTemplateColumns = '1fr';
    }
    const name = document.createElement('span');
    name.textContent = i18n.t(lang, 'look_' + id);
    b.append(pv, name);
    b.addEventListener('click', () => (id === 'custom' ? window.simpleWork.setLookCustom(lastCustom.look) : window.simpleWork.setLook(id)));
    looksEl.appendChild(b);
  });
}

COLORS.forEach((c) => {
  const b = document.createElement('button');
  b.style.background = gradientFor(c);
  b.title = c;
  b.addEventListener('click', () => {
    color = c;
    for (const x of swatchesEl.children) x.classList.toggle('on', x === b);
  });
  if (c === color) b.classList.add('on');
  swatchesEl.appendChild(b);
});

async function submitApp() {
  errEl.textContent = '';
  const res = await window.simpleWork.addApp({ name: nameEl.value, url: urlEl.value, color });
  if (res && res.ok) {
    nameEl.value = '';
    urlEl.value = '';
  } else {
    errEl.textContent = errText(res && res.error);
  }
}
document.getElementById('add').addEventListener('click', submitApp);
[nameEl, urlEl].forEach((el) =>
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitApp();
  })
);

// Kéo thả đổi thứ tự: đổi chỗ ngay trên DOM, thả chuột thì gửi thứ tự mới
let dragRow = null;
list.addEventListener('dragover', (e) => {
  if (!dragRow) return;
  e.preventDefault();
  const over = [...list.children].find((r) => r !== dragRow && e.clientY < r.getBoundingClientRect().top + r.offsetHeight / 2);
  if (over) list.insertBefore(dragRow, over);
  else list.appendChild(dragRow);
});
list.addEventListener('drop', (e) => e.preventDefault());

function renderUpdate(u, auto) {
  const cur = u.current.version + (u.current.build ? ` (${u.current.build})` : '');
  const v = u.latest ? u.latest.version : '';
  let text = i18n.t(lang, 'updUpToDate', { v: cur });
  let sub = '';
  let btn = i18n.t(lang, 'updCheck');
  let act = 'check';
  let disabled = false;
  if (u.status === 'checking') {
    text = i18n.t(lang, 'updChecking');
    disabled = true;
  } else if (u.status === 'downloading') {
    text = i18n.t(lang, 'updDownloading', { v, pct: u.progress });
    btn = i18n.t(lang, 'updLoading');
    disabled = true;
  } else if (u.status === 'ready') {
    text = i18n.t(lang, 'updReady', { v });
    btn = i18n.t(lang, 'updInstall');
    act = 'install';
  } else if (u.status === 'available') {
    if (u.canInstall) {
      text = i18n.t(lang, 'updAvailable', { v });
      btn = i18n.t(lang, 'updDownload');
      act = 'download';
    } else {
      text = i18n.t(lang, 'updAvailableManual', { v });
    }
  } else if (u.status === 'error') {
    text = i18n.t(lang, 'updError');
    sub = u.error;
    if (u.latest && u.canInstall) {
      btn = i18n.t(lang, 'updRetry');
      act = 'download';
    }
  } else if (u.status === 'idle') {
    text = i18n.t(lang, 'updIdle', { v: cur });
  }
  updStatus.textContent = text;
  updSub.textContent = sub; // chỉ hiện chi tiết khi lỗi; ghi chú phát hành xem trong popup cập nhật
  updBtn.textContent = btn;
  updBtn.dataset.act = act;
  updBtn.disabled = disabled;
  updBtn.style.opacity = disabled ? 0.5 : 1;
  updAuto.checked = auto !== false;
}

let looksLang = '';
function render({ apps, version, iconLevel, lang: newLang, theme, look, lookCustom, update, autoCheckUpdates, notifySound, keepAwakeAc, keepAwakeBattery, reloadOnWake }) {
  lang = newLang || 'vi';
  i18n.apply(lang, document);
  const info = swTheme.resolveTheme(look, lookCustom);
  swTheme.applyLook(info, document);
  lastCustom.look = lookCustom || lastCustom.look;
  if (looksLang !== lang) {
    looksLang = lang;
    buildLooks();
  }
  for (const b of looksEl.children) b.classList.toggle('on', b.dataset.look === look);
  document.getElementById('lookMix').hidden = look !== 'custom';
  lookMix.set(lookCustom);
  lookMix.paint();
  document.getElementById('modeGroup').hidden = look !== 'system'; // Tự động/Sáng/Tối chỉ có nghĩa khi theo hệ thống; chủ đề đã quy định sáng hoặc tối
  for (const b of langs.children) b.classList.toggle('on', b.dataset.lang === lang);
  if (document.activeElement !== level) level.value = iconLevel || 4;
  paintLevel();
  if (update) renderUpdate(update, autoCheckUpdates);
  notifSound.checked = notifySound !== false;
  keepAc.checked = keepAwakeAc !== false;
  keepBattery.checked = keepAwakeBattery !== false;
  reloadWake.checked = reloadOnWake !== false;
  for (const b of themes.children) b.classList.toggle('on', b.dataset.theme === theme);
  ver.textContent = 'v' + version;

  const enabledCount = apps.filter((a) => a.enabled && !a.local).length; // luôn giữ ít nhất 1 app web
  list.replaceChildren(
    ...apps.map((a) => {
      const row = document.createElement('div');
      row.className = 'row' + (a.enabled ? '' : ' off');
      row.dataset.id = a.id;

      const grip = document.createElement('div');
      grip.className = 'grip';
      grip.textContent = '⋮⋮';
      grip.title = i18n.t(lang, 'dragTitle');
      grip.addEventListener('mousedown', () => (row.draggable = true));
      row.addEventListener('mouseup', () => (row.draggable = false));
      row.addEventListener('dragstart', (e) => {
        dragRow = row;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', a.id);
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        row.draggable = false;
        dragRow = null;
        window.simpleWork.setOrder([...list.children].map((r) => r.dataset.id));
      });
      row.appendChild(grip);

      const ico = document.createElement('div');
      ico.className = 'ico';
      ico.appendChild(swIcon.node(a));
      row.appendChild(ico);

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = a.name;
      row.appendChild(name);

      const state = document.createElement('div');
      state.className = 'state';
      state.textContent = i18n.t(lang, a.enabled ? 'on' : 'off');
      row.appendChild(state);

      if (a.custom) {
        const del = document.createElement('button');
        del.className = 'del';
        del.textContent = i18n.t(lang, 'remove');
        let timer;
        del.addEventListener('click', async () => {
          if (!del.classList.contains('confirm')) {
            del.classList.add('confirm');
            del.textContent = i18n.t(lang, 'removeConfirm');
            timer = setTimeout(() => {
              del.classList.remove('confirm');
              del.textContent = i18n.t(lang, 'remove');
            }, 3000);
            return;
          }
          clearTimeout(timer);
          const res = await window.simpleWork.removeApp(a.id);
          if (res && res.error) errEl.textContent = errText(res.error);
        });
        row.appendChild(del);
      }

      const label = document.createElement('label');
      label.className = 'switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = a.enabled;
      input.disabled = a.enabled && !a.local && enabledCount <= 1;
      input.addEventListener('change', () => window.simpleWork.setEnabled(a.id, input.checked));
      label.append(input, document.createElement('span'));
      row.appendChild(label);
      return row;
    })
  );
}

window.simpleWork.onSettings(render);
window.simpleWork.getSettings().then(render);
