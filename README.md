# simpleWork

App desktop macOS (Electron) gom Zalo, WhatsApp, Teams, Messenger, Claude và các web app tuỳ ý vào một cửa sổ. Mỗi app có phiên đăng nhập riêng, giữ nguyên qua các lần mở và các lần cập nhật.

Phiên bản hiện tại: **1.11.1** (macOS, Apple Silicon).

## Tính năng

- **Giao diện theo chủ đề:** mỗi chủ đề có bảng màu, kiểu thẻ, hoạ tiết nền và font riêng (xem mục Giao diện và font). Thanh bên có icon app dạng squircle một màu (icon Zalo dùng icon chính thức). Chủ đề "Theo hệ thống" tự theo chế độ sáng/tối của macOS.
- **Việc cần làm** (icon ✓ xanh lá trên thanh bên, bật/tắt, kéo đổi chỗ và xoá trong Cài đặt như các app khác). Dữ liệu lưu ngay vào `daytask.json`.
  - **Trang chia ba tab:** *Hôm nay* (danh sách, ô thêm việc cố định ở đáy với hiệu ứng "gửi", nhóm Đã xong gập lại), *Lặp lại*, *Nhắc nhở*. Nút và vùng bấm cao tối thiểu 34 đến 40px, nút Bắt đầu và Xoá luôn hiện.
  - **Việc:** thêm bằng ô nhập + Enter, bấm vòng tròn để đánh xong, bấm vào tên để sửa, kéo ⋮⋮ để đổi thứ tự. Bấm vào một việc (chỗ trống của dòng hoặc nút ›) mở **ngăn chi tiết** bên phải: sửa tiêu đề, **mô tả nhiều dòng** (tự lưu sau 0,6 giây ngừng gõ, tối đa 5000 ký tự, lưu trong trường `note`), ngày tạo, thời gian đã làm. Việc có mô tả hiện icon ≡ ở dòng; Esc đóng ngăn. Mỗi việc (việc cha) có thể có tối đa 30 **việc con** (checklist) nằm ngay trong ngăn chi tiết, phía trên ô mô tả: gõ vào ô "Thêm việc con" rồi Enter (ô giữ nguyên tiêu điểm để gõ liền việc tiếp), bấm vòng tròn để đánh xong, bấm vào tên để sửa, ✕ để xoá, có thanh tiến độ. Dòng việc cha hiện chip ✓ 2/4, đổi màu khi xong hết. Đánh xong việc con không tự đánh xong việc cha.
  - **Bắt đầu và thời gian:** mỗi việc có nút **Bắt đầu**, chỉ một việc được "đang làm", tên việc đó hiện trên **menu bar** (icon ✓ thứ hai, bấm để Tạm dừng / Xong). Nút **Xong** chỉ tác động lên việc đang làm. Bắt đầu việc khác khi đang có việc chạy thì app hỏi tạm dừng hay đánh Xong việc cũ. Thời gian ghi theo từng phiên; tắt app hay máy ngủ thì phiên chỉ tính tới lần ghi nhịp cuối.
  - **Ngày:** ghi việc cho **ngày mai hay ngày sau** (nút ‹ Hôm nay · Ngày mai › và nút lịch); tới ngày đó việc tự thành việc hôm nay, có nút dời về hôm nay. Việc chưa xong của hôm trước được hỏi có dồn sang hôm nay không (mỗi ngày hỏi một lần). **Việc lặp lại** (chọn thứ trong tuần) tự sinh việc mỗi ngày.
  - **Nhắc:** thông báo buổi sáng (mặc định 08:30; lỡ giờ vì máy ngủ thì báo ngay khi máy thức, tới trưa thì thôi), tổng kết cuối ngày (17:30), nhắc khi 15 phút chưa chọn việc đang làm. Máy im quá 10 phút hoặc vừa ngủ dậy mà còn việc đang chạy thì app hỏi còn làm không, có thể cắt thời gian về lúc rời máy. Mọi mốc giờ và công tắc chỉnh ngay ở tab Nhắc nhở.
  - **Widget nổi** luôn trên cùng (kéo được, nhớ vị trí, ẩn bằng ✕ hoặc trong trang Việc cần làm). **Phím tắt toàn hệ thống:** ⌥⌘P tạm dừng/tiếp tục, ⌥⌘D Xong việc đang làm, ⌥⌘T mở trang.
- **Tự cập nhật:** app kiểm tra bản mới mỗi 30 giây bằng cách đọc trang phát hành trên GitHub (không qua API nên không tốn hạn mức lượt hỏi), thấy bản mới thì hiện popup "Có bản cập nhật mới" kèm ghi chú phát hành. Bấm **Tải về**, app tải và kiểm SHA-256; tải xong nút đổi thành **Cập nhật và khởi động lại**. "Để sau" thì không hỏi lại bản đó. Chỉ tự cài được khi app nằm trong thư mục Applications; đang chạy từ chỗ khác thì popup dẫn tới trang tải. Có thể tắt "Tự kiểm tra bản mới" hoặc bấm Kiểm tra tay trong Cài đặt.
- **Mở sẵn tất cả app** khi khởi động để không lỡ tin nhắn. Đóng cửa sổ chỉ ẩn đi, app vẫn chạy nền (thoát hẳn bằng Cmd+Q).
- **Thông báo gốc macOS** cho tin mới: tiêu đề có tên app, bấm vào thì mở app và chuyển đúng tab. Có badge số tin chưa đọc trên icon app, icon Dock và menu bar.
- **Menu bar:** icon hiện tổng tin chưa đọc, menu chuyển nhanh giữa các app.
- **Màn hình chờ và báo lỗi** riêng cho từng app, có nút Thử lại.
- **Cài đặt** (nút ⚙): bật/tắt từng app, kéo thả đổi thứ tự, thêm, **sửa** (đổi tên, URL, màu, giữ nguyên phiên đăng nhập) và xoá app tuỳ ý; mọi app mặc định (kể cả Việc cần làm) đều xoá được, xoá rồi vẫn **khôi phục** được trong mục "Ứng dụng đã xoá" (luôn giữ ít nhất một app web), thanh trượt cỡ icon 6 mức, **chủ đề** màu (Giấy, Hồng, Bạc hà, Trời, Hoàng hôn, Nho, Noel, Đêm, Cực quang, Than chì hoặc tự pha từ một màu; chủ đề tự pha còn chọn được **hình nền** (trái tim, hoa, hoa tulip, chấm bi, kẻ ô) và **mật độ** 5 mức; hoạ tiết của các chủ đề có sẵn đã thưa hơn 15%): chọn một chủ đề là đổi cả nền, thẻ, chữ, màu nhấn của app lẫn màu thanh bên (Noel có thêm tuyết rơi, dây đèn nhấp nháy, thanh tiến độ sọc kẹo); nội dung các trang web không đổi, âm thanh thông báo, ngôn ngữ Tiếng Việt / English.
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

Kết quả: `dist/simpleWork-1.11.1-build<N>-arm64.dmg`. Mỗi lần `npm run dist` số build `<N>` tự tăng (lưu trong `build/build-number.json`), hiện ở cửa sổ About và Finder > Get Info (ví dụ `Version 1.2.0 (7)`). Cài đè vào Applications để cập nhật. `appId` (`com.simplesoft.simplework`) giữ nguyên nên phiên đăng nhập không mất.

App được ký **ad-hoc**, chưa có Apple Developer ID nên chưa notarize. Ký ad-hoc là điều kiện để macOS đưa app vào mục Thông báo. Lần đầu mở nếu bị Gatekeeper chặn: chuột phải vào app > Open, hoặc `xattr -cr /Applications/simpleWork.app`.

## Phát hành bản cập nhật

1. Sửa code, tăng version trong `package.json` (và hai dòng version trong `package-lock.json`) nếu cần, `npm test`, commit.
2. `npm run dist` (số build tự tăng, ghi vào `build/build-number.json`), rồi commit file đó và `git push`.
3. `npm run release -- "ghi chú"` (không có ghi chú thì tự lấy từ các commit kể từ bản phát hành trước). Ghi chú hiện trong popup cập nhật của app nên nên viết 3 đến 4 dòng ngắn. Script cần `gh` đã đăng nhập (`brew install gh`, `gh auth login`), từ chối chạy khi cây git còn thay đổi, và hỏi xác nhận trước khi đăng.
4. Script tạo release `v<version>-build<N>` kèm dmg và file `.sha256`. Các máy đang chạy từ 1.6.0 trở lên sẽ tự thấy trong khoảng 30 giây (bản 1.6.x hỏi sáu giờ một lần, hoặc bấm Kiểm tra trong Cài đặt).

Repo phải công khai (app đọc trang phát hành và tải dmg mà không cần token). App ký ad-hoc, không có chữ ký Apple, nên không dùng được `electron-updater`; updater tự viết (`src/updater*.js`) và độ tin cậy dựa vào HTTPS, tài khoản GitHub của người phát hành và SHA-256. Bản trước 1.6.0 không tự cập nhật được, phải cài tay một lần. Test: `npm test`.

**Mã lỗi cập nhật.** Người dùng chỉ thấy "Hệ thống đang bận, xin thử lại sau (U102)"; không lộ nguồn phát hành. Bảng mã nằm ở `ERRORS` trong `src/updater-core.js`: U101 mạng/quá thời gian, U102 máy chủ giới hạn lượt, U103 HTTP lạ khi lấy thông tin, U201 release thiếu dmg/sha, U202 file sha không đọc được, U203 HTTP lạ khi tải dmg, U204 đứt giữa chừng khi tải, U205 SHA-256 không khớp, U999 không xác định. Chi tiết thật ghi vào nhật ký (`[updater] Uxxx: ...`).

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

- `settings.json`: cài đặt (app bật/tắt, app mặc định đã xoá, thứ tự, app tuỳ ý, chủ đề, ngôn ngữ, cỡ icon...).
- `updates/`: dmg bản mới tải về và `install.log` của lần cập nhật gần nhất.
- `daytask.json`: việc hằng ngày (kèm mô tả chi tiết), việc lặp lại, phiên làm việc, cài đặt nhắc.
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
  daytask-core.js    logic Việc cần làm (thuần, có test)
  daytask-store.js   lưu daytask.json
  daytask-agent.js   chạy ngầm: thông báo, hỏi khi máy im, nhắc, phím tắt, widget nổi
  daytask-widget.html/js  widget nổi
  daytask.html, daytask-page.js, daytask-preload.js  trang Việc cần làm
  updater-core.js, updater.js  cập nhật tự động (logic thuần có test + phần Electron)
  update.html, update.js       popup cập nhật
  theme.js, theme-boot.js, fx.js  chủ đề (bảng màu, thanh bên, hoạ tiết, font), hiệu ứng Noel
  i18n.js            chuỗi tiếng Việt và tiếng Anh
  index.html, renderer.js          thanh bên và thanh trên
  settings.html, settings-page.js  trang Cài đặt
  about.html/js, handoff.html/js, splash.html/js  hộp About, trang mở trong trình duyệt, màn hình chờ
  icons/             icon app web
  assets/            theme.css, looks.css, side.css, noel.css, patterns.css, fonts.css, fonts/, logo, icon menu bar
scripts/
  build.js           tăng số build rồi build .dmg
  release.js         đăng release lên GitHub
  test-daytask.js, test-theme.js, test-updater.js   chạy hết bằng npm test
  test-runtime.js    test luồng cập nhật, ngủ/thức và thông báo với Electron giả
build/icon.png       icon app
```

## Giao diện và font

Mỗi chủ đề (`src/theme.js`) có bảng màu, kiểu thẻ (`style`: gọn, sticker, vở kẻ, phác thảo), hoạ tiết nền (`bg`) và font (`font`), làm theo bộ giao diện của Brezel. Hoạ tiết hiện ở thanh bên (`assets/side.css`) và các trang phụ (`assets/looks.css`); dùng chung các mặt nạ SVG trong `assets/patterns.css`. Noel có thêm `assets/noel.css` (dây đèn, tuyết đọng trên thẻ, thanh tiến độ sọc kẹo) và `src/fx.js` (tuyết rơi). Font Baloo 2, Quicksand, Mali, Patrick Hand, Pangolin nằm trong `src/assets/fonts/` (giấy phép SIL OFL, chỉ nhóm latin và vietnamese), khai báo ở `assets/fonts.css`.

Chủ đề **Tuỳ chọn** pha từ một màu và có thêm hai lựa chọn lưu trong `settings.json`: `lookCustomBg` (không, trái tim, hoa, hoa tulip, chấm bi, kẻ ô) và `lookCustomDensity` (1 đến 5). Mật độ đổi kích thước ô lặp lại qua biến CSS `--pat-k` (càng lớn càng thưa); mức 3 là mức mặc định của mọi chủ đề có sẵn, đã thưa hơn bản trước 15%.

## Lưu ý

- **Pin và tin nhắn:** Mac đang ngủ thì các trang chat mất kết nối, tin chỉ về khi máy thức. Cài đặt > "Chạy nền để nhận tin" có 3 công tắc: giữ app chạy liên tục khi **cắm sạc**, giữ app chạy khi **chạy pin**, và **tải tin nhắn về khi mở máy lại** (sau khi máy ngủ từ 1 phút trở lên). Gập màn hình thì macOS vẫn cho máy ngủ, app tạm dừng cho tới khi mở máy ra.
- **Thông báo:** cần bật Cho phép thông báo cho simpleWork trong Cài đặt hệ thống > Thông báo. Chế độ Tập trung / Không làm phiền của macOS sẽ chặn thông báo. Electron không nhận được web push khi app đã thoát hẳn.
- **Passkey / Touch ID:** không dùng được trong app, nên chọn đăng nhập bằng mật khẩu hoặc mã.
- **Extension trình duyệt** (ví dụ Claude in Chrome) không chạy trong app. Dùng nút Mở trong trình duyệt để mở trang ra trình duyệt ngoài.
- **Cập nhật:** app tự cập nhật qua GitHub Releases (xem mục Tự cập nhật). Muốn cài tay thì cài đè file .dmg vào Applications, phiên đăng nhập vẫn giữ.
