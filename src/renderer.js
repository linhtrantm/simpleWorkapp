const bar = document.getElementById('bar');
const gear = document.getElementById('gear');
const title = document.getElementById('title');
const ext = document.getElementById('ext');
let lang = 'vi';
ext.addEventListener('mousedown', () => window.simpleWork.openExternal());
const items = new Map(); // id -> { item, badge }

gear.addEventListener('mousedown', () => window.simpleWork.toggleSettings());

function createItem(t) {
  const item = document.createElement('div');
  item.className = 'item';
  item.title = t.name;
  // mousedown thay vì click: không bị huỷ nếu DOM đổi giữa lúc nhấn và nhả
  item.addEventListener('mousedown', (e) => {
    if (e.button === 0) window.simpleWork.select(t.id);
  });

  const icon = document.createElement('div');
  icon.className = 'icon';
  icon.style.background = t.color;
  icon.style.setProperty('--glow', t.color);
  item.appendChild(icon);

  if (t.icon) {
    const img = document.createElement('img');
    img.src = t.icon;
    img.alt = t.name;
    icon.appendChild(img);
  } else {
    const letter = document.createElement('span');
    letter.className = 'letter';
    letter.textContent = t.letter || '?';
    icon.appendChild(letter);
  }

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.hidden = true;
  icon.appendChild(badge);

  const r = document.createElement('button');
  r.className = 'reload';
  r.title = i18n.t(lang, 'reload', { name: t.name });
  r.textContent = '⟳';
  r.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    window.simpleWork.reload(t.id);
  });
  icon.appendChild(r);

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = t.name;
  item.appendChild(label);

  return { item, badge, reload: r };
}

window.simpleWork.onState(({ tabs, activeId, settingsOpen, canOpenExternal, lang: newLang, ui }) => {
  lang = newLang || 'vi';
  i18n.apply(lang, document);
  ext.style.display = canOpenExternal && !settingsOpen ? 'flex' : 'none';
  const root = document.documentElement.style;
  root.setProperty('--side-w', ui.width + 'px');
  root.setProperty('--icon', ui.icon + 'px');
  root.setProperty('--glyph', ui.glyph + 'px');
  root.setProperty('--label-display', ui.label ? 'block' : 'none');
  const ids = new Set(tabs.map((t) => t.id));
  for (const [id, entry] of items) {
    if (!ids.has(id)) {
      entry.item.remove();
      items.delete(id);
    }
  }
  tabs.forEach((t, i) => {
    let entry = items.get(t.id);
    if (!entry) {
      entry = createItem(t);
      items.set(t.id, entry);
    }
    // giữ đúng thứ tự (app bật lại có thể chen vào giữa)
    if (bar.children[i] !== entry.item) bar.insertBefore(entry.item, bar.children[i] || null);
    entry.item.classList.toggle('active', !settingsOpen && t.id === activeId);
    entry.reload.title = i18n.t(lang, 'reload', { name: t.name });
    entry.badge.hidden = !(t.unread > 0);
    entry.badge.textContent = t.unread > 0 ? t.unread : '';
  });
  gear.classList.toggle('active', !!settingsOpen);
  const current = tabs.find((t) => t.id === activeId);
  title.textContent = settingsOpen ? i18n.t(lang, 'settings') : current ? current.name : 'simpleWork';
});

window.simpleWork.ready();
