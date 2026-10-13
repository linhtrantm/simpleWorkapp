const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const file = () => path.join(app.getPath('userData'), 'settings.json');

// { disabled: ['teams', ...], iconLevel: 1..6, customApps: [{ id, name, url, color }], lang: 'vi'|'en',
// theme: 'system'|'light'|'dark', accent: orange|blue|purple|pink|green, order: [id...] }
// mặc định tất cả app đều bật
function load() {
  try {
    const data = JSON.parse(fs.readFileSync(file(), 'utf8'));
    return {
      disabled: Array.isArray(data.disabled) ? data.disabled : [],
      iconLevel: Number.isInteger(data.iconLevel) && data.iconLevel >= 1 && data.iconLevel <= 6
        ? data.iconLevel
        : { small: 1, medium: 4, large: 5 }[data.iconSize] || 4, // chuyển từ 3 mức cũ
      lang: data.lang === 'en' ? 'en' : 'vi',
      theme: ['system', 'light', 'dark'].includes(data.theme) ? data.theme : 'system',
      accent: ['orange', 'blue', 'purple', 'pink', 'green'].includes(data.accent) ? data.accent : 'orange',
      order: Array.isArray(data.order) ? data.order.filter((x) => typeof x === 'string') : [],
      customApps: Array.isArray(data.customApps)
        ? data.customApps.filter((a) => a && a.id && a.name && /^https?:\/\//.test(a.url))
        : []
    };
  } catch {
    return { disabled: [], iconLevel: 4, customApps: [], lang: 'vi', theme: 'system', accent: 'orange', order: [] };
  }
}

function save(settings) {
  try {
    fs.writeFileSync(file(), JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('Không lưu được settings:', err);
  }
}

module.exports = { load, save };
