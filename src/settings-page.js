const list = document.getElementById('list');
const ver = document.getElementById('ver');
document.getElementById('close').addEventListener('click', () => window.simpleWork.closeSettings());
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.simpleWork.closeSettings();
});

const sizes = document.getElementById('sizes');
sizes.addEventListener('click', (e) => {
  const size = e.target.dataset && e.target.dataset.size;
  if (size) window.simpleWork.setIconSize(size);
});

function render({ apps, version, iconSize }) {
  ver.textContent = 'v' + version;
  for (const b of sizes.children) b.classList.toggle('on', b.dataset.size === iconSize);
  const enabledCount = apps.filter((a) => a.enabled).length;
  list.replaceChildren(
    ...apps.map((a) => {
      const row = document.createElement('div');
      row.className = 'row' + (a.enabled ? '' : ' off');

      const ico = document.createElement('div');
      ico.className = 'ico';
      ico.style.background = a.color;
      const img = document.createElement('img');
      img.src = a.icon;
      img.alt = '';
      ico.appendChild(img);
      row.appendChild(ico);

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = a.name;
      row.appendChild(name);

      const state = document.createElement('div');
      state.className = 'state';
      state.textContent = a.enabled ? 'Đang bật' : 'Đã tắt';
      row.appendChild(state);

      const label = document.createElement('label');
      label.className = 'switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = a.enabled;
      input.disabled = a.enabled && enabledCount <= 1;
      input.addEventListener('change', () => window.simpleWork.setEnabled(a.id, input.checked));
      label.append(input, document.createElement('span'));
      row.appendChild(label);
      return row;
    })
  );
}

window.simpleWork.onSettings(render);
window.simpleWork.getSettings().then(render);
