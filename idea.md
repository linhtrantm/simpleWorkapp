Brief: simpleWork — Desktop app gom Zalo / WhatsApp / Teams, build .dmg (macOS)

Mục tiêu: App desktop macOS tên simpleWork, mở lên tự load Zalo Web / WhatsApp Web / Teams Web vào 3 tab trong 1 cửa sổ. Đây là module nền tảng đầu tiên của hệ sinh thái simpleWork (sau này sẽ mở rộng thêm các module khác như Project, nhúng Claude web, v.v. — nhưng không build sẵn trong lần này, chỉ cần kiến trúc dễ mở rộng).

Kỹ thuật:

Nền tảng: Electron, dùng BrowserView cho mỗi service (không iframe — bị CSP chặn).
3 tab mặc định:
Zalo Web: https://chat.zalo.me
WhatsApp Web: https://web.whatsapp.com
Teams Web: https://teams.microsoft.com
Mỗi tab dùng partition: "persist:<tên>" riêng → giữ session đăng nhập qua các lần mở/update app.
Set User-Agent Chrome chuẩn.
UI: thanh tab ngang trên cùng, click đổi tab, nút reload riêng từng tab.
appId cố định (vd com.simplesoft.simplework) — giữ nguyên xuyên suốt các bản build sau này để update không mất session đăng nhập.
Kiến trúc tab nên viết dạng config-driven (1 mảng danh sách tab: tên, URL, partition) thay vì hard-code từng tab riêng lẻ — để sau này thêm tab mới (vd Claude web) chỉ cần thêm 1 entry, không phải sửa logic.

Build:

electron-builder, target dmg, chỉ build arm64, bật asar.
Tối giản dependency, không UI framework nặng.
Output: simpleWork-1.0.0-arm64.dmg, kèm README ngắn (npm install / npm start / npm run dist).

Update: build lại → cài đè .dmg mới vào Applications, appId không đổi nên session không mất (đã thống nhất ở brief trước).

Không cần (lần này):

Không nhúng Claude web, không auto-dò task, không kết nối app Project — để dành cho các bước sau.
Không auto-update, không code signing/notarization.
Không build Windows/Linux.