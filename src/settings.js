const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const theme = require('./theme');

const file = () => path.join(app.getPath('userData'), 'settings.json');

// { disabled: ['teams', ...], iconLevel: 1..6, customApps: [{ id, name, url, color }], lang: 'vi'|'en',
// theme: 'system'|'light'|'dark', accent: orange|blue|purple|pink|green|custom (màu tự pha: accentCustom), frame: none|accent|custom|<tên theme khung> (frameCustom), palette: system|paper|pink|mint|sky|night|noel, order: [id...], notifySound: true|false, keepAwakeAc: true|false, keepAwakeBattery: true|false, reloadOnWake: true|false }
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
      notifySound: data.notifySound !== false,
      // chuyển từ cài đặt cũ keepAwake: 'always' | 'ac' | 'off' | true | false
      keepAwakeAc: typeof data.keepAwakeAc === 'boolean' ? data.keepAwakeAc : data.keepAwake !== 'off' && data.keepAwake !== false,
      keepAwakeBattery: typeof data.keepAwakeBattery === 'boolean' ? data.keepAwakeBattery : data.keepAwake === undefined ? true : data.keepAwake === 'always',
      reloadOnWake: data.reloadOnWake !== false,
      autoCheckUpdates: data.autoCheckUpdates !== false,
      updateNotified: typeof data.updateNotified === 'string' ? data.updateNotified : '',
      updateDismissed: typeof data.updateDismissed === 'string' ? data.updateDismissed : '',
      theme: ['system', 'light', 'dark'].includes(data.theme) ? data.theme : 'system',
      accent: Object.keys(theme.ACCENTS).includes(data.accent) || (data.accent === 'custom' && theme.isHex(data.accentCustom)) ? data.accent : 'orange',
      accentCustom: theme.isHex(data.accentCustom) ? data.accentCustom : '#f58a1f',
      palette: theme.PALETTE_IDS.includes(data.palette) ? data.palette : 'system',
      frame: theme.FRAME_IDS.includes(data.frame) && !(data.frame === 'custom' && !theme.isHex(data.frameCustom)) ? data.frame : 'none',
      frameCustom: theme.isHex(data.frameCustom) ? data.frameCustom : '#2b5cff',
      order: Array.isArray(data.order) ? data.order.filter((x) => typeof x === 'string') : [],
      customApps: Array.isArray(data.customApps)
        ? data.customApps.filter((a) => a && a.id && a.name && /^https?:\/\//.test(a.url))
        : []
    };
  } catch {
    return { disabled: [], iconLevel: 4, customApps: [], lang: 'vi', theme: 'system', accent: 'orange', accentCustom: '#f58a1f', palette: 'system', frame: 'none', frameCustom: '#2b5cff', order: [], notifySound: true, keepAwakeAc: true, keepAwakeBattery: true, reloadOnWake: true, autoCheckUpdates: true, updateNotified: '', updateDismissed: '' };
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
