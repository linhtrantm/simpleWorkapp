const ver = document.getElementById('ver');
const copy = document.getElementById('copy');

window.simpleWork.onAbout(({ version, lang, accent, palette, year }) => {
  swTheme.applyPalette(palette, document);
  swTheme.apply(accent, document);
  i18n.apply(lang, document);
  ver.textContent = i18n.t(lang, 'aboutVersion', { v: version });
  copy.textContent = `©${year} SimpleSoft`;
});
