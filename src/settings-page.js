const list = document.getElementById('list');
const ver = document.getElementById('ver');
document.getElementById('close').addEventListener('click', () => window.simpleWork.closeSettings());
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.simpleWork.closeSettings();
});

const sizes = document.getElementById('sizes');
const errEl = document.getElementById('err');
const nameEl = document.getElementById('app-name');
const urlEl = document.getElementById('app-url');
const swatchesEl = document.getElementById('swatches');
const COLORS = ['#3B82F6', '#06b6d4', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];
let color = COLORS[0];

COLORS.forEach((c) => {
  const b = document.createElement('button');
  b.style.background = c;
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
[nameEl, urlEl].forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitApp(); }));
sizes.addEventListener('click', (e) => {
  const size = e.target.dataset && e.target.dataset.size;
  if (size) window.simpleWork.setIconSize(size);
});

let lang = 'vi';
const langs = document.getElementById('langs');
langs.addEventListener('click', (e) => {
  const l = e.target.dataset && e.target.dataset.lang;
  if (l) window.simpleWork.setLang(l);
});
const errText = (code) => i18n.t(lang, { name: 'errName', url: 'errUrl', last: 'errLast' }[code] || 'errGeneric');

function render({ apps, version, iconSize, lang: newLang }) {
  lang = newLang || 'vi';
  i18n.apply(lang, document);
  for (const b of langs.children) b.classList.toggle('on', b.dataset.lang === lang);
  ver.textContent = 'v' + version;
  for (const b of sizes.children) b.classList.toggle('on', b.dataset.size === iconSize);
  const enabledCount = apps.filter((a) => a.enabled).length;
  list.replaceChildren(
    ...apps.map((a) => {
      const row = document.createElement('div');
      row.className = 'row' + (a.enabled ? '' : ' off');

      const ico = document.createElement('div');
      ico.className = 'ico';
      ico.style.background = a.color;
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
