const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const theme = require('./theme');

const file = () => path.join(app.getPath('userData'), 'settings.json');

// { disabled: ['teams', ...], iconLevel: 1..6, customApps: [{ id, name, url, color }], lang: 'vi'|'en',
// theme: 'system'|'light'|'dark', look: system|custom|paper|pink|mint|sky|sunset|grape|noel|night|aurora|graphite (chủ đề: bảng màu + thanh bên; custom dùng lookCustom), order: [id...], notifySound: true|false, keepAwakeAc: true|false, keepAwakeBattery: true|false, reloadOnWake: true|false }
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
      ...theme.migrateLook(data),
      order: Array.isArray(data.order) ? data.order.filter((x) => typeof x === 'string') : [],
      customApps: Array.isArray(data.customApps)
        ? data.customApps.filter((a) => a && a.id && a.name && /^https?:\/\//.test(a.url))
        : []
    };
  } catch {
    return { disabled: [], iconLevel: 4, customApps: [], lang: 'vi', theme: 'system', look: 'system', lookCustom: '#2b5cff', order: [], notifySound: true, keepAwakeAc: true, keepAwakeBattery: true, reloadOnWake: true, autoCheckUpdates: true, updateNotified: '', updateDismissed: '' };
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
