// Thème appliqué avant le rendu pour éviter un flash de couleurs (fichier externe : compatible CSP).
(function () {
  try {
    var t = localStorage.getItem('cercle:theme') || 'dark';
    if (t === 'system') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
  } catch (e) {}
})();
