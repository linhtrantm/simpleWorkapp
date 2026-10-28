const card = document.getElementById('card');
let lang = 'vi';

const T = (k, v) => i18n.t(lang, k, v);

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function render(v) {
  lang = v.lang || 'vi';
  swTheme.applyPalette(v.palette, document);
  swTheme.apply(v.accent, document);
  document.documentElement.lang = lang;
  card.textContent = '';
  card.className = v.active ? 'live' : '';
  const x = el('button', 'x', '✕');
  x.title = T('dayWidgetHide');
  x.addEventListener('click', () => window.dayTask.widgetHide());
  card.appendChild(x);
  if (v.active) {
    const t = v.todo.find((k) => k.id === v.active.id);
    const min = t ? Math.round(t.trackedMs / 60000) : 0;
    card.appendChild(el('div', 'label', T('dayNowTag') + (min >= 1 ? ' · ' + T('dayMinutes', { min }) : '')));
    const name = el('div', 'name', v.active.title);
    name.addEventListener('click', () => window.dayTask.openPage());
    card.appendChild(name);
    const row = el('div', 'actions');
    const done = el('button', '', T('dayDoneBtn', { name: v.active.title }));
    done.addEventListener('click', () => window.dayTask.done());
    const pause = el('button', 'ghost', T('dayPause'));
    pause.addEventListener('click', () => window.dayTask.pause());
    row.append(done, pause);
    card.appendChild(row);
  } else {
    card.appendChild(el('div', 'label', T('dayNoActive')));
    if (!v.todo.length) {
      const name = el('div', 'name', v.stats.total ? T('dayAllDone') : T('dayEmpty'));
      name.addEventListener('click', () => window.dayTask.openPage());
      card.appendChild(name);
    } else {
      card.appendChild(el('div', '', '')).style.height = '6px';
      v.todo.slice(0, 3).forEach((t) => {
        const r = el('div', 'next');
        r.appendChild(el('span', '', t.title));
        const b = el('button', '', T('dayStart') + ' ▶');
        b.addEventListener('click', () => window.dayTask.start(t.id));
        r.appendChild(b);
        card.appendChild(r);
      });
    }
  }
  window.dayTask.widgetSize(card.offsetHeight + 12);
}

async function refresh() {
  render(await window.dayTask.view());
}

window.dayTask.onChanged(refresh);
setInterval(refresh, 60000); // cập nhật số phút
refresh();
