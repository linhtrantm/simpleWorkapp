// Bảng màu nhấn + áp dụng cho trang (dùng chung cho tiến trình chính và các trang giao diện).
(function (root) {
  const ACCENTS = {
    orange: ['#f58a1f', '#ffb454'],
    blue: ['#3B82F6', '#06b6d4'],
    purple: ['#8b5cf6', '#c084fc'],
    pink: ['#ec4899', '#f9a8d4'],
    green: ['#10b981', '#6ee7b7']
  };

  function apply(accent, doc) {
    const [a, b] = ACCENTS[accent] || ACCENTS.orange;
    doc.documentElement.style.setProperty('--accent', a);
    doc.documentElement.style.setProperty('--accent2', b);
  }

  const api = { ACCENTS, apply };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.swTheme = api;
})(this);
