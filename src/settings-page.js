const list = document.getElementById('list');
const ver = document.getElementById('ver');
const page = document.getElementById('page');
const notifSound = document.getElementById('notif-sound');
notifSound.addEventListener('change', () => window.simpleWork.setNotifySound(notifSound.checked));
const level = document.getElementById('level');
const lv = document.getElementById('lv');
const langs = document.getElementById('langs');
const themes = document.getElementById('themes');
const accents = document.getElementById('accents');
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
const gradientFor = (c) => `linear-gradient(150deg, color-mix(in srgb, ${c} 70%, #fff), ${c})`;

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

Object.entries(swTheme.ACCENTS).forEach(([key, [a, b]]) => {
  const btn = document.createElement('button');
  btn.dataset.accent = key;
  btn.title = key;
  btn.style.background = `linear-gradient(135deg, ${a}, ${b})`;
  btn.addEventListener('click', () => window.simpleWork.setAccent(key));
  accents.appendChild(btn);
});

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

function render({ apps, version, iconLevel, lang: newLang, theme, accent, notifySound }) {
  lang = newLang || 'vi';
  i18n.apply(lang, document);
  swTheme.apply(accent, document);
  for (const b of langs.children) b.classList.toggle('on', b.dataset.lang === lang);
  if (document.activeElement !== level) level.value = iconLevel || 4;
  paintLevel();
  notifSound.checked = notifySound !== false;
  for (const b of themes.children) b.classList.toggle('on', b.dataset.theme === theme);
  for (const b of accents.children) b.classList.toggle('on', b.dataset.accent === accent);
  ver.textContent = 'v' + version;

  const enabledCount = apps.filter((a) => a.enabled).length;
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
      ico.style.background = gradientFor(a.color);
      if (a.icon) {
        const img = document.createElement('img');
        img.src = a.icon;
        img.alt = '';
        ico.appendChild(img);
      } else {
        const letter = document.createElement('span');
        letter.className = 'letter';
        letter.textContent = a.letter || '?';
        ico.appendChild(letter);
      }
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
      input.disabled = a.enabled && enabledCount <= 1;
      input.addEventListener('change', () => window.simpleWork.setEnabled(a.id, input.checked));
      label.append(input, document.createElement('span'));
      row.appendChild(label);
      return row;
    })
  );
}

window.simpleWork.onSettings(render);
window.simpleWork.getSettings().then(render);
