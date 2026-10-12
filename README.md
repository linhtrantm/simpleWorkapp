# simpleWork

App desktop macOS gom Zalo, WhatsApp, Teams, Messenger, Claude vào 4 tab (menu dọc bên trái) trong một cửa sổ (Electron).

## Chạy

```bash
npm install
npm start
```

## Build .dmg (arm64)

```bash
npm run dist
```

Kết quả: `dist/simpleWork-1.0.0-arm64.dmg`. Cài đè vào Applications để update. `appId` (`com.simplesoft.simplework`) giữ nguyên nên session đăng nhập không mất.

App chưa ký (no code signing). Lần đầu mở: chuột phải vào app > Open, hoặc `xattr -cr /Applications/simpleWork.app`.

## Thêm tab mới

Sửa `src/tabs.config.js`, thêm 1 entry: `id`, `name`, `url`, `partition` (`persist:<Tên>`), `icon` (svg trong `src/icons/`), `color`, `internalHosts`.
