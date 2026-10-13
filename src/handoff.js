const ico = document.getElementById('ico');
const title = document.getElementById('title');
const text = document.getElementById('text');
const btn = document.getElementById('btn');

btn.addEventListener('click', () => window.simpleWork.releaseHandoff());
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') window.simpleWork.releaseHandoff();
});

window.simpleWork.onHandoff(({ name, icon, letter, color, lang, accent }) => {
  swTheme.apply(accent, document);
  i18n.apply(lang, document);
  ico.style.background = `linear-gradient(150deg, color-mix(in srgb, ${color} 70%, #fff), ${color})`;
  ico.style.setProperty('--glow', color);
  if (icon) {
    const img = document.createElement('img');
    img.src = icon;
    img.alt = '';
    ico.replaceChildren(img);
  } else {
    const l = document.createElement('span');
    l.className = 'letter';
    l.textContent = letter || '?';
    ico.replaceChildren(l);
  }
  title.textContent = i18n.t(lang, 'handoffTitle', { name });
  text.textContent = i18n.t(lang, 'handoffText');
  btn.textContent = i18n.t(lang, 'handoffBtn');
  btn.focus();
});
