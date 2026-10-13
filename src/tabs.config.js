// Thêm tab mới = thêm 1 entry vào mảng này, không cần sửa logic.
// icon (svg, thư mục src/icons) + color (màu nền): hiển thị trên menu trái trên menu trái.
// disableWebAuthn: true = tắt passkey (Electron không hỗ trợ) để trang đăng nhập dùng mật khẩu/mã.
// internalHosts: các host được điều hướng trong chính tab; link khác mở bằng trình duyệt mặc định.
// keepAlive: true = app nặng cần trình duyệt vẽ khung hình mới chạy nền được (ví dụ Teams); giữ trang
// "hiện" nhưng nằm dưới app đang xem. Tốn thêm CPU nên chỉ bật cho app thật sự cần.
// authHosts: các host đăng nhập, được phép mở bằng cửa sổ popup trong app (OAuth, MSAL...).
// Link người dùng bấm trong chat (target=_blank) luôn mở bằng trình duyệt mặc định.
module.exports = [
  {
    id: 'zalo',
    name: 'Zalo',
    url: 'https://chat.zalo.me',
    partition: 'persist:ZaloWeb',
    icon: 'icons/zalo.svg',
    color: '#0068ff',
    internalHosts: ['zalo.me', 'zaloapp.com', 'zdn.vn']
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    url: 'https://web.whatsapp.com',
    partition: 'persist:WhatsAppWeb',
    icon: 'icons/whatsapp.svg',
    color: '#25a244',
    internalHosts: ['whatsapp.com', 'whatsapp.net']
  },
  {
    id: 'teams',
    name: 'Teams',
    url: 'https://teams.microsoft.com',
    partition: 'persist:TeamsWeb',
    keepAlive: true,
    disableWebAuthn: true,
    icon: 'icons/microsoftteams.svg',
    color: '#5b5fc7',
    authHosts: [
      'login.microsoftonline.com', 'login.microsoft.com', 'login.live.com', 'account.live.com',
      'account.microsoft.com', 'microsoftonline.com', 'msauth.net', 'msftauth.net'
    ],
    internalHosts: [
      'microsoft.com', 'microsoftonline.com', 'live.com', 'office.com',
      'microsoft365.com', 'teams.cloud.microsoft', 'cloud.microsoft', 'skype.com', 'msauth.net', 'msftauth.net'
    ]
  },
  {
    id: 'messenger',
    name: 'Messenger',
    url: 'https://www.messenger.com/',
    partition: 'persist:MessengerWeb',
    icon: 'icons/messenger.svg',
    color: '#a033ff',
    internalHosts: ['messenger.com', 'facebook.com', 'fb.com', 'facebook.net', 'fbcdn.net', 'fbsbx.com', 'meta.com']
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai',
    partition: 'persist:ClaudeWeb',
    disableWebAuthn: true,
    icon: 'icons/claude.svg',
    color: '#d97757',
    authHosts: ['accounts.google.com', 'appleid.apple.com', 'gstatic.com'],
    internalHosts: ['claude.ai', 'anthropic.com', 'claude.com']
  }
];
