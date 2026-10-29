const $ = (id) => document.getElementById(id);
const addEl = $('add');
let lang = 'vi';
let state = null;
let choosing = null; // id việc định bắt đầu khi đang có việc khác chạy
let selDate = null; // ngày đang xem (null = hôm nay)
let tab = 'today'; // today | repeat | prefs
let doneOpen = false; // nhóm "Đã xong" đang mở
let openId = null; // việc đang mở trong ngăn chi tiết

const mins = (ms) => Math.max(0, Math.round(ms / 60000));

const T = (k, v) => i18n.t(lang, k, v);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const shift = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const DAY_KEYS = ['dayD0', 'dayD1', 'dayD2', 'dayD3', 'dayD4', 'dayD5', 'dayD6'];
// "Hôm nay", "Ngày mai 26/10", hoặc "T6 31/10"
function dateLabel(date, today) {
  const d = parse(date);
  const short = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (date === today) return T('dayTodayShort');
  if (date === shift(today, 1)) return `${T('dayTomorrow')} ${short}`;
  return `${T(DAY_KEYS[d.getDay()])} ${short}`;
}

function row(task) {
  const r = el('div', 'row' + (task.status === 'done' ? ' done' : ''));
  r.dataset.id = task.id;
  if (task.status !== 'done') {
    const g = el('span', 'grip', '⋮⋮');
    g.addEventListener('mousedown', () => (r.draggable = true));
    r.addEventListener('dragend', () => (r.draggable = false));
    r.appendChild(g);
  }
  if (state.isToday) {
    const tick = el('button', 'tick');
    tick.addEventListener('click', () => apply(window.dayTask.toggle(task.id)));
    r.appendChild(tick);
  }
  const title = el('div', 'title', task.title);
  if (task.status !== 'done') {
    title.contentEditable = 'plaintext-only';
    title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        title.blur();
      }
    });
    title.addEventListener('blur', () => {
      const v = title.textContent.trim();
      if (v && v !== task.title) apply(window.dayTask.update(task.id, { title: v }));
      else title.textContent = task.title;
    });
  }
  r.appendChild(title);
  if (task.note) {
    const h = el('span', 'hasnote');
    h.title = T('dayHasNote');
    h.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>';
    r.appendChild(h);
  }
  if (task.carriedFrom) r.appendChild(el('span', 'tag', T('dayCarried', { date: task.carriedFrom.slice(5).replace('-', '/') })));
  if (!state.isToday) {
    // việc của ngày sau: chưa bắt đầu hay tick được, chỉ sửa, đổi thứ tự, xoá hoặc dời về hôm nay
    const move = el('button', 'play', T('dayMoveToday'));
    move.addEventListener('click', () => apply(window.dayTask.move(task.id)));
    r.appendChild(move);
  } else if (task.state === 'doing') {
    r.classList.add('doing');
    r.appendChild(el('span', 'tag live', T('dayNowTag')));
  } else if (task.status !== 'done') {
    if (task.state === 'paused') r.classList.add('paused');
    if (task.trackedMs >= 60000) r.appendChild(el('span', 'tag', T('dayMinutes', { min: mins(task.trackedMs) })));
    const play = el('button', 'play', task.state === 'paused' ? T('dayPausedTag') + ' ▶' : T('dayStart') + ' ▶');
    play.addEventListener('click', () => start(task.id));
    r.appendChild(play);
  }
  const more = el('button', 'more', '›');
  more.title = T('dayDetail');
  more.addEventListener('click', () => openDrawer(task.id));
  r.appendChild(more);
  const del = el('button', 'del', '✕');
  del.title = T('dayDelete');
  del.addEventListener('click', () => apply(window.dayTask.remove(task.id)));
  r.appendChild(del);
  if (task.id === openId) r.classList.add('sel');
  r.addEventListener('click', (e) => {
    if (e.target.closest('button, .title, .grip')) return; // bấm vào chỗ trống của dòng thì mở chi tiết
    openDrawer(task.id);
  });
  return r;
}

const newDays = new Set([1, 2, 3, 4, 5]); // mẫu mới mặc định thứ Hai tới thứ Sáu
const PREFS = [
  ['morningOn', 'dayPrefMorning', 'morningTime'],
  ['endOn', 'dayPrefEnd', 'endTime'],
  ['idleOn', 'dayPrefIdle', 'idleMin'],
  ['remindOn', 'dayPrefRemind'],
  ['widgetOn', 'dayPrefWidget'],
  ['shortcutsOn', 'dayPrefShortcuts']
];

function renderDayChips(box, days, onToggle) {
  box.textContent = '';
  for (let d = 1; d <= 7; d++) {
    const wd = d % 7; // hiện Thứ Hai trước, Chủ nhật cuối
    const chip = el(onToggle ? 'button' : 'span', days.has(wd) ? 'on' : '', T(DAY_KEYS[wd]));
    if (onToggle) chip.addEventListener('click', () => onToggle(wd));
    box.appendChild(chip);
  }
}

function renderTemplates(s) {
  const box = $('tpls');
  box.textContent = '';
  s.templates.forEach((t) => {
    const r = el('div', 'tpl');
    r.appendChild(el('div', 't', t.title));
    const chips = el('div', 'days');
    renderDayChips(chips, new Set(t.days));
    r.appendChild(chips);
    const del = el('button', 'del', '✕');
    del.title = T('dayDelete');
    del.addEventListener('click', () => apply(window.dayTask.removeTemplate(t.id)));
    r.appendChild(del);
    box.appendChild(r);
  });
  renderDayChips($('tplDays'), newDays, (wd) => {
    if (newDays.has(wd)) newDays.delete(wd);
    else newDays.add(wd);
    renderTemplates(state);
  });
}

function renderPrefs(s) {
  const box = $('prefs');
  box.textContent = '';
  PREFS.forEach(([key, label, extra]) => {
    const r = el('label', 'pref');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = !!s.prefs[key];
    cb.addEventListener('change', () => apply(window.dayTask.setPrefs({ [key]: cb.checked })));
    r.appendChild(el('span', 't', T(label)));
    if (extra) {
      const inp = el('input');
      inp.type = extra === 'idleMin' ? 'number' : 'time';
      if (extra === 'idleMin') {
        inp.min = 1;
        inp.max = 120;
      }
      inp.value = s.prefs[extra];
      inp.addEventListener('change', () => apply(window.dayTask.setPrefs({ [extra]: extra === 'idleMin' ? Number(inp.value) : inp.value })));
      r.appendChild(inp);
      if (extra === 'idleMin') r.appendChild(el('span', '', T('dayPrefMin')));
    }
    const tog = el('span', 'tog');
    tog.append(cb, el('span'));
    r.appendChild(tog);
    box.appendChild(r);
  });
}

function renderNav(s) {
  const nav = $('nav');
  nav.textContent = '';
  const go = (d) => {
    selDate = d === s.today ? null : d;
    choosing = null;
    refresh();
  };
  const prev = el('button', 'navbtn', '‹');
  prev.disabled = s.isToday;
  prev.addEventListener('click', () => go(shift(s.date, -1)));
  const next = el('button', 'navbtn', '›');
  next.addEventListener('click', () => go(shift(s.date, 1)));
  const today = el('button', 'navchip' + (s.isToday ? ' on' : ''), T('dayTodayShort'));
  today.addEventListener('click', () => go(s.today));
  const tomorrow = el('button', 'navchip' + (s.date === shift(s.today, 1) ? ' on' : ''), T('dayTomorrow'));
  tomorrow.addEventListener('click', () => go(shift(s.today, 1)));
  const pick = el('input', 'navdate');
  pick.type = 'date';
  pick.min = s.today;
  pick.value = s.date;
  pick.addEventListener('change', () => pick.value && go(pick.value >= s.today ? pick.value : s.today));
  const cal = el('button', 'navbtn');
  cal.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
  cal.id = 'cal';
  cal.title = T('dayPickDate');
  cal.addEventListener('click', () => (pick.showPicker ? pick.showPicker() : pick.focus()));
  nav.append(prev, today, tomorrow, next, cal, pick);
  const upc = $('upc');
  upc.textContent = '';
  if (s.upcoming.length) {
    const up = el('div', 'upcoming');
    up.appendChild(el('span', 'uplabel', T('dayUpcoming')));
    s.upcoming.slice(0, 6).forEach((u) => {
      const chip = el('button', 'navchip' + (u.date === s.date ? ' on' : ''), `${dateLabel(u.date, s.today)} · ${u.count}`);
      chip.addEventListener('click', () => go(u.date));
      up.appendChild(chip);
    });
    upc.appendChild(up);
  }
}

function render() {
  const s = state;
  const dl = dateLabel(s.date, s.today);
  $('title').textContent = s.isToday || tab !== 'today' ? T('dayTask') : T('dayTitleDate', { d: s.date === shift(s.today, 1) ? dl.charAt(0).toLowerCase() + dl.slice(1) : dl }); // "Việc ngày mai 29/10"
  addEl.placeholder = s.isToday ? T('dayAddPlaceholder') : T('dayAddFuture', { d: dateLabel(s.date, s.today) });
  renderNav(s);
  $('progText').textContent = T('dayProgress', { done: s.stats.done, total: s.stats.total });
  $('progBar').style.width = (s.stats.total ? Math.round((s.stats.done / s.stats.total) * 100) : 0) + '%';
  $('prog').hidden = tab !== 'today';
  for (const b of $('tabs').children) b.classList.toggle('on', b.dataset.tab === tab);
  $('pageToday').hidden = tab !== 'today';
  $('pageRepeat').hidden = tab !== 'repeat';
  $('pagePrefs').hidden = tab !== 'prefs';
  $('dock').hidden = tab !== 'today';
  const carry = $('carry');
  carry.textContent = '';
  if (s.carry.ask) {
    const box = el('div', 'carry');
    box.appendChild(el('b', '', T('dayCarryTitle', { count: s.carry.count })));
    box.appendChild(el('p', '', s.carry.titles.join(' · ') + (s.carry.count > s.carry.titles.length ? ' …' : '')));
    const yes = el('button', '', T('dayCarryYes'));
    yes.addEventListener('click', () => apply(window.dayTask.carry()));
    const no = el('button', 'ghost', T('dayCarryNo'));
    no.addEventListener('click', () => apply(window.dayTask.skipCarry()));
    box.append(yes, no);
    carry.appendChild(box);
  }
  const now = $('now');
  now.textContent = '';
  if (s.active && s.isToday) {
    const t = s.todo.find((x) => x.id === s.active.id);
    const box = el('div', 'now');
    box.appendChild(el('small', '', T('dayNowTag')));
    box.appendChild(el('b', '', s.active.title));
    if (t && t.trackedMs >= 60000) box.appendChild(el('span', 'clk', mins(t.trackedMs) + "'"));
    const pause = el('button', 'ghost', T('dayPause'));
    pause.addEventListener('click', () => apply(window.dayTask.pause()));
    const done = el('button', '', T('dayDoneBtn', { name: s.active.title.length > 30 ? s.active.title.slice(0, 29) + '…' : s.active.title }));
    done.addEventListener('click', () => apply(window.dayTask.done()));
    box.append(done, pause);
    now.appendChild(box);
  }
  const todo = $('todo');
  todo.textContent = '';
  s.todo.forEach((t) => {
    todo.appendChild(row(t));
    if (choosing === t.id && s.active) {
      const box = el('div', 'switch');
      box.appendChild(el('p', '', T('dayBusy', { name: s.active.title })));
      const pause = el('button', '', T('dayBusyPause'));
      pause.addEventListener('click', () => start(t.id, 'pause'));
      const done = el('button', '', T('dayBusyDone'));
      done.addEventListener('click', () => start(t.id, 'done'));
      const cancel = el('button', 'ghost', T('dayCancel'));
      cancel.addEventListener('click', () => {
        choosing = null;
        render();
      });
      box.append(pause, done, cancel);
      todo.appendChild(box);
    }
  });
  if (!s.todo.length) todo.appendChild(el('div', 'empty', s.stats.total ? T('dayAllDone') : s.isToday ? T('dayEmpty') : T('dayEmptyFuture')));
  const done = $('done');
  done.textContent = '';
  $('doneLabel').textContent = T('dayDoneGroup', { n: s.done.length });
  $('doneToggle').classList.toggle('open', doneOpen);
  if (doneOpen) s.done.forEach((t) => done.appendChild(row(t)));
  $('doneWrap').style.display = s.done.length ? '' : 'none';
  renderTemplates(s);
  renderPrefs(s);
  if (openId) {
    const t = findTask(openId);
    if (t) fillDrawer(t, false);
    else {
      openId = null;
      dirty = false;
      drawer.classList.remove('open');
      document.body.classList.remove('with-drawer');
    }
  }
}

// ---- Ngăn chi tiết (mô tả nhiều dòng) ----
const drawer = $('drawer');
const dTitle = $('dTitle');
const dNote = $('dNote');
const dSaved = $('dSaved');
let saveTimer = 0;
let savedTimer = 0;
let dirty = false;

const findTask = (id) => state && [...state.todo, ...state.done].find((t) => t.id === id);

function fitNote() {
  dNote.style.height = 'auto';
  dNote.style.height = Math.min(dNote.scrollHeight + 2, window.innerHeight * 0.55) + 'px';
}

async function flushNote() {
  clearTimeout(saveTimer);
  if (!dirty || !openId) return;
  dirty = false;
  dSaved.textContent = T('daySaving');
  dSaved.classList.add('on');
  await window.dayTask.update(openId, { note: dNote.value });
  dSaved.textContent = T('daySaved');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => dSaved.classList.remove('on'), 1400);
  refresh();
}

function fillDrawer(t, full) {
  if (full || document.activeElement !== dTitle) dTitle.value = t.title;
  if (full || (document.activeElement !== dNote && !dirty)) {
    dNote.value = t.note || '';
    fitNote();
  }
  const bits = [];
  $('dState').textContent = t.status === 'done' ? T('dayDoneBtnShort') : t.state === 'doing' ? T('dayNowTag') : t.state === 'paused' ? T('dayPausedTag') : T('dayTabToday');
  const created = t.createdAt ? new Date(t.createdAt) : null;
  $('dCreated').textContent = created ? T('dayCreatedAt', { t: created.toLocaleDateString(lang === 'en' ? 'en-GB' : 'vi-VN', { day: '2-digit', month: '2-digit' }) + ' ' + created.toLocaleTimeString(lang === 'en' ? 'en-GB' : 'vi-VN', { hour: '2-digit', minute: '2-digit' }) }) : '';
  $('dCreated').hidden = !created;
  if (t.trackedMs >= 60000) bits.push(T('dayTimeSpent', { min: mins(t.trackedMs) }));
  $('dState').textContent += bits.length ? ' · ' + bits[0] : '';
  $('dDel').textContent = T('dayDeleteTask');
}

function openDrawer(id) {
  const t = findTask(id);
  if (!t) return;
  if (openId && openId !== id) flushNote();
  openId = id;
  fillDrawer(t, true);
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('with-drawer');
  render();
  setTimeout(() => dNote.focus(), 120);
}

async function closeDrawer() {
  if (!openId) return;
  await flushNote();
  openId = null;
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('with-drawer');
  render();
}

dNote.addEventListener('input', () => {
  dirty = true;
  fitNote();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushNote, 600);
});
dNote.addEventListener('blur', flushNote);
dNote.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.stopPropagation();
    dNote.blur();
  }
});
async function saveTitle() {
  const v = dTitle.value.trim();
  const t = findTask(openId);
  if (!t) return;
  if (v && v !== t.title) await window.dayTask.update(openId, { title: v });
  else dTitle.value = t.title;
  refresh();
}
dTitle.addEventListener('blur', saveTitle);
dTitle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) dTitle.blur();
  if (e.key === 'Escape') {
    e.stopPropagation();
    dTitle.value = (findTask(openId) || {}).title || '';
    dTitle.blur();
  }
});
$('dClose').addEventListener('click', closeDrawer);
$('dDel').addEventListener('click', async () => {
  const id = openId;
  dirty = false;
  await closeDrawer();
  apply(window.dayTask.remove(id));
});

// Kéo thả đổi thứ tự các việc chưa xong
let dragging = null;
$('todo').addEventListener('dragstart', (e) => {
  dragging = e.target.closest('.row');
  if (dragging) dragging.classList.add('dragging');
});
$('todo').addEventListener('dragover', (e) => {
  if (!dragging) return;
  e.preventDefault();
  const over = e.target.closest('.row');
  if (!over || over === dragging) return;
  const after = e.clientY > over.getBoundingClientRect().top + over.offsetHeight / 2;
  over.parentNode.insertBefore(dragging, after ? over.nextSibling : over);
});
$('todo').addEventListener('dragend', async () => {
  if (!dragging) return;
  dragging.classList.remove('dragging');
  dragging = null;
  apply(window.dayTask.reorder([...$('todo').querySelectorAll('.row')].map((r) => r.dataset.id), selDate || undefined));
});

async function start(id, prev) {
  const v = await window.dayTask.start(id, prev);
  choosing = v.error === 'busy' ? id : null; // đang có việc khác chạy: hỏi tạm dừng hay Done
  await refresh();
}

// Mọi thao tác xong thì lấy lại danh sách của ngày đang xem
async function apply(p) {
  await p;
  await refresh();
}

async function refresh() {
  const v = await window.dayTask.view(selDate || undefined);
  lang = v.lang || 'vi';
  i18n.apply(lang, document);
  swTheme.applyLook(v.look, document);
  if (selDate && v.date !== selDate) selDate = v.date === v.today ? null : v.date; // ngày đã qua (sang ngày mới) thì về hôm nay
  state = v;
  render();
}

function addTpl() {
  const v = $('tplTitle').value.trim();
  if (!v || !newDays.size) return;
  $('tplTitle').value = '';
  apply(window.dayTask.addTemplate(v, [...newDays]));
}
$('tplAdd').addEventListener('click', addTpl);
$('tplTitle').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing) addTpl();
});

// Hiệu ứng như gửi tin nhắn: chữ vừa gõ bay từ ô nhập lên vị trí của việc mới rồi việc đó hiện ra
function sendFx(text, from, target) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const bubble = el('div', 'fly', text);
  bubble.style.left = from.left + 20 + 'px';
  bubble.style.top = from.top + (from.height - 38) / 2 + 'px';
  bubble.style.maxWidth = from.width - 60 + 'px';
  document.body.appendChild(bubble);
  let dx = 0;
  let dy = -90;
  if (target) {
    target.scrollIntoView({ block: 'nearest' });
    target.style.opacity = 0;
    const r = target.getBoundingClientRect();
    dx = r.left + 52 - (from.left + 20);
    dy = r.top + (r.height - 38) / 2 - (from.top + (from.height - 38) / 2);
  }
  const anim = bubble.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.08}px, ${dy * 0.3}px) scale(1.05)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${dx * 0.85}px, ${dy * 0.9}px) scale(1)`, opacity: 1, offset: 0.75 },
      { transform: `translate(${dx}px, ${dy}px) scale(.97)`, opacity: 0 }
    ],
    { duration: 520, easing: 'cubic-bezier(.3, .7, .2, 1)' }
  );
  anim.onfinish = () => {
    bubble.remove();
    if (target) {
      target.style.opacity = '';
      target.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'ease-out' });
    }
  };
}

addEl.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter' || e.isComposing) return;
  const v = addEl.value.trim();
  if (!v) return;
  const from = addEl.getBoundingClientRect();
  const before = new Set(state.todo.map((t) => t.id));
  addEl.value = '';
  await window.dayTask.add(v, selDate || undefined);
  await refresh();
  const fresh = [...$('todo').querySelectorAll('.row')].find((r) => !before.has(r.dataset.id));
  sendFx(v, from, fresh);
});

$('doneToggle').addEventListener('click', () => {
  doneOpen = !doneOpen;
  render();
});
for (const b of $('tabs').children) {
  b.addEventListener('click', () => {
    tab = b.dataset.tab;
    if (openId) closeDrawer();
    render();
    if (tab === 'today') addEl.focus();
    else if (tab === 'repeat') $('tplTitle').focus();
    $('pageToday').parentNode.parentNode.scrollTop = 0;
  });
}

window.dayTask.onChanged(() => refresh()); // menu bar hoặc nơi khác đổi dữ liệu
setInterval(() => {
  const typing = document.activeElement && (['INPUT'].includes(document.activeElement.tagName) || document.activeElement.classList.contains('title'));
  if (state && (state.active || state.date !== state.today) && !typing) refresh(); // cập nhật số phút và phát hiện qua ngày mới
}, 30000);
window.dayTask.onShown(() => {
  tab = 'today';
  refresh();
  addEl.focus();
});
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (openId) closeDrawer();
  else window.dayTask.close();
});
refresh();
