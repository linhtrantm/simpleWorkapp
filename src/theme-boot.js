// Áp màu nhấn và theme khung ngay khi thanh bên được dựng, trước lần vẽ đầu tiên, từ bản lưu lần chạy trước.
// Không có bước này thì mỗi lần mở app thanh bên chớp màu mặc định cho tới khi tiến trình chính gửi trạng thái.
(function () {
  try {
    const saved = JSON.parse(localStorage.getItem('sw.look') || 'null');
    if (!saved) return;
    swTheme.apply(saved.accent, document);
    swTheme.applyFrame(saved.frame, document);
  } catch {}
})();
