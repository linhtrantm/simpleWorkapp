// Lưu "Việc hôm nay" ra file daytask.json trong thư mục dữ liệu của app. Ghi ngay sau mỗi thay đổi (ghi file tạm rồi đổi tên
// để không bao giờ để lại file ghi dở khi crash hoặc tắt máy).
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const core = require('./daytask-core');

let data = null;
let listener = null;
const file = () => path.join(app.getPath('userData'), 'daytask.json');

function load() {
  if (data) return data;
  const f = file();
  let raw = null;
  try {
    raw = fs.readFileSync(f, 'utf8');
  } catch {
    // chưa có file: bắt đầu trống
  }
  if (raw === null) return (data = core.emptyData());
  try {
    data = core.normalize(JSON.parse(raw));
  } catch {
    // file hỏng: giữ lại bản sao để khỏi mất dữ liệu rồi bắt đầu mới
    try {
      fs.copyFileSync(f, `${f}.corrupt-${Date.now()}`);
    } catch {}
    data = core.emptyData();
  }
  let dirty = core.recover(data); // lần chạy trước tắt giữa chừng: chốt phiên dở
  if (core.generateRecurring(data, core.localDate())) dirty = true;
  if (dirty) save();
  return data;
}

function save() {
  const f = file();
  const tmp = `${f}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, f);
  } catch (err) {
    console.error('Không lưu được daytask.json:', err);
  }
  if (listener) listener();
}

const today = () => core.localDate();
const snapshot = () => core.view(load(), today());

// Mỗi thao tác trả về trạng thái mới cho giao diện
const api = {
  view: () => snapshot(),
  add: (title, note) => {
    core.addTask(load(), { title, note, date: today() });
    save();
    return snapshot();
  },
  update: (id, patch) => {
    core.updateTask(load(), id, patch);
    save();
    return snapshot();
  },
  remove: (id) => {
    core.removeTask(load(), id);
    save();
    return snapshot();
  },
  toggle: (id) => {
    core.toggleTask(load(), id);
    save();
    return snapshot();
  },
  reorder: (ids) => {
    core.reorder(load(), today(), Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : []);
    save();
    return snapshot();
  },
  start: (id, prev) => {
    const r = core.startTask(load(), id, prev);
    if (r.error) return { ...snapshot(), error: r.error };
    save();
    return snapshot();
  },
  // at: thời điểm dừng thật sự (ví dụ lúc máy bắt đầu im), mặc định là bây giờ
  pause: (at) => {
    if (core.pauseActive(load(), Number.isFinite(at) ? at : Date.now())) save();
    return snapshot();
  },
  done: () => {
    if (core.doneActive(load())) save();
    return snapshot();
  },
  // Gọi định kỳ khi có việc đang làm: ghi nhịp để lần sau biết app còn sống tới đâu
  beat: () => {
    if (!load().active) return;
    core.beat(data);
    save();
  },
  addTemplate: (title, days) => {
    const tpl = core.addTemplate(load(), { title, days: Array.isArray(days) ? days : [] });
    if (tpl) core.generateRecurring(data, today()); // thêm giữa ngày mà hợp thứ thì có việc hôm nay luôn
    save();
    return snapshot();
  },
  removeTemplate: (id) => {
    core.removeTemplate(load(), id);
    save();
    return snapshot();
  },
  setPrefs: (patch) => {
    core.setPrefs(load(), patch);
    save();
    return snapshot();
  },
  // Qua ngày mới thì sinh việc lặp lại. Gọi định kỳ và khi máy thức dậy; không có gì mới thì không ghi file.
  rollover: () => {
    if (core.generateRecurring(load(), today())) save();
  },
  prefs: () => ({ ...load().meta.prefs }),
  summary: () => core.summary(load(), today()),
  morningInfo: () => {
    const v = snapshot();
    return { count: v.todo.length, titles: v.todo.slice(0, 3).map((t) => t.title), carry: v.carry.count };
  },
  hasActive: () => !!load().active,
  lastBeat: () => (load().active ? load().active.lastBeat : null),
  mark: (kind) => {
    load().meta[kind === 'morning' ? 'lastMorning' : 'lastSummary'] = today();
    save();
  },
  marked: (kind) => load().meta[kind === 'morning' ? 'lastMorning' : 'lastSummary'] === today(),
  widgetPos: () => load().meta.widgetPos,
  setWidgetPos: (pos) => {
    load().meta.widgetPos = { x: Math.round(pos.x), y: Math.round(pos.y) };
    save();
  },
  onChange: (fn) => {
    listener = fn;
  },
  carry: () => {
    core.carryOver(load(), today());
    save();
    return snapshot();
  },
  skipCarry: () => {
    core.skipCarry(load(), today());
    save();
    return snapshot();
  }
};

module.exports = api;
