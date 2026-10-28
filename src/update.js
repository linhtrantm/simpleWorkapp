const $ = (id) => document.getElementById(id);
let lang = 'vi';
let last = null;

const T = (k, v) => i18n.t(lang, k, v);

function render({ update: u, lang: l, look }) {
  last = u;
  lang = l || 'vi';
  swTheme.applyLook(look, document);
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
  const set = (text, label, act, disabled) => {
    $('status').textContent = text;
    go.textContent = label;
    go.dataset.act = act;
    go.disabled = disabled;
  };
  const mb = u.latest.size ? Math.round(u.latest.size / 1048576) : 0;
  if (u.status === 'downloading') set(T('updDownloading', { v: u.latest.version, pct: u.progress }), T('updLoading'), '', true);
  else if (u.status === 'ready') set(T('updPopupReady'), T('updInstall'), 'install', false);
  else if (!u.canInstall) set(T('updAvailableManual', { v: u.latest.version }), T('updOpenPage'), 'page', !u.latest.url); // ngoài Applications: không tự cài được
  else if (u.status === 'error') set(T('updError') + ': ' + u.error, T('updRetry'), 'download', false);
  else set('', mb ? T('updDownloadSize', { mb }) : T('updDownload'), 'download', false);
}

$('go').addEventListener('click', () => {
  const act = $('go').dataset.act;
  if (act === 'download') window.simpleWork.updateDownload();
  else if (act === 'install') window.simpleWork.updateInstall();
  else if (act === 'page') window.simpleWork.updateOpenPage();
});
$('later').addEventListener('click', () => window.simpleWork.updateLater());
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.simpleWork.updateLater();
});
window.simpleWork.onUpdatePopup(render);
window.simpleWork.getUpdate().then(render); // vẽ ngay lúc mở, không đợi tin đẩy
