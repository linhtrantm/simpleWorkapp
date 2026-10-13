const bar = document.getElementById('bar');
const pill = document.getElementById('pill');
const gear = document.getElementById('gear');
const stage = document.getElementById('stage');
const items = new Map(); // id -> { item, icon, badge, count }
let lang = 'vi';
let last = null; // state gần nhất, dùng để vẽ lại khi đổi kích thước
let pillAnimated = false;

gear.addEventListener('mousedown', () => window.simpleWork.toggleSettings());

function gradientFor(color) {
  return `linear-gradient(150deg, color-mix(in srgb, ${color} 70%, #fff), ${color})`;
}

function iconNode(t, withClass) {
  if (t.icon) {
    const img = document.createElement('img');
    img.src = t.icon;
    img.alt = t.name;
    return img;
  }
  const letter = document.createElement('span');
  letter.className = 'letter';
  letter.textContent = t.letter || '?';
  return letter;
}

function createItem(t) {
  const item = document.createElement('div');
  item.className = 'item';
  item.title = t.name;
  // mousedown thay vì click: không bị huỷ nếu DOM đổi giữa lúc nhấn và nhả
  item.addEventListener('mousedown', (e) => {
    if (e.button === 0) window.simpleWork.select(t.id);
  });
  // Chuột phải: menu có "Tải lại" (tránh bấm nhầm nút reload)
  item.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.simpleWork.itemMenu(t.id);
  });

  const icon = document.createElement('div');
  icon.className = 'icon';
  icon.style.background = gradientFor(t.color);
  icon.style.setProperty('--glow', t.color);
  icon.appendChild(iconNode(t));
  item.appendChild(icon);

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.hidden = true;
  icon.appendChild(badge);

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = t.name;
  item.appendChild(label);

  return { item, icon, badge, count: 0 };
}

function movePill(activeEl) {
  if (!activeEl) {
    pill.classList.remove('on');
    return;
  }
  pill.style.width = activeEl.offsetWidth + 'px';
  pill.style.height = activeEl.offsetHeight + 'px';
  pill.style.transform = `translate(${activeEl.offsetLeft}px, ${activeEl.offsetTop}px)`;
  pill.classList.add('on');
  if (!pillAnimated) {
    // lần đầu đặt vị trí ngay, các lần sau mới trượt
    requestAnimationFrame(() => requestAnimationFrame(() => pill.classList.add('anim')));
    pillAnimated = true;
  }
}

function renderStage(state, tab) {
  const load = state.load || { state: 'ready' };
  if (!tab || load.state === 'ready') {
    stage.replaceChildren();
    return;
  }
  const big = document.createElement('div');
  big.className = 'big';
  big.style.background = gradientFor(tab.color);
  big.style.setProperty('--glow', tab.color);
  big.appendChild(iconNode(tab));

  const msg = document.createElement('div');
  msg.className = 'msg';
  if (load.state === 'loading') {
    msg.textContent = i18n.t(lang, 'loadingApp', { name: tab.name });
    const dots = document.createElement('div');
    dots.className = 'dots';
    dots.innerHTML = '<i></i><i></i><i></i>';
    stage.replaceChildren(big, msg, dots);
  } else {
    big.style.animation = 'none';
    big.style.opacity = '.6';
    msg.textContent = i18n.t(lang, 'loadFailed', { name: tab.name });
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = i18n.t(lang, 'loadFailedHint');
    const code = document.createElement('div');
    code.className = 'code';
    code.textContent = load.error || '';
    const retry = document.createElement('button');
    retry.className = 'retry';
    retry.textContent = i18n.t(lang, 'retry');
    retry.addEventListener('click', () => window.simpleWork.reload(tab.id));
    stage.replaceChildren(big, msg, sub, code, retry);
  }
}

function render(state) {
  last = state;
  const { tabs, activeId, settingsOpen, ui } = state;
  lang = state.lang || 'vi';
  i18n.apply(lang, document);
  swTheme.apply(state.accent, document);

  const root = document.documentElement.style;
  root.setProperty('--side-w', ui.width + 'px');
  root.setProperty('--icon', ui.icon + 'px');
  root.setProperty('--glyph', ui.glyph + 'px');
  root.setProperty('--label-display', ui.label ? 'block' : 'none');
  root.setProperty('--label-size', (ui.labelSize || 9.5) + 'px');

  const ids = new Set(tabs.map((t) => t.id));
  for (const [id, entry] of items) {
    if (!ids.has(id)) {
      entry.item.remove();
      items.delete(id);
    }
  }
  let activeEl = null;
  tabs.forEach((t, i) => {
    let entry = items.get(t.id);
    if (!entry) {
      entry = createItem(t);
      items.set(t.id, entry);
    }
    // giữ đúng thứ tự (app bật lại hoặc đổi thứ tự)
    const anchor = bar.children[i + 1]; // children[0] là #pill
    if (anchor !== entry.item) bar.insertBefore(entry.item, anchor || null);
    const active = !settingsOpen && t.id === activeId;
    entry.item.classList.toggle('active', active);
    if (active) activeEl = entry.item;
    entry.badge.hidden = !(t.unread > 0);
    entry.badge.textContent = t.unread > 0 ? t.unread : '';
    entry.icon.classList.toggle('has-unread', t.unread > 0 && !active);
    if (t.unread > entry.count) {
      entry.badge.classList.remove('pop');
      void entry.badge.offsetWidth; // chạy lại animation
      entry.badge.classList.add('pop');
    }
    entry.count = t.unread;
  });
  gear.classList.toggle('active', !!settingsOpen);

  const current = tabs.find((t) => t.id === activeId);
  document.body.style.setProperty('--tint', settingsOpen || !current ? 'var(--accent)' : current.color);
  renderStage(state, settingsOpen ? null : current);

  // icon đã đổi cỡ nên chờ một nhịp rồi mới đo vị trí ô sáng
  requestAnimationFrame(() => movePill(activeEl));
}

window.simpleWork.onState(render);
new ResizeObserver(() => {
  if (last) render(last);
}).observe(bar);
window.simpleWork.ready();
