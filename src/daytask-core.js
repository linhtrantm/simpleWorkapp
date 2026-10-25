// Logic thuần của "Việc hôm nay" (không đụng tới đĩa hay Electron) để dễ viết test.
// Dữ liệu: { version, tasks: [Task], sessions: [Session], templates: [Template], active, meta }
// Session: { id, taskId, start, end|null } — mỗi lần bấm Bắt đầu mở một phiên, Tạm dừng/Xong đóng phiên.
// active: { taskId, sessionId, lastBeat } | null — việc đang làm (chỉ một). lastBeat để biết app còn sống tới lúc nào.
// Template: { id, title, days: [0..6] (0 = Chủ nhật), lastGen: 'YYYY-MM-DD' } — việc lặp lại, tự sinh ra việc mỗi ngày đúng thứ.
// meta: { lastCarryPrompt, lastMorning, lastSummary, widgetPos, prefs }
// Task: { id, title, note, date: 'YYYY-MM-DD', status: 'todo'|'done', order, createdAt, completedAt, carriedFrom }
'use strict';

const pad = (n) => String(n).padStart(2, '0');
const STATUSES = ['todo', 'done'];
const DEFAULT_PREFS = {
  morningOn: true, morningTime: '08:30', // thông báo buổi sáng
  endOn: true, endTime: '17:30', // tổng kết cuối ngày
  idleOn: true, idleMin: 10, // hỏi lại khi máy im
  remindOn: true, // nhắc khi chưa chọn việc đang làm
  widgetOn: true, // widget nổi
  shortcutsOn: true // phím tắt toàn hệ thống
};
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Ngày theo giờ địa phương, dạng YYYY-MM-DD (so sánh chuỗi cho kết quả đúng thứ tự thời gian)
function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyData() {
  return { version: 1, tasks: [], sessions: [], templates: [], active: null, meta: { lastCarryPrompt: '', lastMorning: '', lastSummary: '', widgetPos: null, prefs: { ...DEFAULT_PREFS } } };
}

// Chỉ nhận đúng kiểu và khoảng giá trị; giá trị lạ thì giữ cái cũ
function cleanPrefs(p, base) {
  const out = { ...base };
  if (!p || typeof p !== 'object') return out;
  for (const k of ['morningOn', 'endOn', 'idleOn', 'remindOn', 'widgetOn', 'shortcutsOn']) if (typeof p[k] === 'boolean') out[k] = p[k];
  for (const k of ['morningTime', 'endTime']) if (typeof p[k] === 'string' && HHMM.test(p[k])) out[k] = p[k];
  if (Number.isInteger(p.idleMin) && p.idleMin >= 1 && p.idleMin <= 120) out.idleMin = p.idleMin;
  return out;
}

const clean = (s, max) => String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// Đọc dữ liệu lưu trên đĩa, bỏ các mục hỏng thay vì làm hỏng cả file
function normalize(raw) {
  const data = emptyData();
  if (!raw || typeof raw !== 'object') return data;
  if (raw.meta && typeof raw.meta === 'object') {
    for (const k of ['lastCarryPrompt', 'lastMorning', 'lastSummary']) if (typeof raw.meta[k] === 'string') data.meta[k] = raw.meta[k];
    const wp = raw.meta.widgetPos;
    if (wp && Number.isFinite(wp.x) && Number.isFinite(wp.y)) data.meta.widgetPos = { x: Math.round(wp.x), y: Math.round(wp.y) };
    data.meta.prefs = cleanPrefs(raw.meta.prefs, data.meta.prefs);
  }
  if (Array.isArray(raw.templates)) {
    for (const t of raw.templates) {
      const title = t && clean(t.title, 200);
      const days = t && Array.isArray(t.days) ? [...new Set(t.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
      if (!title || typeof t.id !== 'string' || !days.length) continue;
      data.templates.push({ id: t.id, title, days, lastGen: /^\d{4}-\d{2}-\d{2}$/.test(t.lastGen || '') ? t.lastGen : '' });
    }
  }
  if (Array.isArray(raw.sessions)) {
    for (const s of raw.sessions) {
      if (!s || typeof s.id !== 'string' || typeof s.taskId !== 'string' || !Number.isFinite(s.start)) continue;
      data.sessions.push({ id: s.id, taskId: s.taskId, start: s.start, end: Number.isFinite(s.end) ? s.end : null });
    }
  }
  if (!Array.isArray(raw.tasks)) return data;
  for (const t of raw.tasks) {
    if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
    const title = clean(t.title, 200);
    if (!title) continue;
    data.tasks.push({
      id: t.id,
      title,
      note: clean(t.note, 500),
      date: t.date,
      status: STATUSES.includes(t.status) ? t.status : 'todo',
      order: Number.isFinite(t.order) ? t.order : 0,
      createdAt: Number.isFinite(t.createdAt) ? t.createdAt : 0,
      completedAt: Number.isFinite(t.completedAt) ? t.completedAt : null,
      carriedFrom: /^\d{4}-\d{2}-\d{2}$/.test(t.carriedFrom || '') ? t.carriedFrom : null,
      templateId: typeof t.templateId === 'string' ? t.templateId : null
    });
  }
  // phiên và việc đang làm phải trỏ tới việc còn tồn tại
  const ids = new Set(data.tasks.map((t) => t.id));
  data.sessions = data.sessions.filter((s) => ids.has(s.taskId));
  const a = raw.active;
  const open = a && data.sessions.find((s) => s.id === a.sessionId && s.end === null && s.taskId === a.taskId);
  if (open) data.active = { taskId: a.taskId, sessionId: a.sessionId, lastBeat: Number.isFinite(a.lastBeat) ? a.lastBeat : open.start };
  for (const s of data.sessions) if (s.end === null && !(data.active && data.active.sessionId === s.id)) s.end = s.start; // phiên mở mồ côi
  return data;
}

const nextOrder = (data, date) => data.tasks.filter((t) => t.date === date).reduce((m, t) => Math.max(m, t.order), -1) + 1;
const find = (data, id) => data.tasks.find((t) => t.id === id) || null;

function addTask(data, { title, note, date }, now = Date.now(), id) {
  const t = clean(title, 200);
  if (!t) return null;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : localDate(new Date(now));
  const task = {
    id: id || `t${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    title: t,
    note: clean(note, 500),
    date: day,
    status: 'todo',
    order: nextOrder(data, day),
    createdAt: now,
    completedAt: null,
    carriedFrom: null,
    templateId: null
  };
  data.tasks.push(task);
  return task;
}

function updateTask(data, id, patch = {}) {
  const task = find(data, id);
  if (!task) return null;
  if (patch.title !== undefined) {
    const t = clean(patch.title, 200);
    if (t) task.title = t; // tiêu đề rỗng thì giữ nguyên
  }
  if (patch.note !== undefined) task.note = clean(patch.note, 500);
  return task;
}

function removeTask(data, id) {
  const i = data.tasks.findIndex((t) => t.id === id);
  if (i < 0) return false;
  data.tasks.splice(i, 1);
  data.sessions = data.sessions.filter((s) => s.taskId !== id);
  if (data.active && data.active.taskId === id) data.active = null;
  return true;
}

// ---- Việc đang làm ----
function closeActive(data, now, at) {
  if (!data.active) return;
  const s = data.sessions.find((x) => x.id === data.active.sessionId);
  if (s) s.end = Math.max(s.start, at === undefined ? now : at);
  data.active = null;
}

// Bắt đầu một việc. Đang có việc khác chạy thì phải nói rõ xử lý nó thế nào: prev = 'pause' | 'done'.
// Không nói thì trả { error: 'busy' } và không đổi gì, để giao diện hỏi người dùng.
function startTask(data, id, prev, now = Date.now(), sid) {
  const task = find(data, id);
  if (!task || task.status === 'done') return { error: 'missing' };
  if (data.active && data.active.taskId === id) return { ok: true };
  if (data.active) {
    if (prev !== 'pause' && prev !== 'done') return { error: 'busy', activeId: data.active.taskId };
    const before = data.active.taskId;
    closeActive(data, now);
    if (prev === 'done') toggleTask(data, before, now);
  }
  const sessionId = sid || `s${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  data.sessions.push({ id: sessionId, taskId: id, start: now, end: null });
  data.active = { taskId: id, sessionId, lastBeat: now };
  return { ok: true };
}

function pauseActive(data, now = Date.now()) {
  if (!data.active) return false;
  closeActive(data, now);
  return true;
}

// Nút Done: chỉ tác động lên việc đang làm
function doneActive(data, now = Date.now()) {
  if (!data.active) return null;
  const id = data.active.taskId;
  closeActive(data, now);
  return toggleTask(data, id, now) && find(data, id);
}

// ---- Việc lặp lại ----
const weekday = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

function addTemplate(data, { title, days }, now = Date.now(), id) {
  const t = clean(title, 200);
  const ds = [...new Set((days || []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  if (!t || !ds.length) return null;
  const tpl = { id: id || `r${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, title: t, days: ds, lastGen: '' };
  data.templates.push(tpl);
  return tpl;
}

function removeTemplate(data, id) {
  const i = data.templates.findIndex((t) => t.id === id);
  if (i < 0) return false;
  data.templates.splice(i, 1);
  return true;
}

// Sinh việc của hôm nay từ các mẫu đúng thứ. Mỗi mẫu một lần mỗi ngày (lastGen), nên xoá việc đã sinh thì không bị sinh lại.
function generateRecurring(data, today, now = Date.now()) {
  let n = 0;
  const wd = weekday(today);
  for (const tpl of data.templates) {
    if (tpl.lastGen === today || !tpl.days.includes(wd)) continue;
    tpl.lastGen = today;
    const task = addTask(data, { title: tpl.title, date: today }, now + n);
    if (task) {
      task.templateId = tpl.id;
      n++;
    }
  }
  return n;
}

function setPrefs(data, patch) {
  data.meta.prefs = cleanPrefs(patch, data.meta.prefs);
  return data.meta.prefs;
}

// Tổng kết một ngày: số việc xong, tổng thời gian làm (các phiên bắt đầu trong ngày), việc làm lâu nhất
function summary(data, today, now = Date.now()) {
  const mine = data.tasks.filter((t) => t.date === today);
  const per = new Map();
  let total = 0;
  for (const s of data.sessions) {
    if (localDate(new Date(s.start)) !== today) continue;
    const ms = Math.max(0, (s.end === null ? now : s.end) - s.start);
    total += ms;
    per.set(s.taskId, (per.get(s.taskId) || 0) + ms);
  }
  const top = [...per.entries()].sort((a, b) => b[1] - a[1])[0];
  const topTask = top && find(data, top[0]);
  return {
    total: mine.length,
    done: mine.filter((t) => t.status === 'done').length,
    left: mine.filter((t) => t.status !== 'done').length,
    trackedMs: total,
    top: topTask ? { title: topTask.title, ms: top[1] } : null
  };
}

function beat(data, now = Date.now()) {
  if (data.active) data.active.lastBeat = now;
}

// Khởi động lại app: nếu lần chạy trước không còn "nhịp" gần đây (app tắt, máy ngủ, crash) thì phiên chỉ tính tới nhịp cuối
function recover(data, now = Date.now(), maxGap = 2 * 60 * 1000) {
  if (!data.active) return false;
  if (now - data.active.lastBeat <= maxGap) return false;
  closeActive(data, now, data.active.lastBeat);
  return true;
}

// Tổng thời gian đã làm của một việc, tính cả phiên đang chạy
function trackedMs(data, id, now = Date.now()) {
  return data.sessions.reduce((sum, s) => (s.taskId === id ? sum + Math.max(0, (s.end === null ? now : s.end) - s.start) : sum), 0);
}

// Tick xong / bỏ tick. Bỏ tick thì việc quay về cuối nhóm "chưa làm".
function toggleTask(data, id, now = Date.now()) {
  const task = find(data, id);
  if (!task) return null;
  if (data.active && data.active.taskId === id) closeActive(data, now); // tick việc đang làm = Done
  if (task.status === 'done') {
    task.status = 'todo';
    task.completedAt = null;
    task.order = nextOrder(data, task.date);
  } else {
    task.status = 'done';
    task.completedAt = now;
  }
  return task;
}

// Đổi thứ tự các việc chưa xong của một ngày theo danh sách id mới
function reorder(data, date, ids) {
  const mine = data.tasks.filter((t) => t.date === date && t.status !== 'done');
  const byId = new Map(mine.map((t) => [t.id, t]));
  let i = 0;
  for (const id of ids) {
    const t = byId.get(id);
    if (t) {
      t.order = i++;
      byId.delete(id);
    }
  }
  for (const t of [...byId.values()].sort((a, b) => a.order - b.order)) t.order = i++; // việc không có trong danh sách giữ ở sau
}

// Việc chưa xong của các ngày trước hôm nay
function carryCandidates(data, today) {
  return data.tasks.filter((t) => t.date < today && t.status !== 'done').sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1));
}

// Dồn các việc dở sang hôm nay (giữ ngày gốc ở carriedFrom), xếp vào cuối danh sách
function carryOver(data, today) {
  const list = carryCandidates(data, today);
  let order = nextOrder(data, today);
  for (const t of list) {
    if (!t.carriedFrom) t.carriedFrom = t.date;
    t.date = today;
    t.order = order++;
  }
  data.meta.lastCarryPrompt = today;
  return list.length;
}

function skipCarry(data, today) {
  data.meta.lastCarryPrompt = today;
}

// Trạng thái gửi cho giao diện
function view(data, today) {
  const mine = data.tasks.filter((t) => t.date === today);
  const todo = mine.filter((t) => t.status !== 'done').sort((a, b) => a.order - b.order);
  const done = mine.filter((t) => t.status === 'done').sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
  const carry = carryCandidates(data, today);
  const now = Date.now();
  const withTime = (t) => ({
    ...t,
    trackedMs: trackedMs(data, t.id, now),
    state: t.status === 'done' ? 'done' : data.active && data.active.taskId === t.id ? 'doing' : trackedMs(data, t.id, now) > 0 ? 'paused' : 'todo'
  });
  const act = data.active && find(data, data.active.taskId);
  return {
    today,
    todo: todo.map(withTime),
    done: done.map(withTime),
    active: act ? { id: act.id, title: act.title } : null,
    templates: data.templates.map((t) => ({ ...t })),
    prefs: { ...data.meta.prefs },
    stats: { total: mine.length, done: done.length },
    carry: {
      count: carry.length,
      titles: carry.slice(0, 3).map((t) => t.title),
      ask: carry.length > 0 && data.meta.lastCarryPrompt !== today // chỉ hỏi một lần mỗi ngày
    }
  };
}

module.exports = {
  localDate, emptyData, normalize, addTask, updateTask, removeTask, toggleTask, reorder,
  DEFAULT_PREFS, cleanPrefs, setPrefs, addTemplate, removeTemplate, generateRecurring, summary, weekday,
  startTask, pauseActive, doneActive, beat, recover, trackedMs,
  carryCandidates, carryOver, skipCarry, view
};
