// Test logic "Việc hôm nay": node scripts/test-daytask.js (hoặc npm test)
const assert = require('node:assert/strict');
const core = require('../src/daytask-core');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (err) {
    console.error('FAIL  ' + name + '\n      ' + err.message);
    process.exitCode = 1;
  }
}

const D = (s) => s; // ngày cho dễ đọc
const T0 = Date.UTC(2026, 9, 25, 3, 0, 0);

test('localDate dùng giờ địa phương, đúng định dạng', () => {
  assert.equal(core.localDate(new Date(2026, 9, 5, 23, 59)), '2026-10-05');
  assert.equal(core.localDate(new Date(2026, 0, 1, 0, 0)), '2026-01-01');
});

test('thêm việc: bỏ khoảng trắng thừa, từ chối tiêu đề rỗng, order tăng dần', () => {
  const data = core.emptyData();
  assert.equal(core.addTask(data, { title: '   ', date: D('2026-10-25') }), null);
  const a = core.addTask(data, { title: '  Viết   báo cáo ', note: 'gửi A', date: D('2026-10-25') }, T0);
  const b = core.addTask(data, { title: 'Họp', date: D('2026-10-25') }, T0 + 1);
  const c = core.addTask(data, { title: 'Việc ngày khác', date: D('2026-10-26') }, T0 + 2);
  assert.equal(a.title, 'Viết báo cáo');
  assert.equal(a.note, 'gửi A');
  assert.deepEqual([a.order, b.order, c.order], [0, 1, 0]);
  assert.equal(data.tasks.length, 3);
});

test('tiêu đề quá dài bị cắt 200 ký tự', () => {
  const data = core.emptyData();
  const t = core.addTask(data, { title: 'x'.repeat(500), date: D('2026-10-25') });
  assert.equal(t.title.length, 200);
});

test('sửa việc: tiêu đề rỗng thì giữ nguyên, ghi chú xoá được', () => {
  const data = core.emptyData();
  const t = core.addTask(data, { title: 'A', note: 'n', date: D('2026-10-25') });
  core.updateTask(data, t.id, { title: '   ', note: '' });
  assert.equal(t.title, 'A');
  assert.equal(t.note, '');
  core.updateTask(data, t.id, { title: 'B' });
  assert.equal(t.title, 'B');
  assert.equal(core.updateTask(data, 'khong-co', { title: 'X' }), null);
});

test('xoá việc', () => {
  const data = core.emptyData();
  const t = core.addTask(data, { title: 'A', date: D('2026-10-25') });
  assert.equal(core.removeTask(data, t.id), true);
  assert.equal(core.removeTask(data, t.id), false);
  assert.equal(data.tasks.length, 0);
});

test('tick xong ghi thời điểm; bỏ tick đưa về cuối nhóm chưa làm', () => {
  const data = core.emptyData();
  const a = core.addTask(data, { title: 'A', date: D('2026-10-25') }, T0);
  const b = core.addTask(data, { title: 'B', date: D('2026-10-25') }, T0);
  core.toggleTask(data, a.id, T0 + 5000);
  assert.equal(a.status, 'done');
  assert.equal(a.completedAt, T0 + 5000);
  core.toggleTask(data, a.id);
  assert.equal(a.status, 'todo');
  assert.equal(a.completedAt, null);
  assert.ok(a.order > b.order, 'việc vừa bỏ tick phải xuống cuối');
});

test('view: việc xong nằm riêng, xếp theo giờ xong; chưa làm theo order; thống kê đúng', () => {
  const data = core.emptyData();
  const a = core.addTask(data, { title: 'A', date: D('2026-10-25') }, T0);
  const b = core.addTask(data, { title: 'B', date: D('2026-10-25') }, T0);
  const c = core.addTask(data, { title: 'C', date: D('2026-10-25') }, T0);
  core.toggleTask(data, c.id, T0 + 10);
  core.toggleTask(data, a.id, T0 + 20);
  const v = core.view(data, D('2026-10-25'));
  assert.deepEqual(v.todo.map((t) => t.title), ['B']);
  assert.deepEqual(v.done.map((t) => t.title), ['C', 'A']);
  assert.deepEqual(v.stats, { total: 3, done: 2 });
});

test('đổi thứ tự: theo danh sách mới, việc không nêu giữ ở sau, việc xong không bị đụng', () => {
  const data = core.emptyData();
  const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((x) => core.addTask(data, { title: x, date: D('2026-10-25') }));
  core.toggleTask(data, d.id, T0);
  core.reorder(data, D('2026-10-25'), [c.id, a.id]);
  assert.deepEqual(core.view(data, D('2026-10-25')).todo.map((t) => t.title), ['C', 'A', 'B']);
  assert.equal(d.status, 'done');
});

test('việc dồn: chỉ lấy việc chưa xong của ngày trước, bỏ việc đã xong, hôm nay và tương lai', () => {
  const data = core.emptyData();
  core.addTask(data, { title: 'dở hôm qua', date: D('2026-10-24') });
  const done = core.addTask(data, { title: 'xong hôm qua', date: D('2026-10-24') });
  core.toggleTask(data, done.id);
  core.addTask(data, { title: 'hôm nay', date: D('2026-10-25') });
  core.addTask(data, { title: 'ngày mai', date: D('2026-10-26') });
  core.addTask(data, { title: 'dở tuần trước', date: D('2026-10-20') });
  assert.deepEqual(core.carryCandidates(data, D('2026-10-25')).map((t) => t.title), ['dở tuần trước', 'dở hôm qua']);
});

test('dồn sang hôm nay: đổi ngày, giữ ngày gốc, xếp cuối, và chỉ hỏi một lần mỗi ngày', () => {
  const data = core.emptyData();
  core.addTask(data, { title: 'dở', date: D('2026-10-24') });
  core.addTask(data, { title: 'sẵn có hôm nay', date: D('2026-10-25') });
  assert.equal(core.view(data, D('2026-10-25')).carry.ask, true);
  assert.equal(core.carryOver(data, D('2026-10-25')), 1);
  const v = core.view(data, D('2026-10-25'));
  assert.deepEqual(v.todo.map((t) => t.title), ['sẵn có hôm nay', 'dở']);
  assert.equal(v.todo[1].carriedFrom, '2026-10-24');
  assert.equal(v.carry.ask, false);
  assert.equal(v.carry.count, 0);
});

test('bỏ qua dồn: không hỏi lại trong ngày, nhưng hôm sau hỏi lại nếu còn việc dở', () => {
  const data = core.emptyData();
  core.addTask(data, { title: 'dở', date: D('2026-10-24') });
  core.skipCarry(data, D('2026-10-25'));
  assert.equal(core.view(data, D('2026-10-25')).carry.ask, false);
  assert.equal(core.view(data, D('2026-10-25')).carry.count, 1);
  assert.equal(core.view(data, D('2026-10-26')).carry.ask, true);
});

test('dồn hai lần liên tiếp không đổi ngày gốc đầu tiên', () => {
  const data = core.emptyData();
  const t = core.addTask(data, { title: 'dở', date: D('2026-10-23') });
  core.carryOver(data, D('2026-10-24'));
  core.carryOver(data, D('2026-10-25'));
  assert.equal(t.date, '2026-10-25');
  assert.equal(t.carriedFrom, '2026-10-23');
});

test('normalize: bỏ mục hỏng, giữ mục tốt, không văng lỗi với dữ liệu rác', () => {
  assert.deepEqual(core.normalize(null), core.emptyData());
  assert.deepEqual(core.normalize('rác'), core.emptyData());
  const raw = {
    tasks: [
      { id: 'a', title: 'tốt', date: '2026-10-25', status: 'done', order: 3, createdAt: 1, completedAt: 2 },
      { id: 'b', title: '', date: '2026-10-25' },
      { id: 'c', title: 'sai ngày', date: 'hôm nay' },
      null,
      { title: 'thiếu id', date: '2026-10-25' }
    ],
    meta: { lastCarryPrompt: '2026-10-24' }
  };
  const d = core.normalize(raw);
  assert.equal(d.tasks.length, 1);
  assert.equal(d.tasks[0].status, 'done');
  assert.equal(d.meta.lastCarryPrompt, '2026-10-24');
});

const mk = (titles) => {
  const data = core.emptyData();
  const tasks = titles.map((x, i) => core.addTask(data, { title: x, date: D('2026-10-25') }, T0 + i));
  return { data, tasks };
};

test('bắt đầu một việc: có phiên mở, trạng thái doing, chỉ một việc đang làm', () => {
  const { data, tasks: [a] } = mk(['A', 'B']);
  assert.deepEqual(core.startTask(data, a.id, undefined, T0), { ok: true });
  assert.equal(data.active.taskId, a.id);
  assert.equal(data.sessions.length, 1);
  const v = core.view(data, D('2026-10-25'));
  assert.equal(v.todo[0].state, 'doing');
  assert.equal(v.todo[1].state, 'todo');
  assert.equal(v.active.id, a.id);
});

test('bắt đầu việc khác khi đang có việc chạy: phải chọn pause/done, không chọn thì báo busy và không đổi gì', () => {
  const { data, tasks: [a, b] } = mk(['A', 'B']);
  core.startTask(data, a.id, undefined, T0);
  assert.equal(core.startTask(data, b.id, undefined, T0 + 1000).error, 'busy');
  assert.equal(data.active.taskId, a.id);
  assert.equal(data.sessions.length, 1);
  core.startTask(data, b.id, 'pause', T0 + 60000);
  assert.equal(data.active.taskId, b.id);
  assert.equal(a.status, 'todo');
  assert.equal(data.sessions[0].end, T0 + 60000);
  assert.equal(core.view(data, D('2026-10-25')).todo.find((t) => t.id === a.id).state, 'paused');
});

test('bắt đầu việc khác với prev=done: việc cũ xong, phiên đóng', () => {
  const { data, tasks: [a, b] } = mk(['A', 'B']);
  core.startTask(data, a.id, undefined, T0);
  core.startTask(data, b.id, 'done', T0 + 5000);
  assert.equal(a.status, 'done');
  assert.equal(a.completedAt, T0 + 5000);
  assert.equal(data.active.taskId, b.id);
});

test('bắt đầu lại đúng việc đang chạy: không tạo phiên mới; việc đã xong thì không bắt đầu được', () => {
  const { data, tasks: [a, b] } = mk(['A', 'B']);
  core.startTask(data, a.id, undefined, T0);
  core.startTask(data, a.id, undefined, T0 + 1);
  assert.equal(data.sessions.length, 1);
  core.toggleTask(data, b.id);
  assert.equal(core.startTask(data, b.id, 'pause').error, 'missing');
});

test('tạm dừng: đóng phiên, không còn việc đang làm, việc vẫn chưa xong', () => {
  const { data, tasks: [a] } = mk(['A']);
  core.startTask(data, a.id, undefined, T0);
  assert.equal(core.pauseActive(data, T0 + 90000), true);
  assert.equal(data.active, null);
  assert.equal(a.status, 'todo');
  assert.equal(core.trackedMs(data, a.id, T0 + 999999), 90000);
  assert.equal(core.pauseActive(data), false);
});

test('Done chỉ tác động lên việc đang làm; không có việc đang làm thì không làm gì', () => {
  const { data, tasks: [a, b] } = mk(['A', 'B']);
  assert.equal(core.doneActive(data), null);
  core.startTask(data, b.id, undefined, T0);
  const t = core.doneActive(data, T0 + 1000);
  assert.equal(t.id, b.id);
  assert.equal(b.status, 'done');
  assert.equal(a.status, 'todo');
  assert.equal(data.active, null);
});

test('tick việc đang làm = Done (phiên đóng, không để phiên mồ côi)', () => {
  const { data, tasks: [a] } = mk(['A']);
  core.startTask(data, a.id, undefined, T0);
  core.toggleTask(data, a.id, T0 + 3000);
  assert.equal(a.status, 'done');
  assert.equal(data.active, null);
  assert.equal(data.sessions[0].end, T0 + 3000);
});

test('xoá việc đang làm: dọn luôn phiên và active', () => {
  const { data, tasks: [a] } = mk(['A']);
  core.startTask(data, a.id, undefined, T0);
  core.removeTask(data, a.id);
  assert.equal(data.active, null);
  assert.equal(data.sessions.length, 0);
});

test('recover: app tắt/ngủ lâu thì phiên chỉ tính tới nhịp cuối; còn nhịp gần thì giữ chạy', () => {
  const { data, tasks: [a] } = mk(['A']);
  core.startTask(data, a.id, undefined, T0);
  core.beat(data, T0 + 60000);
  assert.equal(core.recover(data, T0 + 60000 + 30000), false);
  assert.ok(data.active);
  assert.equal(core.recover(data, T0 + 8 * 3600 * 1000), true);
  assert.equal(data.active, null);
  assert.equal(core.trackedMs(data, a.id, T0 + 99 * 3600 * 1000), 60000);
});

test('lưu rồi đọc lại (normalize) giữ nguyên việc đang làm và phiên', () => {
  const { data, tasks: [a] } = mk(['A']);
  core.startTask(data, a.id, undefined, T0);
  const again = core.normalize(JSON.parse(JSON.stringify(data)));
  assert.equal(again.active.taskId, a.id);
  assert.equal(again.sessions.length, 1);
  assert.equal(again.sessions[0].end, null);
});

test('normalize: phiên mở không có active thì đóng lại; phiên của việc đã mất bị bỏ', () => {
  const raw = {
    tasks: [{ id: 'a', title: 'A', date: '2026-10-25' }],
    sessions: [{ id: 's1', taskId: 'a', start: 100, end: null }, { id: 's2', taskId: 'zzz', start: 1, end: 2 }],
    active: null
  };
  const d = core.normalize(raw);
  assert.equal(d.sessions.length, 1);
  assert.notEqual(d.sessions[0].end, null);
  assert.equal(d.active, null);
});

// 2026-10-25 là Chủ nhật (0); 2026-10-26 là thứ Hai (1)
test('weekday tính đúng thứ theo ngày địa phương', () => {
  assert.equal(core.weekday('2026-10-25'), 0);
  assert.equal(core.weekday('2026-10-26'), 1);
});

test('việc lặp lại: từ chối tiêu đề rỗng hoặc không có thứ nào', () => {
  const data = core.emptyData();
  assert.equal(core.addTemplate(data, { title: ' ', days: [1] }), null);
  assert.equal(core.addTemplate(data, { title: 'A', days: [] }), null);
  assert.equal(core.addTemplate(data, { title: 'A', days: [9, -1, 'x'] }), null);
  const t = core.addTemplate(data, { title: 'Họp nhóm', days: [3, 1, 1] });
  assert.deepEqual(t.days, [1, 3]);
});

test('sinh việc lặp lại: đúng thứ mới sinh, đánh dấu templateId, xếp cuối', () => {
  const data = core.emptyData();
  core.addTask(data, { title: 'sẵn có', date: D('2026-10-26') });
  core.addTemplate(data, { title: 'Họp nhóm', days: [1] });
  core.addTemplate(data, { title: 'Chỉ thứ Ba', days: [2] });
  assert.equal(core.generateRecurring(data, D('2026-10-26')), 1);
  const v = core.view(data, D('2026-10-26'));
  assert.deepEqual(v.todo.map((t) => t.title), ['sẵn có', 'Họp nhóm']);
  assert.ok(v.todo[1].templateId);
});

test('sinh việc lặp lại: chỉ một lần mỗi ngày, xoá việc đã sinh không bị sinh lại, hôm sau sinh tiếp', () => {
  const data = core.emptyData();
  core.addTemplate(data, { title: 'Hằng ngày', days: [0, 1, 2, 3, 4, 5, 6] });
  assert.equal(core.generateRecurring(data, D('2026-10-26')), 1);
  assert.equal(core.generateRecurring(data, D('2026-10-26')), 0);
  core.removeTask(data, data.tasks[0].id);
  assert.equal(core.generateRecurring(data, D('2026-10-26')), 0);
  assert.equal(data.tasks.length, 0);
  assert.equal(core.generateRecurring(data, D('2026-10-27')), 1);
});

test('xoá mẫu: việc đã sinh vẫn còn', () => {
  const data = core.emptyData();
  const t = core.addTemplate(data, { title: 'X', days: [1] });
  core.generateRecurring(data, D('2026-10-26'));
  assert.equal(core.removeTemplate(data, t.id), true);
  assert.equal(core.removeTemplate(data, t.id), false);
  assert.equal(data.tasks.length, 1);
});

test('prefs: mặc định đủ, giá trị sai kiểu hoặc ngoài khoảng bị bỏ', () => {
  const data = core.emptyData();
  assert.deepEqual(data.meta.prefs, core.DEFAULT_PREFS);
  core.setPrefs(data, { morningTime: '07:45', idleMin: 15, widgetOn: false });
  assert.equal(data.meta.prefs.morningTime, '07:45');
  assert.equal(data.meta.prefs.idleMin, 15);
  assert.equal(data.meta.prefs.widgetOn, false);
  core.setPrefs(data, { morningTime: '25:99', idleMin: 0, endOn: 'yes', endTime: 'abc' });
  assert.equal(data.meta.prefs.morningTime, '07:45');
  assert.equal(data.meta.prefs.idleMin, 15);
  assert.equal(data.meta.prefs.endOn, true);
  assert.equal(data.meta.prefs.endTime, '17:30');
});

test('lưu rồi đọc lại giữ mẫu, prefs, vị trí widget', () => {
  const data = core.emptyData();
  core.addTemplate(data, { title: 'X', days: [1, 2] });
  core.setPrefs(data, { idleMin: 20 });
  data.meta.widgetPos = { x: 10.4, y: 20 };
  data.meta.lastMorning = '2026-10-25';
  const again = core.normalize(JSON.parse(JSON.stringify(data)));
  assert.equal(again.templates.length, 1);
  assert.equal(again.meta.prefs.idleMin, 20);
  assert.deepEqual(again.meta.widgetPos, { x: 10, y: 20 });
  assert.equal(again.meta.lastMorning, '2026-10-25');
});

test('normalize: file cũ (trước khi có mẫu/prefs) vẫn đọc được và có mặc định', () => {
  const d = core.normalize({ tasks: [{ id: 'a', title: 'A', date: '2026-10-25' }], meta: { lastCarryPrompt: '2026-10-24' } });
  assert.equal(d.tasks.length, 1);
  assert.deepEqual(d.templates, []);
  assert.deepEqual(d.meta.prefs, core.DEFAULT_PREFS);
});

test('tổng kết ngày: số việc xong/còn, tổng thời gian trong ngày, việc làm lâu nhất', () => {
  const { data, tasks: [a, b] } = mk(['A', 'B']);
  const day = core.localDate(new Date(T0));
  data.tasks.forEach((t) => (t.date = day));
  core.startTask(data, a.id, undefined, T0);
  core.pauseActive(data, T0 + 30 * 60000);
  core.startTask(data, b.id, undefined, T0 + 31 * 60000);
  core.doneActive(data, T0 + 91 * 60000);
  const s = core.summary(data, day, T0 + 100 * 60000);
  assert.equal(s.done, 1);
  assert.equal(s.left, 1);
  assert.equal(s.total, 2);
  assert.equal(s.trackedMs, 90 * 60000);
  assert.deepEqual(s.top, { title: 'B', ms: 60 * 60000 });
});

test('tạm dừng tại thời điểm trong quá khứ (máy im): phiên kết thúc đúng lúc đó, không bị âm', () => {
  const { data, tasks: [a] } = mk(['A']);
  core.startTask(data, a.id, undefined, T0);
  core.pauseActive(data, T0 + 5 * 60000);
  assert.equal(core.trackedMs(data, a.id, T0 + 99 * 60000), 5 * 60000);
  const b = mk(['B']);
  core.startTask(b.data, b.tasks[0].id, undefined, T0);
  core.pauseActive(b.data, T0 - 1000); // sai giờ: không ra số âm
  assert.equal(core.trackedMs(b.data, b.tasks[0].id), 0);
});

console.log(`\n${passed} test đạt${process.exitCode ? ', CÓ TEST LỖI' : ''}`);
