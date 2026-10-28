const $ = (id) => document.getElementById(id);
let lang = 'vi';
let last = null;

const T = (k, v) => i18n.t(lang, k, v);

function render({ update: u, lang: l, look }) {
  last = u;
  lang = l || 'vi';
  swTheme.applyPalette(look && look.palette, document);
  swTheme.apply(document);
  i18n.apply(lang, document);
  if (!u.latest) return;
  const cur = u.current.version + (u.current.build ? ` (${u.current.build})` : '');
  $('ver').textContent = T('updPopupVer', { v: u.latest.version + (u.latest.build ? ` (${u.latest.build})` : ''), cur });
  const notes = $('notes');
  notes.textContent = '';
  if (u.latest.lines && u.latest.lines.length) {
    const ul = document.createElement('ul');
    for (const line of u.latest.lines) {
      const li = document.createElement('li');
      li.textContent = line;
      ul.appendChild(li);
    }
    notes.appendChild(ul);
  } else {
    const p = document.createElement('div');
    p.className = 'none';
    p.textContent = T('updNoNotes');
    notes.appendChild(p);
  }
  const go = $('go');
  const bar = $('bar');
  bar.hidden = u.status !== 'downloading';
  $('fill').style.width = u.progress + '%';
  let status = '';
  if (u.status === 'downloading') {
    status = T('updDownloading', { v: u.latest.version, pct: u.progress });
    go.textContent = T('updLoading');
    go.disabled = true;
    go.dataset.act = '';
  } else if (u.status === 'ready') {
    status = T('updPopupReady');
    go.textContent = T('updInstall');
    go.disabled = false;
    go.dataset.act = 'install';
  } else if (u.status === 'error') {
    status = T('updError') + ': ' + u.error;
    go.textContent = T('updOpenPage');
    go.disabled = !u.latest.url;
    go.dataset.act = 'page';
  } else {
    // chạy ngoài thư mục Applications: không tự cài được, chỉ mở trang tải
    status = T('updAvailableManual', { v: u.latest.version });
    go.textContent = T('updOpenPage');
    go.disabled = !u.latest.url;
    go.dataset.act = 'page';
  }
  $('status').textContent = status;
}

$('go').addEventListener('click', () => {
  const act = $('go').dataset.act;
  if (act === 'install') window.simpleWork.updateInstall();
  else if (act === 'page') window.simpleWork.updateOpenPage();
});
$('later').addEventListener('click', () => window.simpleWork.updateLater());
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.simpleWork.updateLater();
});
window.simpleWork.onUpdatePopup(render);
