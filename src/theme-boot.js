// Áp chủ đề (bảng màu và màu thanh bên) ngay khi thanh bên được dựng, trước lần vẽ đầu tiên, từ bản lưu lần chạy trước.
// Không có bước này thì mỗi lần mở app thanh bên chớp màu mặc định cho tới khi tiến trình chính gửi trạng thái.
(function () {
  try {
    const saved = JSON.parse(localStorage.getItem('sw.look') || 'null');
    if (!saved) return;
    swTheme.applyPalette(saved.look && saved.look.palette, document);
    swTheme.apply(document);
    swTheme.applyFrame(saved.look && saved.look.frame, document);
  } catch {}
})();
