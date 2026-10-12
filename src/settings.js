const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const file = () => path.join(app.getPath('userData'), 'settings.json');

// { disabled: ['teams', ...], iconSize: 'small'|'medium'|'large' } - mặc định tất cả app đều bật
function load() {
  try {
    const data = JSON.parse(fs.readFileSync(file(), 'utf8'));
    return {
      disabled: Array.isArray(data.disabled) ? data.disabled : [],
      iconSize: data.iconSize || 'medium'
    };
  } catch {
    return { disabled: [], iconSize: 'medium' };
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
