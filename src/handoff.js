const ico = document.getElementById('ico');
const title = document.getElementById('title');
const text = document.getElementById('text');
const btn = document.getElementById('btn');

btn.addEventListener('click', () => window.simpleWork.releaseHandoff());
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') window.simpleWork.releaseHandoff();
});

window.simpleWork.onHandoff(({ name, icon, art, tile, gradient, letter, color, lang, look }) => {
  swTheme.applyLook(look, document);
  i18n.apply(lang, document);
  ico.replaceChildren(swIcon.node({ icon, art, tile, gradient, letter, color, name }));
  title.textContent = i18n.t(lang, 'handoffTitle', { name });
  text.textContent = i18n.t(lang, 'handoffText');
  btn.textContent = i18n.t(lang, 'handoffBtn');
  btn.focus();
});
