// Electron không mở được cửa sổ passkey của macOS, trang đăng nhập sẽ treo.
// Giả lập trình duyệt không hỗ trợ WebAuthn để trang tự chuyển sang mật khẩu / mã.
const { webFrame } = require('electron');

webFrame.executeJavaScript(`(() => {
  try { delete window.PublicKeyCredential; } catch (e) {}
  try {
    if (navigator.credentials) {
      const get = navigator.credentials.get.bind(navigator.credentials);
      const create = navigator.credentials.create.bind(navigator.credentials);
      const deny = () => Promise.reject(new DOMException('The operation is not allowed.', 'NotAllowedError'));
      navigator.credentials.get = (o) => (o && o.publicKey ? deny() : get(o));
      navigator.credentials.create = (o) => (o && o.publicKey ? deny() : create(o));
    }
  } catch (e) {}
})();`);
