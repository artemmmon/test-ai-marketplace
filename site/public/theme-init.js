// Applies the saved theme before the first paint (dark is the default).
// Kept as an external file because the CSP forbids inline scripts.
(function () {
  var theme = 'dark';
  try {
    var saved = window.localStorage.getItem('tam-theme');
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch (e) {
    /* storage unavailable (private mode, blocked cookies) */
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
