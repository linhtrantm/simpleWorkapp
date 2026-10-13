// Chuỗi giao diện vi/en, dùng chung cho tiến trình chính (require) và các trang (script tag).
(function (root) {
  const dict = {
    vi: {
      settings: 'Cài đặt',
      settingsSub: 'Chọn app muốn hiển thị trên thanh bên.',
      close: 'Đóng',
      openBrowser: '↗ Mở trong trình duyệt',
      openBrowserTitle: 'Mở trang này bằng trình duyệt mặc định',
      reload: 'Tải lại {name}',
      appsHeading: 'Ứng dụng',
      on: 'Đang bật',
      off: 'Đã tắt',
      remove: 'Xoá',
      removeConfirm: 'Bấm lần nữa để xoá',
      appsNote: 'App bị tắt sẽ không được tải và không nhận tin nhắn. Bật lại thì app tải lại, phiên đăng nhập vẫn còn. Luôn phải giữ ít nhất một app.',
      addHeading: 'Thêm app',
      nameLabel: 'Tên app',
      namePlaceholder: 'Ví dụ: Gmail',
      urlLabel: 'Địa chỉ web (URL)',
      colorLabel: 'Màu icon',
      addBtn: 'Thêm app',
      addNote: 'App thêm vào sẽ có phiên đăng nhập riêng, giống các app có sẵn.',
      sizeHeading: 'Kích thước icon',
      small: 'Nhỏ',
      medium: 'Vừa',
      large: 'Lớn',
      sizeNote: 'Kéo thanh trượt để đổi kích thước. Ở mức nhỏ chỉ hiện icon, từ mức 3 trở lên hiện thêm tên app.',
      openInBrowserMenu: 'Mở trong trình duyệt',
      langHeading: 'Ngôn ngữ',
      errName: 'Nhập tên app.',
      errUrl: 'URL không hợp lệ.',
      errLast: 'Phải giữ ít nhất một app.',
      errGeneric: 'Không thêm được app.',
      loadingApp: 'Đang tải {name}…',
      loadFailed: 'Không tải được {name}',
      loadFailedHint: 'Kiểm tra kết nối mạng rồi thử lại.',
      retry: 'Thử lại',
      notifHeading: 'Thông báo',
      notifSound: 'Âm thanh thông báo',
      notifSoundNote: 'Phát tiếng thông báo của macOS khi có tin mới. Nếu vẫn không nghe, vào Cài đặt hệ thống > Thông báo > simpleWork và bật Âm thanh.',
      themeHeading: 'Giao diện',
      themeSystem: 'Tự động',
      themeLight: 'Sáng',
      themeDark: 'Tối',
      accentHeading: 'Màu nhấn',
      dragHint: 'Kéo ⋮⋮ để đổi thứ tự app trên thanh bên.',
      dragTitle: 'Kéo để đổi thứ tự',
      trayOpen: 'Mở simpleWork',
      traySettings: 'Cài đặt…',
      trayQuit: 'Thoát simpleWork',
      trayTooltipUnread: 'simpleWork - {n} tin chưa đọc'
    },
    en: {
      settings: 'Settings',
      settingsSub: 'Choose which apps to show in the sidebar.',
      close: 'Close',
      openBrowser: '↗ Open in browser',
      openBrowserTitle: 'Open this page in your default browser',
      reload: 'Reload {name}',
      appsHeading: 'Apps',
      on: 'On',
      off: 'Off',
      remove: 'Remove',
      removeConfirm: 'Click again to remove',
      appsNote: 'Turned-off apps are not loaded and receive no messages. Turn one back on and it reloads, still signed in. At least one app must stay on.',
      addHeading: 'Add app',
      nameLabel: 'App name',
      namePlaceholder: 'e.g. Gmail',
      urlLabel: 'Web address (URL)',
      colorLabel: 'Icon color',
      addBtn: 'Add app',
      addNote: 'Added apps get their own login session, like the built-in apps.',
      sizeHeading: 'Icon size',
      small: 'Small',
      medium: 'Medium',
      large: 'Large',
      sizeNote: 'Drag the slider to resize. The smallest levels show icons only; from level 3 up, app names are shown too.',
      openInBrowserMenu: 'Open in browser',
      langHeading: 'Language',
      errName: 'Enter an app name.',
      errUrl: 'Invalid URL.',
      errLast: 'Keep at least one app.',
      errGeneric: 'Could not add the app.',
      loadingApp: 'Loading {name}…',
      loadFailed: 'Could not load {name}',
      loadFailedHint: 'Check your network connection and try again.',
      retry: 'Retry',
      notifHeading: 'Notifications',
      notifSound: 'Notification sound',
      notifSoundNote: 'Play the macOS notification sound for new messages. If you still hear nothing, open System Settings > Notifications > simpleWork and turn on Sounds.',
      themeHeading: 'Appearance',
      themeSystem: 'Auto',
      themeLight: 'Light',
      themeDark: 'Dark',
      accentHeading: 'Accent color',
      dragHint: 'Drag ⋮⋮ to reorder apps in the sidebar.',
      dragTitle: 'Drag to reorder',
      trayOpen: 'Open simpleWork',
      traySettings: 'Settings…',
      trayQuit: 'Quit simpleWork',
      trayTooltipUnread: 'simpleWork - {n} unread'
    }
  };

  function t(lang, key, vars) {
    let s = (dict[lang] && dict[lang][key]) || dict.vi[key] || key;
    if (vars) for (const k of Object.keys(vars)) s = s.replace('{' + k + '}', vars[k]);
    return s;
  }

  // Áp dụng cho phần tử có data-i18n / data-i18n-placeholder / data-i18n-title
  function apply(lang, doc) {
    doc.documentElement.lang = lang;
    doc.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(lang, el.dataset.i18n)));
    doc.querySelectorAll('[data-i18n-placeholder]').forEach((el) => (el.placeholder = t(lang, el.dataset.i18nPlaceholder)));
    doc.querySelectorAll('[data-i18n-title]').forEach((el) => (el.title = t(lang, el.dataset.i18nTitle)));
  }

  const api = { dict, t, apply };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.i18n = api;
})(this);
