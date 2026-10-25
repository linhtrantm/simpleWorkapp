# simpleWork

App desktop macOS (Electron) gom Zalo, WhatsApp, Teams, Messenger, Claude và các web app tuỳ ý vào một cửa sổ. Mỗi app có phiên đăng nhập riêng, giữ nguyên qua các lần mở và các lần cập nhật.

Phiên bản hiện tại: **1.5.0** (macOS, Apple Silicon).

## Tính năng

- **Giao diện phẳng (flat) kiểu iOS 7**: nền đặc, màu phẳng, không kính mờ, không bóng đổ. Thanh bên có icon app dạng squircle một màu (icon Zalo dùng icon chính thức), ô chọn phẳng, tự theo chế độ sáng/tối của macOS.
- **Việc hôm nay** (icon ✓ xanh lá trên thanh bên, bật/tắt và kéo đổi chỗ trong Cài đặt như các app khác): danh sách việc trong ngày, thêm bằng ô nhập + Enter, bấm vòng tròn để đánh xong, bấm vào tên để sửa, kéo ⋮⋮ để đổi thứ tự. Mỗi việc có nút **Bắt đầu**: chỉ một việc được "đang làm", tên việc đó hiện trên **menu bar** (icon ✓ thứ hai, bấm để Tạm dừng / Xong). Nút **Xong** chỉ tác động lên việc đang làm và ghi tên việc trên nút. Bắt đầu việc khác khi đang có việc chạy thì app hỏi tạm dừng hay đánh Xong việc cũ. Thời gian làm được ghi theo từng phiên; tắt app hay máy ngủ thì phiên chỉ tính tới lần ghi nhịp cuối. **Việc lặp lại** (chọn thứ trong tuần) tự sinh việc mỗi ngày. **Thông báo buổi sáng** (mặc định 08:30, lỡ giờ vì máy ngủ thì báo ngay khi máy thức, tới trưa thì thôi) và **tổng kết cuối ngày** (17:30). Máy im quá 10 phút hoặc vừa ngủ dậy mà còn việc đang chạy thì app hỏi còn làm không, có thể cắt thời gian về lúc rời máy. Nhắc khi 15 phút chưa chọn việc đang làm. **Widget nổi** luôn trên cùng (kéo được, nhớ vị trí, ẩn bằng ✕ hoặc trong trang Việc hôm nay). Phím tắt toàn hệ thống: ⌥⌘P tạm dừng/tiếp tục, ⌥⌘D Xong việc đang làm, ⌥⌘T mở trang. Mọi mốc giờ và công tắc chỉnh ngay trong trang. Việc chưa xong của hôm trước được hỏi có dồn sang hôm nay không (mỗi ngày hỏi một lần). Lưu ngay vào `daytask.json`.
- **Mở sẵn tất cả app** khi khởi động để không lỡ tin nhắn. Đóng cửa sổ chỉ ẩn đi, app vẫn chạy nền (thoát hẳn bằng Cmd+Q).
- **Thông báo gốc macOS** cho tin mới: tiêu đề có tên app, bấm vào thì mở app và chuyển đúng tab. Có badge số tin chưa đọc trên icon app, icon Dock và menu bar.
- **Menu bar:** icon hiện tổng tin chưa đọc, menu chuyển nhanh giữa các app.
- **Màn hình chờ và báo lỗi** riêng cho từng app, có nút Thử lại.
- **Cài đặt** (nút ⚙): bật/tắt từng app, kéo thả đổi thứ tự, thêm/xoá app tuỳ ý (tên, URL, màu), thanh trượt cỡ icon 6 mức, chủ đề Tự động/Sáng/Tối, 5 màu nhấn **hoặc tự pha màu** (ba thanh Sắc/Đậm/Sáng + ô nhập mã), **theme khung** kiểu Outlook (8 theme có sẵn, theo màu nhấn, hoặc tự pha) chỉ tô thanh bên còn nội dung giữ nguyên, âm thanh thông báo, ngôn ngữ Tiếng Việt / English.
- **Chuột phải vào icon app:** Tải lại, Mở trong trình duyệt.
- **Kéo cửa sổ:** kéo bằng nền thanh bên (khoảng trống quanh 3 nút cửa sổ, kẽ giữa các icon, vùng dưới danh sách app). Các vùng kéo do chính trang web tự khai báo (ví dụ ô Search của Zalo) bị tắt để không kéo nhầm.
- Link bấm trong chat mở bằng **trình duyệt mặc định** của macOS. Chỉ popup đăng nhập mới mở trong app.

## Chạy

```bash
npm install
npm start
```

Nếu chạy trong terminal của VSCode mà app crash ngay, thử `env -u ELECTRON_RUN_AS_NODE npm start` (VSCode đặt biến `ELECTRON_RUN_AS_NODE=1`).

## Build .dmg (arm64)

```bash
npm run dist
```

Kết quả: `dist/simpleWork-1.5.0-build<N>-arm64.dmg`. Mỗi lần `npm run dist` số build `<N>` tự tăng (lưu trong `build/build-number.json`), hiện ở cửa sổ About và Finder > Get Info (ví dụ `Version 1.2.0 (7)`). Cài đè vào Applications để cập nhật. `appId` (`com.simplesoft.simplework`) giữ nguyên nên phiên đăng nhập không mất.

App được ký **ad-hoc**, chưa có Apple Developer ID nên chưa notarize. Ký ad-hoc là điều kiện để macOS đưa app vào mục Thông báo. Lần đầu mở nếu bị Gatekeeper chặn: chuột phải vào app > Open, hoặc `xattr -cr /Applications/simpleWork.app`.

## Đánh số phiên bản

Dạng `MAJOR.MINOR.PATCH` (sửa tay trong `package.json`), cộng số build tự tăng:

- **MAJOR** (2.0.0): thay đổi làm hỏng cách dùng cũ (dữ liệu hay cài đặt cũ không dùng được).
- **MINOR** (1.3.0): thêm tính năng mà cái cũ vẫn chạy. Khi tăng, PATCH về 0.
- **PATCH** (1.2.1): chỉ sửa lỗi, không thêm tính năng.
- **Số build**: tăng mỗi lần build để phân biệt các bản build thử, không đổi số phiên bản.

## Thêm app có sẵn trong code

Sửa `src/tabs.config.js`, thêm một entry vào mảng:

| Trường | Ý nghĩa |
|---|---|
| `id`, `name`, `url` | định danh, tên hiển thị, địa chỉ web |
| `partition` | `persist:<Tên>`, kho cookie riêng của app, phải duy nhất |
| `icon` | file svg trong `src/icons/` |
| `color` | màu nền icon |
| `internalHosts` | các domain được điều hướng ngay trong tab, link khác mở ra trình duyệt ngoài |
| `authHosts` | domain đăng nhập được phép mở popup trong app (Microsoft, Google...) |
| `disableWebAuthn` | `true` để tắt passkey (Electron không hỗ trợ), trang đăng nhập sẽ dùng mật khẩu hoặc mã |
| `keepAlive` | `true` cho app nặng cần được vẽ khung hình mới chạy nền (ví dụ Teams) |

Người dùng cũng có thể thêm app tuỳ ý ngay trong Cài đặt, không cần sửa code.

## Dữ liệu và nhật ký

Nằm trong `~/Library/Application Support/simpleWork/`:

- `settings.json`: cài đặt (app bật/tắt, thứ tự, app tuỳ ý, chủ đề, ngôn ngữ, cỡ icon...).
- `daytask.json`: danh sách việc hằng ngày.
- `notify.log`: nhật ký thông báo, mỗi thông báo một dòng (`show`, `skip`, `FAILED`). Dùng để tìm lý do khi mất thông báo.

## Cấu trúc

```
src/
  main.js            tiến trình chính: cửa sổ, các view web, thông báo, menu bar, cài đặt
  preload.js         cầu nối IPC cho các trang giao diện
  notify-bridge.js   chuyển thông báo web sang thông báo gốc macOS
  no-webauthn.js     tắt passkey ở các app cần
  tabs.config.js     danh sách app có sẵn
  settings.js        lưu và đọc settings.json
  daytask-core.js    logic Việc hôm nay (thuần, có test: node scripts/test-daytask.js)
  daytask-store.js   lưu daytask.json
  daytask-agent.js   chạy ngầm: thông báo, hỏi khi máy im, nhắc, phím tắt, widget nổi
  daytask-widget.html/js  widget nổi
  daytask.html, daytask-page.js, daytask-preload.js  trang Việc hôm nay
  i18n.js, theme.js  chuỗi vi/en, màu nhấn, theme khung, đổi màu HSL (test: node scripts/test-theme.js)
  index.html, renderer.js          thanh bên và thanh trên
  settings.html, settings-page.js  trang Cài đặt
  splash.html, splash.js           màn hình loader
  icons/, assets/                  icon app web, font, logo, icon menu bar
build/icon.png       icon app
```

## Lưu ý

- **Pin và tin nhắn:** Mac đang ngủ thì các trang chat mất kết nối, tin chỉ về khi máy thức. Cài đặt > "Chạy nền để nhận tin" có 3 công tắc: giữ app chạy liên tục khi **cắm sạc**, giữ app chạy khi **chạy pin**, và **tải tin nhắn về khi mở máy lại** (sau khi máy ngủ từ 1 phút trở lên). Gập màn hình thì macOS vẫn cho máy ngủ, app tạm dừng cho tới khi mở máy ra.
- **Thông báo:** cần bật Cho phép thông báo cho simpleWork trong Cài đặt hệ thống > Thông báo. Chế độ Tập trung / Không làm phiền của macOS sẽ chặn thông báo. Electron không nhận được web push khi app đã thoát hẳn.
- **Passkey / Touch ID:** không dùng được trong app, nên chọn đăng nhập bằng mật khẩu hoặc mã.
- **Extension trình duyệt** (ví dụ Claude in Chrome) không chạy trong app. Dùng nút Mở trong trình duyệt để mở trang ra trình duyệt ngoài.
- Không có tự động cập nhật. Muốn cập nhật thì build lại rồi cài đè .dmg mới.
