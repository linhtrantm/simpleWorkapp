const ver = document.getElementById('ver');
const copy = document.getElementById('copy');

window.simpleWork.onAbout(({ version, lang, look, year }) => {
  swTheme.applyPalette(look && look.palette, document);
  swTheme.apply(document);
  i18n.apply(lang, document);
  ver.textContent = i18n.t(lang, 'aboutVersion', { v: version });
  copy.textContent = `©${year} SimpleSoft`;
});
