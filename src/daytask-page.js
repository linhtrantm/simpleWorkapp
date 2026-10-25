const $ = (id) => document.getElementById(id);
const addEl = $('add');
let lang = 'vi';
let state = null;
let choosing = null; // id việc định bắt đầu khi đang có việc khác chạy

const mins = (ms) => Math.max(0, Math.round(ms / 60000));

const T = (k, v) => i18n.t(lang, k, v);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
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
  const tick = el('button', 'tick');
  tick.addEventListener('click', () => apply(window.dayTask.toggle(task.id)));
  r.appendChild(tick);
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
  if (task.carriedFrom) r.appendChild(el('span', 'tag', T('dayCarried', { date: task.carriedFrom.slice(5).replace('-', '/') })));
  if (task.state === 'doing') {
    r.classList.add('doing');
    r.appendChild(el('span', 'tag live', T('dayNowTag')));
  } else if (task.status !== 'done') {
    if (task.state === 'paused') r.classList.add('paused');
    if (task.trackedMs >= 60000) r.appendChild(el('span', 'tag', T('dayMinutes', { min: mins(task.trackedMs) })));
    const play = el('button', 'play', task.state === 'paused' ? T('dayPausedTag') + ' ▶' : T('dayStart') + ' ▶');
    play.addEventListener('click', () => start(task.id));
    r.appendChild(play);
  }
  const del = el('button', 'del', T('dayDelete'));
  del.addEventListener('click', () => apply(window.dayTask.remove(task.id)));
  r.appendChild(del);
  return r;
}

const DAY_KEYS = ['dayD0', 'dayD1', 'dayD2', 'dayD3', 'dayD4', 'dayD5', 'dayD6'];
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
    const del = el('button', 'del', T('dayDelete'));
    del.style.opacity = 1;
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
    r.appendChild(cb);
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
    box.appendChild(r);
  });
}

function render() {
  const s = state;
  $('sub').textContent = T('dayTaskSub', { done: s.stats.done, total: s.stats.total });
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
  if (s.active) {
    const t = s.todo.find((x) => x.id === s.active.id);
    const box = el('div', 'now');
    box.appendChild(el('small', '', T('dayNowTag') + (t && t.trackedMs >= 60000 ? ' · ' + T('dayMinutes', { min: mins(t.trackedMs) }) : '')));
    box.appendChild(el('b', '', s.active.title));
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
  if (!s.todo.length) todo.appendChild(el('div', 'empty', s.stats.total ? T('dayAllDone') : T('dayEmpty')));
  const done = $('done');
  done.textContent = '';
  s.done.forEach((t) => done.appendChild(row(t)));
  $('doneWrap').style.display = s.done.length ? '' : 'none';
  renderTemplates(s);
  renderPrefs(s);
}

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
  apply(await window.dayTask.reorder([...$('todo').querySelectorAll('.row')].map((r) => r.dataset.id)));
});

async function start(id, prev) {
  const v = await window.dayTask.start(id, prev);
  choosing = v.error === 'busy' ? id : null; // đang có việc khác chạy: hỏi tạm dừng hay Done
  state = v;
  render();
}

async function apply(p) {
  const v = await p;
  if (v) {
    state = v;
    render();
  }
}

async function refresh() {
  const v = await window.dayTask.view();
  lang = v.lang || 'vi';
  i18n.apply(lang, document);
  swTheme.apply(v.accent, document);
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

addEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.isComposing) return;
  const v = addEl.value.trim();
  if (!v) return;
  addEl.value = '';
  apply(window.dayTask.add(v));
});

window.dayTask.onChanged(() => refresh()); // menu bar hoặc nơi khác đổi dữ liệu
setInterval(() => {
  const typing = document.activeElement && (['INPUT'].includes(document.activeElement.tagName) || document.activeElement.classList.contains('title'));
  if (state && state.active && !typing) refresh(); // cập nhật số phút
}, 30000);
window.dayTask.onShown(() => {
  refresh();
  addEl.focus();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.dayTask.close();
});
refresh();
